from datetime import datetime, timedelta
import inspect

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from config import DEMO_MODE
from models import Incident, Resource, Hazard, Assignment, AIAnalysis
from dataset_models import DatasetIncident, DatasetHazard
from dispatch_audit import DispatchAudit
from sqlalchemy import func

from schemas import *
from ai_service import analyze_incident
from priority_engine import calculate_priority
from resource_allocator import allocate
from route_engine import recommend_route
from resource_movement import (
    MOVEMENTS,
    advance as advance_resource_movement,
    public as public_movement,
    total_distance_m,
    TIME_SCALE,
    MIN_SECONDS,
)


# ============================================================
# DATABASE / APPLICATION SETUP
# ============================================================

Base.metadata.create_all(bind=engine)

from seed_database import seed_demo_data

if DEMO_MODE:
    seed_demo_data()

app = FastAPI(
    title="ResQAI API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH
# ============================================================


# ============================================================
# DEMO RESOURCE LIFECYCLE
# ============================================================

DEMO_RESOURCE_RELEASE_SECONDS = 90
DEMO_RESOURCE_RELEASES = {}

# ============================================================
# FIXED DEMO IDLE POSITIONS
# ============================================================
# These are the positions to which resources return after
# completing an incident.

DEMO_IDLE_POSITIONS = {
    "AMB-01": (17.000, 82.240),
    "AMB-02": (17.012, 82.250),
    "AMB-03": (17.005, 82.260),
    "FIRE-01": (17.004, 82.246),
    "FIRE-02": (17.020, 82.260),
    "POL-01": (16.998, 82.252),
    "POL-02": (17.014, 82.240),
    "RES-01": (17.006, 82.257),
    "MED-01": (17.011, 82.243),
    "DRT-01": (17.017, 82.248),
}

def _release_due_resources(db: Session):
    now = datetime.utcnow()
    changed = False

    resources = db.query(Resource).all()

    for resource in resources:
        status = str(resource.status or "").upper()

        if status != "BUSY":
            DEMO_RESOURCE_RELEASES.pop(
                resource.resource_id,
                None
            )
            continue

        resource_id = resource.resource_id

        # A resource with an active OSRM movement is controlled by the
        # movement engine. Do not let the 90-second fallback timer release it.
        if resource_id in MOVEMENTS:
            DEMO_RESOURCE_RELEASES.pop(resource_id, None)
            continue

        if resource_id not in DEMO_RESOURCE_RELEASES:
            DEMO_RESOURCE_RELEASES[resource_id] = (
                now + timedelta(
                    seconds=DEMO_RESOURCE_RELEASE_SECONDS
                )
            )

        release_at = DEMO_RESOURCE_RELEASES[resource_id]

        if now >= release_at:
            incident_id = resource.current_incident_id

            resource.status = "AVAILABLE"
            resource.current_incident_id = None

            DEMO_RESOURCE_RELEASES.pop(
                resource_id,
                None
            )

            if incident_id:
                incident = db.get(
                    Incident,
                    incident_id
                )

                if incident:
                    remaining_busy = (
                        db.query(Resource)
                        .filter(
                            Resource.current_incident_id == incident_id,
                            Resource.status == "BUSY",
                        )
                        .count()
                    )

                    if remaining_busy == 0:
                        incident.status = "RESOLVED"

                    incident.updated_at = datetime.utcnow()

            changed = True

    if changed:
        db.commit()

    return changed


def _resource_release_seconds(resource):
    release_at = DEMO_RESOURCE_RELEASES.get(
        resource.resource_id
    )

    if not release_at:
        return None

    return max(
        0,
        int(
            (
                release_at - datetime.utcnow()
            ).total_seconds()
        )
    )


def _resource_matches_requirement(resource, requirement):
    requirement = str(
        requirement or ""
    ).lower().strip()

    resource_type = str(
        resource.resource_type or ""
    ).lower()

    capabilities = str(
        resource.capabilities or ""
    ).lower()

    haystack = f"{resource_type},{capabilities}"

    aliases = {
        "ambulance": ["ambulance", "medical"],
        "fire truck": ["fire truck", "fire"],
        "police": ["police", "police vehicle"],
        "rescue vehicle": ["rescue", "rescue vehicle"],
        "medical team": ["medical", "triage"],
        "disaster response team": [
            "disaster",
            "response team"
        ]
    }

    terms = aliases.get(
        requirement,
        [requirement]
    )

    return any(
        term in haystack
        for term in terms
        if term
    )


def _reset_demo_state(db: Session):
    """
    Completely reset the ResQAI demo.

    Resources return to their configured idle positions.
    Incidents return to NEW.
    Movement state is cleared.
    Audit history remains untouched.
    """

    _release_due_resources(db)

    resources = db.query(Resource).all()

    for resource in resources:

        resource.status = "AVAILABLE"
        resource.current_incident_id = None

        idle_position = DEMO_IDLE_POSITIONS.get(
            resource.resource_id
        )

        if idle_position:
            resource.latitude = float(
                idle_position[0]
            )
            resource.longitude = float(
                idle_position[1]
            )

    incidents = db.query(Incident).all()

    reset_incidents = 0

    for incident in incidents:

        status = str(
            incident.status or ""
        ).upper()

        if status != "NEW":

            incident.status = "NEW"
            incident.updated_at = datetime.utcnow()

            reset_incidents += 1

    DEMO_RESOURCE_RELEASES.clear()
    MOVEMENTS.clear()

    db.commit()

    return {
        "message": (
            "ResQAI demo state reset successfully."
        ),
        "resources_reset": len(resources),
        "incidents_reset": reset_incidents,
        "audit_history_preserved": True,
        "positions_restored": True
    }

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "ResQAI"
    }


# ============================================================
# INCIDENT ANALYSIS
# ============================================================

@app.post("/api/incidents/analyze")
def analyze(req: IncidentAnalyzeRequest):

    if not req.description or not req.description.strip():
        raise HTTPException(
            status_code=400,
            detail="Emergency description is required."
        )

    ai = analyze_incident(
        req.description,
        req.location,
        req.people_affected
    )

    factors = ai.pop("_factors", {})

    priority = calculate_priority(
        ai["life_threatening"],
        ai["people_affected"],
        factors.get("severity_factor", 30),
        factors.get("escalation_risk", 25),
        factors.get("time_sensitivity", 30),
        factors.get("location_sensitivity", 30)
    )

    ai.update(priority)

    # The deterministic priority engine is the final authority.
    ai["severity_score"] = priority["priority_score"]

    return ai


# ============================================================
# CREATE INCIDENT
# ============================================================

@app.post("/api/incidents")
def create_incident(
    req: IncidentCreate,
    db: Session = Depends(get_db)
):

    now = datetime.utcnow()

    x = Incident(
        **req.model_dump(),
        created_at=now,
        updated_at=now
    )

    db.add(x)
    db.commit()
    db.refresh(x)

    return incident_dict(x)


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@app.get("/api/incidents")
def incidents(
    db: Session = Depends(get_db)
):

    records = (
        db.query(Incident)
        .order_by(
            Incident.priority_score.desc(),
            Incident.id.asc()
        )
        .all()
    )

    return [
        incident_dict(x)
        for x in records
    ]


# ============================================================
# GET SINGLE INCIDENT
# ============================================================

@app.get("/api/incidents/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):

    x = db.get(Incident, incident_id)

    if not x:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return incident_dict(x)


# ============================================================
# UPDATE INCIDENT
# ============================================================

@app.put("/api/incidents/{incident_id}")
def update_incident(
    incident_id: int,
    payload: dict,
    db: Session = Depends(get_db)
):

    x = db.get(Incident, incident_id)

    if not x:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    allowed_fields = {
        "description",
        "incident_type",
        "severity",
        "severity_score",
        "priority",
        "priority_score",
        "people_affected",
        "latitude",
        "longitude",
        "status"
    }

    for key, value in payload.items():

        if key in allowed_fields:
            setattr(x, key, value)

    x.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(x)

    return incident_dict(x)


# ============================================================
# RESOURCE MANAGEMENT
# ============================================================

@app.get("/api/resources")
def resources(
    db: Session = Depends(get_db)
):
    # Advance real OSRM-backed demo movement before returning coordinates.
    advance_resource_movement(db, Resource, Incident)

    # Keep the old 90-second fallback only for BUSY resources that are
    # not currently moving.
    _release_due_resources(db)

    result = []

    for resource in db.query(Resource).all():
        item = resource_dict(resource)

        item["release_in_seconds"] = (
            _resource_release_seconds(resource)
            if str(resource.status or "").upper() == "BUSY"
            and resource.resource_id not in MOVEMENTS
            else None
        )

        item["movement"] = public_movement(
            resource.resource_id,
            resource
        )

        result.append(item)

    return result


@app.post("/api/resources")
def add_resource(
    req: ResourceCreate,
    db: Session = Depends(get_db)
):

    x = Resource(
        **req.model_dump()
    )

    db.add(x)
    db.commit()
    db.refresh(x)

    return resource_dict(x)


# ============================================================
# UPDATE RESOURCE
# ============================================================

@app.put("/api/resources/{resource_id}")
def update_resource(
    resource_id: int,
    payload: dict,
    db: Session = Depends(get_db)
):

    x = db.get(Resource, resource_id)

    if not x:
        raise HTTPException(
            status_code=404,
            detail="Resource not found"
        )

    allowed_fields = {
        "resource_id",
        "resource_type",
        "status",
        "latitude",
        "longitude",
        "capacity",
        "capabilities",
        "current_incident_id"
    }

    for key, value in payload.items():

        if key in allowed_fields:
            setattr(x, key, value)

    db.commit()
    db.refresh(x)

    return resource_dict(x)


# ============================================================
# RESOURCE ALLOCATION
# ============================================================

@app.post("/api/resources/allocate")
async def allocate_resources(
    req: AllocationRequest,
    db: Session = Depends(get_db)
):

    incident = db.get(
        Incident,
        req.incident_id
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    priority = str(
        incident.priority or "P4"
    ).upper()

    if priority in {"P1", "P2"}:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Direct allocation is disabled for {priority}. "
                "Human approval is required from the Human Verification queue."
            )
        )

    # Re-analyze the incident so resource requirements
    # remain consistent with the current description.
    ai = analyze_incident(
        incident.description,
        None,
        incident.people_affected
    )

    required_resources = ai.get(
        "required_resources",
        []
    )

    if not required_resources:
        return {
            "incident_id": incident.id,
            "recommendations": [],
            "message": "No resource requirement identified."
        }

    all_resources = (
        db.query(Resource)
        .all()
    )

    recommendations = allocate(
        incident,
        all_resources,
        required_resources
    )

    # Important:
    # Only mark the incident RESOURCE_ASSIGNED
    # if at least one resource was actually matched.
    if not recommendations:

        return {
            "incident_id": incident.id,
            "recommendations": [],
            "message": (
                "No suitable AVAILABLE resources "
                "were found for this incident."
            )
        }

    assigned_count = 0

    for recommendation in recommendations:

        resource = (
            db.query(Resource)
            .filter(
                Resource.resource_id
                == recommendation["resource_id"]
            )
            .first()
        )

        if not resource:
            continue

        # Safety check: never assign a non-available resource.
        if str(resource.status).upper() != "AVAILABLE":
            continue

        assignment = Assignment(
            incident_id=incident.id,
            resource_id=resource.resource_id,
            reason=recommendation["reason"]
        )

        db.add(assignment)

        resource.status = "BUSY"
        resource.current_incident_id = incident.id

        assigned_count += 1

    if assigned_count == 0:

        db.rollback()

        return {
            "incident_id": incident.id,
            "recommendations": [],
            "message": (
                "No suitable AVAILABLE resources "
                "were found for this incident."
            )
        }

    incident.status = "RESOURCE_ASSIGNED"
    incident.updated_at = datetime.utcnow()

    db.commit()

    movement_results = []

    for resource_id in [
        recommendation["resource_id"]
        for recommendation in recommendations
    ]:
        resource = (
            db.query(Resource)
            .filter(
                Resource.resource_id == resource_id
            )
            .first()
        )

        if not resource:
            continue

        try:
            movement_results.append(
                await _start_resource_movement(
                    resource,
                    incident,
                    db,
                )
            )
        except Exception as movement_error:
            movement_results.append({
                "resource_id": resource_id,
                "started": False,
                "error": str(movement_error),
            })

    return {
        "incident_id": incident.id,
        "recommendations": recommendations,
        "movement": movement_results,
        "message": (
            f"{assigned_count} resource(s) assigned successfully."
        )
    }


# ============================================================
# RESET ALL RESOURCES
# ============================================================

@app.post("/api/resources/reset")
def reset_resources(
    db: Session = Depends(get_db)
):
    result = _reset_demo_state(db)

    return {
        "message": "All resources reset to AVAILABLE.",
        "count": result["resources_reset"],
        "incidents_reset": result["incidents_reset"],
        "audit_history_preserved": True
    }


@app.post("/api/demo/reset")
def reset_demo(
    db: Session = Depends(get_db)
):
    return _reset_demo_state(db)


# ============================================================
# ROUTE DATA / ROUTING COMPATIBILITY
# ============================================================

def _current_route_hazards(db: Session):
    return [
        hazard_dict(x)
        for x in db.query(Hazard).all()
    ]


def _historical_route_hazards(db: Session):
    rows = db.query(DatasetHazard).all()

    return [
        {
            "source_id": x.source_id,
            "hazard_type": x.hazard_type,
            "type": x.hazard_type,
            "severity": x.severity,
            "latitude": x.latitude,
            "longitude": x.longitude,
            "source": "historical",
        }
        for x in rows
    ]


async def _recommend_route_compatible(
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    db: Session,
):
    """
    Calls the installed route_engine with either its current six-argument
    signature or the older five-argument signature. This prevents the
    movement feature from breaking SafeRoute when an older route_engine.py
    is still present.
    """
    hazards = _current_route_hazards(db)
    historical = _historical_route_hazards(db)

    parameter_count = len(
        inspect.signature(recommend_route).parameters
    )

    if parameter_count >= 6:
        return await recommend_route(
            origin_lat,
            origin_lon,
            destination_lat,
            destination_lon,
            hazards,
            historical,
        )

    return await recommend_route(
        origin_lat,
        origin_lon,
        destination_lat,
        destination_lon,
        hazards,
    )


@app.post("/api/routes/recommend")
async def route(
    req: RouteRequest,
    db: Session = Depends(get_db)
):
    try:
        return await _recommend_route_compatible(
            req.origin_lat,
            req.origin_lon,
            req.destination_lat,
            req.destination_lon,
            db,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Route recommendation failed: {str(e)}"
        )


# ============================================================
# LIVE RESOURCE MOVEMENT
# ============================================================

async def _start_resource_movement(
    resource: Resource,
    incident: Incident,
    db: Session,
):
    """
    Start outbound movement from the resource's FIXED DEMO IDLE POSITION
    to the incident.

    Important:
    The database coordinates may contain the last incident location.
    For the demo, outbound movement must ALWAYS start from the resource's
    configured idle position.
    """

    resource_id = resource.resource_id

    # --------------------------------------------------------
    # Already moving?
    # --------------------------------------------------------

    if resource_id in MOVEMENTS:
        return {
            "resource_id": resource_id,
            "started": True,
            "already_active": True,
            "movement": public_movement(
                resource_id,
                resource
            ),
        }

    # --------------------------------------------------------
    # Validate resource state
    # --------------------------------------------------------

    if str(resource.status or "").upper() != "BUSY":
        return {
            "resource_id": resource_id,
            "started": False,
            "error": "Resource is not BUSY."
        }

    if resource.current_incident_id != incident.id:
        return {
            "resource_id": resource_id,
            "started": False,
            "error": "Resource is not assigned to this incident."
        }

    if incident.latitude is None or incident.longitude is None:
        return {
            "resource_id": resource_id,
            "started": False,
            "error": "Incident coordinates are missing."
        }

    # --------------------------------------------------------
    # IMPORTANT FIX
    # --------------------------------------------------------
    # Always use the configured idle position as the outbound
    # starting point.
    #
    # This prevents a resource that previously reached an
    # incident from starting its next dispatch at the old
    # incident location.
    # --------------------------------------------------------

    idle_position = DEMO_IDLE_POSITIONS.get(resource_id)

    if idle_position:
        origin_lat = float(idle_position[0])
        origin_lon = float(idle_position[1])

        # Restore the database coordinates to the idle position
        # BEFORE requesting the route.
        resource.latitude = origin_lat
        resource.longitude = origin_lon

    else:
        # Fallback for any future resource not in the demo list.
        if resource.latitude is None or resource.longitude is None:
            return {
                "resource_id": resource_id,
                "started": False,
                "error": "Resource coordinates are missing."
            }

        origin_lat = float(resource.latitude)
        origin_lon = float(resource.longitude)

    destination_lat = float(incident.latitude)
    destination_lon = float(incident.longitude)

    # --------------------------------------------------------
    # Request OSRM/SafeRoute route
    # --------------------------------------------------------

    route_result = await _recommend_route_compatible(
        origin_lat,
        origin_lon,
        destination_lat,
        destination_lon,
        db,
    )

    routes = route_result.get("routes", []) or []

    selected_route = next(
        (
            route
            for route in routes
            if route.get("recommended")
            and isinstance(route.get("geometry"), list)
            and len(route.get("geometry")) >= 2
        ),
        None,
    )

    if selected_route is None:
        selected_route = next(
            (
                route
                for route in routes
                if isinstance(route.get("geometry"), list)
                and len(route.get("geometry")) >= 2
            ),
            None,
        )

    if selected_route is None:
        return {
            "resource_id": resource_id,
            "started": False,
            "error": (
                "No usable OSRM road geometry was returned. "
                "SafeRoute must return geometry before movement can start."
            ),
            "route_source": route_result.get(
                "source",
                "UNKNOWN"
            ),
        }

    geometry = selected_route["geometry"]

    # --------------------------------------------------------
    # Calculate demo movement duration
    # --------------------------------------------------------

    osrm_seconds = (
        float(
            selected_route.get(
                "duration_min",
                0
            ) or 0
        )
        * 60.0
    )

    duration_seconds = max(
        MIN_SECONDS,
        osrm_seconds * TIME_SCALE,
    )

    distance_m = total_distance_m(geometry)

    # --------------------------------------------------------
    # Register movement
    # --------------------------------------------------------

    MOVEMENTS[resource_id] = {
        "resource_id": resource_id,
        "incident_id": incident.id,

        # Movement phase
        "phase": "OUTBOUND",

        "geometry": geometry,

        "route_id": selected_route.get(
            "route_id"
        ),

        "route_source": route_result.get(
            "source",
            "OSRM",
        ),

        # TRUE idle origin
        "origin_lat": origin_lat,
        "origin_lon": origin_lon,

        # Incident destination
        "destination_lat": destination_lat,
        "destination_lon": destination_lon,

        # Save idle position for return journey
        "idle_lat": origin_lat,
        "idle_lon": origin_lon,

        "distance_m": distance_m,

        "duration_seconds": duration_seconds,

        "started_at": __import__(
            "time"
        ).time(),

        "returning_to_idle": False,
    }

    # --------------------------------------------------------
    # Incident lifecycle
    # --------------------------------------------------------

    if str(
        incident.status or ""
    ).upper() in {
        "NEW",
        "RESOURCE_ASSIGNED",
    }:
        incident.status = "RESPONDING"

    incident.updated_at = datetime.utcnow()

    db.commit()

    return {
        "resource_id": resource_id,
        "started": True,
        "already_active": False,
        "incident_id": incident.id,
        "phase": "OUTBOUND",
        "status": "EN_ROUTE",
        "route_source": route_result.get(
            "source",
            "OSRM",
        ),
        "route_id": selected_route.get(
            "route_id"
        ),
        "distance_km": round(
            distance_m / 1000.0,
            3,
        ),
        "osrm_duration_min": selected_route.get(
            "duration_min"
        ),
        "demo_duration_seconds": round(
            duration_seconds,
            1,
        ),
        "geometry_points": len(
            geometry
        ),
        "origin": {
            "latitude": origin_lat,
            "longitude": origin_lon,
        },
        "destination": {
            "latitude": destination_lat,
            "longitude": destination_lon,
        },
        "movement": public_movement(
            resource_id,
            resource
        ),
    }

@app.post("/api/resources/{resource_id}/start-movement")
async def start_resource_movement(
    resource_id: str,
    db: Session = Depends(get_db),
):
    advance_resource_movement(
        db,
        Resource,
        Incident,
    )

    resource = (
        db.query(Resource)
        .filter(
            Resource.resource_id == resource_id
        )
        .first()
    )

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Resource not found",
        )

    if str(resource.status or "").upper() != "BUSY":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Resource {resource_id} must be BUSY "
                "before movement starts."
            ),
        )

    if not resource.current_incident_id:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Resource {resource_id} has no "
                "current incident assignment."
            ),
        )

    incident = db.get(
        Incident,
        resource.current_incident_id,
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Assigned incident not found",
        )

    result = await _start_resource_movement(
        resource,
        incident,
        db,
    )

    if not result.get("started"):
        raise HTTPException(
            status_code=502,
            detail=result.get(
                "error",
                "Unable to start resource movement.",
            ),
        )

    return result


@app.get("/api/resources/{resource_id}/movement")
def get_resource_movement(
    resource_id: str,
    db: Session = Depends(get_db),
):
    advance_resource_movement(
        db,
        Resource,
        Incident,
    )

    resource = (
        db.query(Resource)
        .filter(
            Resource.resource_id == resource_id
        )
        .first()
    )

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Resource not found",
        )

    movement = public_movement(
        resource_id,
        resource,
    )

    if movement:
        return movement

    return {
        "active": False,
        "resource_id": resource_id,
        "status": resource.status,
        "incident_id": resource.current_incident_id,
        "latitude": resource.latitude,
        "longitude": resource.longitude,
    }


@app.post("/api/resources/{resource_id}/release")
def release_resource(
    resource_id: str,
    db: Session = Depends(get_db),
):
    advance_resource_movement(
        db,
        Resource,
        Incident,
    )

    resource = (
        db.query(Resource)
        .filter(
            Resource.resource_id == resource_id
        )
        .first()
    )

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Resource not found",
        )

    incident_id = resource.current_incident_id

    resource.status = "AVAILABLE"
    resource.current_incident_id = None

    MOVEMENTS.pop(
        resource_id,
        None,
    )

    if incident_id:
        incident = db.get(
            Incident,
            incident_id,
        )

        if incident:
            remaining_busy = (
                db.query(Resource)
                .filter(
                    Resource.current_incident_id == incident_id,
                    Resource.status == "BUSY",
                )
                .count()
            )

            if remaining_busy == 0:
                incident.status = "RESOLVED"

            incident.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Resource released successfully.",
        "resource_id": resource_id,
        "released_from_incident_id": incident_id,
        "status": "AVAILABLE",
    }


# ============================================================
# HAZARDS
# ============================================================

@app.get("/api/hazards")
def hazards(
    db: Session = Depends(get_db)
):

    records = db.query(Hazard).all()

    return [
        hazard_dict(x)
        for x in records
    ]


# ============================================================
# ADD HAZARD
# ============================================================

@app.post("/api/hazards")
def add_hazard(
    req: HazardCreate,
    db: Session = Depends(get_db)
):

    x = Hazard(
        **req.model_dump()
    )

    db.add(x)
    db.commit()
    db.refresh(x)

    return hazard_dict(x)


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.get("/api/dashboard/stats")
def stats(
    db: Session = Depends(get_db)
):

    incidents_data = (
        db.query(Incident)
        .all()
    )

    resources_data = (
        db.query(Resource)
        .all()
    )

    total_incidents = len(
        incidents_data
    )

    active_incidents = sum(
        1
        for x in incidents_data
        if str(x.status).upper() != "RESOLVED"
    )

    critical_incidents = sum(
        1
        for x in incidents_data
        if str(x.priority).upper() == "P1"
    )

    available_resources = sum(
        1
        for x in resources_data
        if str(x.status).upper() == "AVAILABLE"
    )

    deployed_resources = sum(
        1
        for x in resources_data
        if str(x.status).upper() == "BUSY"
    )

    return {
        "active_incidents": active_incidents,
        "critical_incidents": critical_incidents,
        "available_resources": available_resources,
        "deployed_resources": deployed_resources,
        "total_incidents": total_incidents,
        "avg_response_eta": 9.2
    }


# ============================================================
# AI ASSISTANT
# ============================================================

@app.post("/api/ai/query")
def ai_query(
    req: AIQuery,
    db: Session = Depends(get_db)
):

    q = (
        req.question
        .lower()
        .strip()
    )

    incidents_data = (
        db.query(Incident)
        .all()
    )

    resources_data = (
        db.query(Resource)
        .all()
    )

    hazards_data = (
        db.query(Hazard)
        .all()
    )


    # ========================================================
    # 1. CRITICAL / IMMEDIATE ATTENTION
    # ========================================================

    if (
        "immediate attention" in q
        or "critical incidents" in q
        or "critical incident" in q
        or "urgent incidents" in q
        or "urgent incident" in q
        or "require immediate" in q
    ):

        critical = [
            x
            for x in incidents_data
            if str(x.priority).upper() == "P1"
        ]

        critical.sort(
            key=lambda x: (
                getattr(
                    x,
                    "priority_score",
                    0
                ) or 0
            ),
            reverse=True
        )

        if not critical:

            return {
                "answer": (
                    "There are currently no "
                    "P1 critical incidents."
                )
            }

        new_incidents = [
            x
            for x in critical
            if str(x.status).upper() == "NEW"
        ]

        assigned_incidents = [
            x
            for x in critical
            if str(x.status).upper()
            == "RESOURCE_ASSIGNED"
        ]

        other_critical = [
            x
            for x in critical
            if (
                str(x.status).upper()
                not in {
                    "NEW",
                    "RESOURCE_ASSIGNED"
                }
            )
        ]

        lines = [
            f"{len(critical)} critical incident(s) "
            "require immediate human attention:"
        ]

        if new_incidents:

            lines.append("")
            lines.append(
                "NEW / awaiting resource assignment:"
            )

            for x in new_incidents:

                lines.append(
                    f"INC-{x.id:03d}: "
                    f"{x.incident_type} - "
                    f"P1 ({x.priority_score}/100), "
                    f"status: {x.status}"
                )

        if assigned_incidents:

            lines.append("")
            lines.append(
                "Already resource assigned:"
            )

            for x in assigned_incidents:

                lines.append(
                    f"INC-{x.id:03d}: "
                    f"{x.incident_type} - "
                    f"P1 ({x.priority_score}/100), "
                    f"status: {x.status}"
                )

        if other_critical:

            lines.append("")
            lines.append(
                "Other critical incidents:"
            )

            for x in other_critical:

                lines.append(
                    f"INC-{x.id:03d}: "
                    f"{x.incident_type} - "
                    f"P1 ({x.priority_score}/100), "
                    f"status: {x.status}"
                )

        lines.append("")
        lines.append(
            "Human verification is required "
            "before dispatch decisions."
        )

        return {
            "answer": "\n".join(lines)
        }


    # ========================================================
    # 2. HIGHEST PRIORITY INCIDENT
    # ========================================================

    if (
        (
            "which incident" in q
            and "first" in q
        )
        or "handle first" in q
        or "highest priority" in q
        or "highest priority incident" in q
        or "most urgent incident" in q
        or "which incident should be handled first" in q
    ):

        if not incidents_data:

            return {
                "answer":
                "No incidents are currently available."
            }

        x = max(
            incidents_data,
            key=lambda z: (
                getattr(
                    z,
                    "priority_score",
                    0
                ) or 0
            )
        )

        return {
            "answer": (
                f"INC-{x.id:03d} should be handled first "
                f"based on the current priority score: "
                f"{x.incident_type} - "
                f"{x.priority} "
                f"({x.priority_score}/100). "
                f"Status: {x.status}. "
                f"Human verification is required."
            )
        }


    # ========================================================
    # 3. AVAILABLE AMBULANCES
    # ========================================================

    if (
        "ambulance" in q
        and (
            "available" in q
            or "free" in q
        )
    ):

        available = [
            r
            for r in resources_data
            if (
                str(r.resource_type).lower()
                == "ambulance"
                and
                str(r.status).upper()
                == "AVAILABLE"
            )
        ]

        if not available:

            return {
                "answer":
                "No ambulance is currently available."
            }

        lines = [
            f"{len(available)} ambulance(s) "
            "are currently available:"
        ]

        for r in available:

            lines.append(
                f"{r.resource_id} - "
                f"capacity {r.capacity}, "
                f"capabilities: "
                f"{r.capabilities}"
            )

        return {
            "answer": "\n".join(lines)
        }


    # ========================================================
    # 4. AVAILABLE RESOURCES
    # ========================================================

    if (
        "available resources" in q
        or "resources available" in q
        or "what resources are available" in q
        or "free resources" in q
    ):

        available = [
            r
            for r in resources_data
            if str(r.status).upper()
            == "AVAILABLE"
        ]

        if not available:

            return {
                "answer":
                "No resources are currently available."
            }

        lines = [
            f"{len(available)} resource(s) "
            "are currently available:"
        ]

        for r in available:

            lines.append(
                f"{r.resource_id} - "
                f"{r.resource_type}, "
                f"capacity {r.capacity}, "
                f"capabilities: "
                f"{r.capabilities}"
            )

        return {
            "answer": "\n".join(lines)
        }


    # ========================================================
    # 5. DEPLOYED / BUSY RESOURCES
    # ========================================================

    if (
        "deployed resources" in q
        or "busy resources" in q
        or "assigned resources" in q
        or "resources deployed" in q
        or "currently deployed" in q
        or "currently busy" in q
        or "what resources are currently deployed" in q
    ):

        # IMPORTANT:
        # Only BUSY resources are considered deployed.
        # OFFLINE and MAINTENANCE are NOT deployed.
        deployed = [
            r
            for r in resources_data
            if str(r.status).upper() == "BUSY"
        ]

        if not deployed:

            return {
                "answer":
                "No resources are currently deployed."
            }

        lines = [
            f"{len(deployed)} resource(s) "
            "are currently deployed:"
        ]

        for r in deployed:

            if r.current_incident_id:

                assignment = (
                    f"INC-{r.current_incident_id:03d}"
                )

            else:

                assignment = (
                    "No incident ID recorded"
                )

            lines.append(
                f"{r.resource_id} - "
                f"{r.resource_type}, "
                f"status: BUSY, "
                f"assignment: {assignment}"
            )

        return {
            "answer": "\n".join(lines)
        }


    # ========================================================
    # 6. HAZARDS
    # ========================================================

    if (
        "hazards" in q
        or "hazard" in q
        or "dangerous areas" in q
        or "reported hazards" in q
    ):

        if not hazards_data:

            return {
                "answer":
                "No hazards are currently recorded."
            }

        lines = [
            f"{len(hazards_data)} hazard(s) "
            "are currently recorded:"
        ]

        for h in hazards_data:

            lines.append(
                f"{h.hazard_type} - "
                f"{h.severity}, "
                f"location: "
                f"{h.latitude}, "
                f"{h.longitude}"
            )

        return {
            "answer": "\n".join(lines)
        }


    # ========================================================
    # 7. INCIDENT COUNT
    # ========================================================

    if (
        "how many incidents" in q
        or "total incidents" in q
        or "number of incidents" in q
        or "how many active incidents" in q
    ):

        active_count = sum(
            1
            for x in incidents_data
            if str(x.status).upper()
            != "RESOLVED"
        )

        return {
            "answer": (
                f"There are currently "
                f"{len(incidents_data)} incidents "
                f"in the system, of which "
                f"{active_count} are active."
            )
        }


    # ========================================================
    # 8. CRITICAL INCIDENT COUNT
    # ========================================================

    if (
        "how many critical" in q
        or "critical count" in q
        or "number of critical" in q
    ):

        critical_count = sum(
            1
            for x in incidents_data
            if str(x.priority).upper()
            == "P1"
        )

        return {
            "answer": (
                f"There are currently "
                f"{critical_count} critical "
                f"P1 incident(s)."
            )
        }


    # ========================================================
    # 9. RESOURCE COUNT
    # ========================================================

    if (
        "how many resources" in q
        or "total resources" in q
        or "number of resources" in q
    ):

        available_count = sum(
            1
            for r in resources_data
            if str(r.status).upper()
            == "AVAILABLE"
        )

        busy_count = sum(
            1
            for r in resources_data
            if str(r.status).upper()
            == "BUSY"
        )

        offline_count = sum(
            1
            for r in resources_data
            if str(r.status).upper()
            == "OFFLINE"
        )

        maintenance_count = sum(
            1
            for r in resources_data
            if str(r.status).upper()
            == "MAINTENANCE"
        )

        return {
            "answer": (
                f"There are "
                f"{len(resources_data)} total resources: "
                f"{available_count} available, "
                f"{busy_count} deployed, "
                f"{offline_count} offline, "
                f"and {maintenance_count} "
                f"in maintenance."
            )
        }


    # ========================================================
    # 10. SPECIFIC INCIDENT
    # ========================================================

    for x in incidents_data:

        incident_id = (
            f"inc-{x.id:03d}"
        )

        if (
            incident_id in q
            or f"incident {x.id}" in q
        ):

            return {
                "answer": (
                    f"INC-{x.id:03d}: "
                    f"{x.incident_type}. "
                    f"Priority: {x.priority} "
                    f"({x.priority_score}/100). "
                    f"Severity: {x.severity}. "
                    f"People affected: "
                    f"{x.people_affected}. "
                    f"Status: {x.status}. "
                    f"Description: "
                    f"{x.description}"
                )
            }


    # ========================================================
    # 11. FALLBACK
    # ========================================================

    return {
        "answer": (
            "I can answer questions using current "
            "ResQAI data. Try asking about critical "
            "incidents, the highest-priority incident, "
            "available ambulances, available resources, "
            "deployed resources, hazards, incident counts, "
            "resource counts, or a specific incident "
            "such as INC-013."
        )
    }


# ============================================================
# RESPONSE SERIALIZERS
# ============================================================

def incident_dict(x):

    return {
        "id": x.id,
        "description": x.description,
        "incident_type": x.incident_type,
        "severity": x.severity,
        "severity_score": x.severity_score,
        "priority": x.priority,
        "priority_score": x.priority_score,
        "people_affected": x.people_affected,
        "latitude": x.latitude,
        "longitude": x.longitude,
        "status": x.status,
        "created_at": (
            x.created_at.isoformat()
            if x.created_at
            else None
        ),
        "updated_at": (
            x.updated_at.isoformat()
            if x.updated_at
            else None
        )
    }


def resource_dict(x):

    return {
        "id": x.id,
        "resource_id": x.resource_id,
        "resource_type": x.resource_type,
        "status": x.status,
        "latitude": x.latitude,
        "longitude": x.longitude,
        "capacity": x.capacity,
        "capabilities": x.capabilities,
        "current_incident_id":
            x.current_incident_id
    }


def hazard_dict(x):

    return {
        "id": x.id,
        "hazard_type": x.hazard_type,
        "description": x.description,
        "latitude": x.latitude,
        "longitude": x.longitude,
        "severity": x.severity
    }
    
# ============================================================
# HISTORICAL DATASET API
# ============================================================

@app.get("/api/dataset/stats")
def dataset_stats(db: Session = Depends(get_db)):

    incident_total = (
        db.query(DatasetIncident)
        .count()
    )

    hazard_total = (
        db.query(DatasetHazard)
        .count()
    )

    severity_rows = (
        db.query(
            DatasetIncident.severity,
            func.count(DatasetIncident.id)
        )
        .group_by(
            DatasetIncident.severity
        )
        .all()
    )

    type_rows = (
        db.query(
            DatasetIncident.incident_type,
            func.count(DatasetIncident.id)
        )
        .group_by(
            DatasetIncident.incident_type
        )
        .order_by(
            func.count(
                DatasetIncident.id
            ).desc()
        )
        .all()
    )

    return {
        "dataset_incidents": incident_total,
        "dataset_hazards": hazard_total,

        "severity_distribution": {
            str(severity): count
            for severity, count in severity_rows
        },

        "incident_categories": {
            str(incident_type): count
            for incident_type, count in type_rows
        }
    }


# ============================================================
# HISTORICAL INCIDENT DATA
# ============================================================

@app.get("/api/dataset/incidents")
def dataset_incidents(
    limit: int = 100,
    offset: int = 0,
    location: str | None = None,
    incident_type: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db)
):

    limit = max(
        1,
        min(limit, 500)
    )

    query = db.query(
        DatasetIncident
    )

    if location:
        query = query.filter(
            DatasetIncident.location == location
        )

    if incident_type:
        query = query.filter(
            DatasetIncident.incident_type == incident_type
        )

    if severity:
        query = query.filter(
            DatasetIncident.severity == severity
        )

    rows = (
        query
        .order_by(
            DatasetIncident.id
        )
        .offset(
            max(0, offset)
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "id": x.id,
            "source_id": x.source_id,
            "incident_type": x.incident_type,
            "severity": x.severity,
            "priority": x.priority_label,
            "people_affected": x.people_affected,
            "description": x.description,
            "location": x.location
        }
        for x in rows
    ]


# ============================================================
# HISTORICAL HAZARD DATA
# ============================================================

@app.get("/api/dataset/hazards")
def dataset_hazards(
    limit: int = 500,
    offset: int = 0,
    hazard_type: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db)
):

    limit = max(
        1,
        min(limit, 1000)
    )

    query = db.query(
        DatasetHazard
    )

    if hazard_type:
        query = query.filter(
            DatasetHazard.hazard_type == hazard_type
        )

    if severity:
        query = query.filter(
            DatasetHazard.severity == severity
        )

    rows = (
        query
        .order_by(
            DatasetHazard.id
        )
        .offset(
            max(0, offset)
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "id": x.id,
            "source_id": x.source_id,
            "hazard_type": x.hazard_type,
            "severity": x.severity,
            "latitude": x.latitude,
            "longitude": x.longitude
        }
        for x in rows
    ]

def _recommendation_haversine_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None

    from math import radians, sin, cos, atan2, sqrt

    R = 6371.0
    dlat = radians(float(lat2) - float(lat1))
    dlon = radians(float(lon2) - float(lon1))

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(float(lat1)))
        * cos(radians(float(lat2)))
        * sin(dlon / 2) ** 2
    )

    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _build_resource_recommendations(incident, db):
    advance_resource_movement(db, Resource, Incident)
    advance_resource_movement(db, Resource, Incident)
    _release_due_resources(db)

    ai = analyze_incident(
        incident.description,
        None,
        incident.people_affected
    )

    required_resources = ai.get("required_resources", []) or []

    all_resources = db.query(Resource).all()

    # IMPORTANT: allocate() returns recommendations but does not mutate
    # resource status. This endpoint is therefore safe to call repeatedly.
    recommendations = allocate(
        incident,
        all_resources,
        required_resources
    )

    recommendation_by_id = {
        x["resource_id"]: x
        for x in recommendations
    }

    result = []

    for resource in all_resources:
        if str(resource.status).upper() != "AVAILABLE":
            continue

        matched = recommendation_by_id.get(resource.resource_id)

        if not matched:
            continue

        distance = _recommendation_haversine_km(
            incident.latitude,
            incident.longitude,
            resource.latitude,
            resource.longitude
        )

        result.append({
            "resource_id": resource.resource_id,
            "resource_type": resource.resource_type,
            "status": resource.status,
            "available": True,
            "capacity": resource.capacity,
            "capabilities": resource.capabilities,
            "distance_km": round(distance, 2) if distance is not None else None,
            "recommended": True,
            "reason": matched["reason"]
        })

    return ai, required_resources, result


@app.get("/api/incidents/{incident_id}/recommendations")
def incident_recommendations(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = db.get(Incident, incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    ai, required_resources, resources = _build_resource_recommendations(
        incident,
        db
    )

    # Historical hazards are optional. If the historical dataset models
    # are available, use nearby records. Otherwise return a clean zero signal.
    nearby_hazards = 0
    nearby_high_critical = 0

    try:
        from dataset_models import DatasetHazard

        if incident.latitude is not None and incident.longitude is not None:
            rows = db.query(DatasetHazard).all()

            for row in rows:
                distance = _recommendation_haversine_km(
                    incident.latitude,
                    incident.longitude,
                    row.latitude,
                    row.longitude
                )

                # ~3 km radius around the operational incident.
                if distance is not None and distance <= 3.0:
                    nearby_hazards += 1

                    severity = str(row.severity or "").upper()
                    if severity in {"HIGH", "CRITICAL"}:
                        nearby_high_critical += 1

    except Exception:
        # Historical dataset is supplementary. It must never break
        # the live operational recommendation flow.
        pass

    reasoning = []

    if ai.get("life_threatening"):
        reasoning.append("Life-threatening condition detected.")

    if incident.people_affected:
        reasoning.append(
            f"{incident.people_affected} people affected."
        )

    reasoning.append(
        f"Incident classified as {incident.incident_type}."
    )

    if required_resources:
        reasoning.append(
            "Required resources were extracted from the incident analysis."
        )
    else:
        reasoning.append(
            "No specific resource requirement was identified."
        )

    if resources:
        reasoning.append(
            "Only currently AVAILABLE resources were considered."
        )
    else:
        reasoning.append(
            "No suitable AVAILABLE resource is currently matched."
        )

    if nearby_high_critical:
        reasoning.append(
            f"{nearby_high_critical} nearby historical high/critical hazard "
            "records increase the local risk signal."
        )

    operational = []

    incident_type = str(incident.incident_type or "").lower()

    if "road" in incident_type or "traffic" in incident_type:
        operational.append(
            "Consider traffic-control support if access or road flow is obstructed."
        )

    if "fire" in incident_type or "gas" in incident_type:
        operational.append(
            "Confirm responder access and avoid unnecessary exposure to the active hazard."
        )

    if "flood" in incident_type or "water" in incident_type:
        operational.append(
            "Prefer routes with lower current and historical flood exposure."
        )

    if "medical" in incident_type:
        operational.append(
            "Prioritize medical assessment and confirm ambulance availability."
        )

    if "collapse" in incident_type or "rescue" in incident_type:
        operational.append(
            "Confirm structural-safety conditions before committing responders."
        )

    if not operational:
        operational.append(
            "Dispatcher should verify the situation and resource suitability before dispatch."
        )

    if nearby_hazards:
        historical_summary = (
            f"{nearby_hazards} historical hazard record(s) were found "
            f"within approximately 3 km; {nearby_high_critical} were high/critical."
        )
    else:
        historical_summary = (
            "No nearby historical hazard records were found in the imported dataset."
        )

    return {
        "incident_id": incident.id,
        "incident": {
            "id": incident.id,
            "type": incident.incident_type,
            "severity": incident.severity,
            "priority": incident.priority,
            "priority_score": incident.priority_score,
            "people_affected": incident.people_affected,
            "status": incident.status
        },
        "priority": {
            "priority": incident.priority,
            "score": incident.priority_score,
            "severity": incident.severity
        },
        "required_resources": required_resources,
        "resources": resources,
        "reasoning": reasoning,
        "operational_recommendations": operational,
        "historical": {
            "nearby_hazards": nearby_hazards,
            "nearby_high_critical": nearby_high_critical,
            "summary": historical_summary
        },
        "human_verification_required": True
    }



@app.get("/api/incidents/{incident_id}/resource-availability")
def incident_resource_availability(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = db.get(
        Incident,
        incident_id
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    _release_due_resources(db)

    ai = analyze_incident(
        incident.description,
        None,
        incident.people_affected
    )

    required_resources = (
        ai.get("required_resources", [])
        or []
    )

    available = []
    busy = []
    unavailable = []

    for resource in db.query(Resource).all():
        matched = any(
            _resource_matches_requirement(
                resource,
                requirement
            )
            for requirement in required_resources
        )

        if not matched:
            continue

        status = str(
            resource.status or ""
        ).upper()

        item = {
            "resource_id": resource.resource_id,
            "resource_type": resource.resource_type,
            "status": resource.status,
            "current_incident_id": resource.current_incident_id,
            "capabilities": resource.capabilities,
            "release_in_seconds": (
                _resource_release_seconds(resource)
                if status == "BUSY"
                else None
            )
        }

        if status == "AVAILABLE":
            available.append(item)
        elif status == "BUSY":
            busy.append(item)
        else:
            unavailable.append(item)

    busy.sort(
        key=lambda x: (
            x["release_in_seconds"]
            if x["release_in_seconds"] is not None
            else 999999
        )
    )

    next_available = busy[0] if busy else None

    return {
        "incident_id": incident.id,
        "required_resources": required_resources,
        "available_count": len(available),
        "available_resources": available,
        "busy_resources": busy,
        "unavailable_resources": unavailable,
        "next_available": next_available,
        "message": (
            "Compatible resources are currently available."
            if available
            else (
                "No compatible responder is immediately available. "
                "BUSY resources remain unavailable until released."
            )
        )
    }


# ============================================================
# RISK-AWARE DISPATCH POLICY
# ============================================================

@app.get("/api/incidents/{incident_id}/dispatch-policy")
def incident_dispatch_policy(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    priority = str(incident.priority or "P4").upper()
    if priority in {"P1", "P2"}:
        return {
            "incident_id": incident.id,
            "priority": priority,
            "human_approval_required": True,
            "ai_auto_dispatch_allowed": False,
            "label": "HUMAN APPROVAL REQUIRED",
            "reason": "High-risk incidents require trained human authorization before dispatch."
        }

    return {
        "incident_id": incident.id,
        "priority": priority,
        "human_approval_required": False,
        "ai_auto_dispatch_allowed": True,
        "label": "AI AUTO-DISPATCH ELIGIBLE",
        "reason": "Lower-priority incidents may be dispatched automatically when compatible resources are available. Human override remains available."
    }


@app.post("/api/incidents/{incident_id}/auto-dispatch")
async def auto_dispatch_incident(incident_id: int, db: Session = Depends(get_db)):
    """Demo-mode automatic dispatch for P3/P4 only."""
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    priority = str(incident.priority or "P4").upper()
    if priority not in {"P3", "P4"}:
        raise HTTPException(
            status_code=403,
            detail=f"AI auto-dispatch is disabled for {priority}. Human approval is required."
        )

    if str(incident.status or "").upper() != "NEW":
        raise HTTPException(
            status_code=409,
            detail=f"Incident is {incident.status or 'ACTIVE'} and cannot be auto-dispatched again."
        )

    try:
        _, required_resources, recommendations = _build_resource_recommendations(
            incident,
            db
        )
    except NameError:
        raise HTTPException(
            status_code=500,
            detail="Recommendation engine is not installed. Install the human verification recommendation patch first."
        )

    selected_ids = [
        x["resource_id"]
        for x in recommendations
        if x.get("recommended")
        and x.get("available") is not False
        and str(x.get("status", "")).upper() == "AVAILABLE"
    ]

    if not selected_ids:
        raise HTTPException(
            status_code=409,
            detail="No compatible AVAILABLE resource is currently available. The incident remains NEW."
        )

    # Reuse the existing verification function so resource availability
    # checks and state changes remain centralized.
    result = await verify_incident_recommendation(
        incident_id,
        {
            "decision": "APPROVE",
            "resource_ids": selected_ids,
            "note": f"AI auto-dispatch executed in demo mode for {priority} incident."
        },
        db
    )

    return {
        "incident_id": incident.id,
        "priority": priority,
        "dispatch_mode": "AI_AUTO",
        "required_resources": required_resources,
        "assigned_resources": result.get("assigned_resources", []),
        "status": "RESOURCE_ASSIGNED",
        "message": "AI auto-dispatch completed for a lower-priority incident. Human override remains available."
    }


@app.post("/api/incidents/{incident_id}/verify")
async def verify_incident_recommendation(
    incident_id: int,
    payload: dict,
    db: Session = Depends(get_db)
):
    incident = db.get(Incident, incident_id)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    decision = str(
        payload.get("decision", "")
    ).upper().strip()

    resource_ids = payload.get(
        "resource_ids",
        []
    ) or []

    note = str(
        payload.get("note", "")
    ).strip()

    if decision not in {"APPROVE", "MODIFY", "REJECT"}:
        raise HTTPException(
            status_code=400,
            detail="Decision must be APPROVE, MODIFY, or REJECT."
        )

    if not isinstance(resource_ids, list):
        raise HTTPException(
            status_code=400,
            detail="resource_ids must be a list."
        )

    # REJECT: record the human decision without dispatching.
    if decision == "REJECT":
        incident.updated_at = datetime.utcnow()
        db.commit()

        return {
            "incident_id": incident.id,
            "decision": "REJECT",
            "assigned_resources": [],
            "message": (
                "Recommendation rejected. No resources were dispatched."
                + (f" Note: {note}" if note else "")
            )
        }

    if decision == "APPROVE" and not resource_ids:
        raise HTTPException(
            status_code=400,
            detail="APPROVE requires at least one selected resource."
        )

    # Only selected resource IDs are eligible.
    selected = []

    for resource_id in resource_ids:
        resource = (
            db.query(Resource)
            .filter(
                Resource.resource_id == str(resource_id)
            )
            .first()
        )

        if not resource:
            continue

        if str(resource.status).upper() != "AVAILABLE":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Resource {resource.resource_id} is no longer AVAILABLE."
                )
            )

        selected.append(resource)

    if decision == "MODIFY" and not selected:
        # A modification can intentionally result in no dispatch.
        incident.updated_at = datetime.utcnow()
        db.commit()

        return {
            "incident_id": incident.id,
            "decision": "MODIFY",
            "assigned_resources": [],
            "message": (
                "Modified recommendation recorded with no resource dispatch."
                + (f" Note: {note}" if note else "")
            )
        }

    assigned = []

    for resource in selected:
        assignment = Assignment(
            incident_id=incident.id,
            resource_id=resource.resource_id,
            reason=(
                "Human-verified ResQAI recommendation"
                + (f": {note}" if note else "")
            )
        )

        db.add(assignment)

        resource.status = "BUSY"
        resource.current_incident_id = incident.id

        DEMO_RESOURCE_RELEASES[
            resource.resource_id
        ] = (
            datetime.utcnow()
            + timedelta(
                seconds=DEMO_RESOURCE_RELEASE_SECONDS
            )
        )

        assigned.append(resource.resource_id)

    if assigned:
        incident.status = "RESOURCE_ASSIGNED"

    incident.updated_at = datetime.utcnow()

    db.commit()

    movement_results = []

    for resource in selected:
        try:
            movement_results.append(
                await _start_resource_movement(
                    resource,
                    incident,
                    db,
                )
            )
        except Exception as movement_error:
            movement_results.append({
                "resource_id": resource.resource_id,
                "started": False,
                "error": str(movement_error),
            })

    return {
        "incident_id": incident.id,
        "decision": decision,
        "assigned_resources": assigned,
        "status": incident.status,
        "incident": {
            "id": incident.id,
            "status": incident.status,
        },
        "movement": movement_results,
        "message": (
            f"{len(assigned)} resource(s) dispatched after human verification."
            + (f" Note: {note}" if note else "")
        )
    }

# ============================================================
# DISPATCH AUDIT TRAIL
# ============================================================

@app.post("/api/dispatch-audit")
def create_dispatch_audit(
    payload: dict,
    db: Session = Depends(get_db)
):

    decision = str(
        payload.get("decision", "")
    ).upper().strip()

    if decision not in {
        "APPROVE",
        "MODIFY",
        "REJECT"
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid decision."
        )

    incident_id = payload.get("incident_id")

    if incident_id is None:
        raise HTTPException(
            status_code=400,
            detail="incident_id is required."
        )

    entry = DispatchAudit(
        incident_id=int(incident_id),

        incident_label=payload.get(
            "incident_label"
        ),

        incident_type=payload.get(
            "incident_type"
        ),

        priority=payload.get(
            "priority"
        ),

        priority_score=payload.get(
            "priority_score"
        ),

        decision=decision,

        resource_ids=payload.get(
            "resource_ids"
        ) or [],

        note=payload.get(
            "note"
        ),

        incident_status_after=payload.get(
            "incident_status_after"
        ),

        source=payload.get(
            "source",
            "ResQAI Human Verification"
        )
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "id": entry.id,
        "incident_id": entry.incident_id,
        "incident_label": entry.incident_label,
        "incident_type": entry.incident_type,
        "priority": entry.priority,
        "priority_score": entry.priority_score,
        "decision": entry.decision,
        "resource_ids": entry.resource_ids or [],
        "note": entry.note,
        "incident_status_after":
            entry.incident_status_after,
        "source": entry.source,
        "recorded_at":
            entry.recorded_at.isoformat()
    }


@app.get("/api/dispatch-audit")
def list_dispatch_audit(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):

    limit = max(
        1,
        min(limit, 200)
    )

    offset = max(
        0,
        offset
    )

    rows = (
        db.query(DispatchAudit)
        .order_by(
            DispatchAudit.recorded_at.desc(),
            DispatchAudit.id.desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": x.id,
            "incident_id": x.incident_id,
            "incident_label":
                x.incident_label,
            "incident_type":
                x.incident_type,
            "priority":
                x.priority,
            "priority_score":
                x.priority_score,
            "decision":
                x.decision,
            "resource_ids":
                x.resource_ids or [],
            "note":
                x.note,
            "incident_status_after":
                x.incident_status_after,
            "source":
                x.source,
            "recorded_at":
                x.recorded_at.isoformat()
                if x.recorded_at
                else None
        }
        for x in rows
    ]