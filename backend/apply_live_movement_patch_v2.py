from pathlib import Path
import shutil

TARGET = Path("main.py")
BACKUP = Path("main.py.before_live_movement_patch_v2")

if not TARGET.exists():
    raise SystemExit("main.py not found. Run this from C:\\Projects\\ResQAI\\backend")

source = TARGET.read_text(encoding="utf-8")

if "LIVE_MOVEMENT_STATE" in source:
    print("Live movement code already exists in main.py. Nothing to do.")
    raise SystemExit(0)

for item in [
    '@app.get("/api/resources")',
    'def resources(',
    'class Resource',
    'class Incident',
]:
    if item not in source:
        raise SystemExit(f"Required project element not found: {item}")

if "recommend_route" not in source:
    raise SystemExit(
        "recommend_route is not available in main.py. "
        "Send the imports from the top of main.py before continuing."
    )

if "import math" not in source:
    source = "import math\n" + source
if "import time" not in source:
    source = "import time\n" + source

resource_start = source.find('@app.get("/api/resources")')
resource_end = source.find('@app.post("/api/resources")', resource_start)

if resource_start == -1 or resource_end == -1:
    raise SystemExit("Could not locate the /api/resources block.")

new_endpoint = '''@app.get("/api/resources")
def resources(
    db: Session = Depends(get_db)
):
    _advance_live_movement(db)

    records = db.query(Resource).all()
    result = []

    for x in records:
        item = resource_dict(x)
        item["movement"] = _movement_public_state(
            x.resource_id,
            x
        )
        result.append(item)

    return result


'''

helpers = '''# ============================================================
# LIVE RESOURCE MOVEMENT
# OSRM road geometry + live coordinates + ETA
# ============================================================

LIVE_MOVEMENT_STATE = {}

# Compress real OSRM travel time for the hackathon demo.
LIVE_MOVEMENT_TIME_SCALE = 0.08
LIVE_MOVEMENT_MIN_SECONDS = 12.0


def _movement_distance_m(a, b):
    lon1, lat1 = float(a[0]), float(a[1])
    lon2, lat2 = float(b[0]), float(b[1])

    lat_m = (lat2 - lat1) * 111320.0
    lon_m = (
        (lon2 - lon1)
        * 111320.0
        * math.cos(
            math.radians((lat1 + lat2) / 2.0)
        )
    )

    return math.sqrt(
        lat_m * lat_m + lon_m * lon_m
    )


def _geometry_total_distance_m(geometry):
    if not isinstance(geometry, list) or len(geometry) < 2:
        return 0.0

    return sum(
        _movement_distance_m(
            geometry[i - 1],
            geometry[i]
        )
        for i in range(1, len(geometry))
    )


def _interpolate_geometry(geometry, progress):
    if not geometry:
        return None

    if len(geometry) == 1:
        return [
            float(geometry[0][0]),
            float(geometry[0][1])
        ]

    progress = max(
        0.0,
        min(1.0, float(progress))
    )

    segment_lengths = []
    total = 0.0

    for i in range(1, len(geometry)):
        distance = _movement_distance_m(
            geometry[i - 1],
            geometry[i]
        )
        segment_lengths.append(distance)
        total += distance

    if total <= 0:
        p = geometry[-1]
        return [
            float(p[0]),
            float(p[1])
        ]

    target = total * progress
    travelled = 0.0

    for i, distance in enumerate(segment_lengths):
        if travelled + distance >= target:
            ratio = (
                0.0
                if distance <= 0
                else (target - travelled) / distance
            )

            a = geometry[i]
            b = geometry[i + 1]

            return [
                float(a[0]) + (
                    float(b[0]) - float(a[0])
                ) * ratio,
                float(a[1]) + (
                    float(b[1]) - float(a[1])
                ) * ratio
            ]

        travelled += distance

    p = geometry[-1]
    return [
        float(p[0]),
        float(p[1])
    ]


def _movement_public_state(resource_id, resource):
    state = LIVE_MOVEMENT_STATE.get(resource_id)

    if not state:
        return None

    duration = max(
        LIVE_MOVEMENT_MIN_SECONDS,
        float(state["duration_seconds"])
    )

    elapsed = max(
        0.0,
        time.time() - state["started_at"]
    )

    progress = min(
        1.0,
        elapsed / duration
    )

    return {
        "active": True,
        "resource_id": resource_id,
        "incident_id": state["incident_id"],
        "status": (
            "EN_ROUTE"
            if progress < 1.0
            else "ARRIVED"
        ),
        "progress": round(progress, 4),
        "progress_percent": round(
            progress * 100.0,
            1
        ),
        "eta_seconds": int(
            math.ceil(
                max(
                    0.0,
                    duration - elapsed
                )
            )
        ),
        "eta_minutes": round(
            max(
                0.0,
                duration - elapsed
            ) / 60.0,
            2
        ),
        "remaining_distance_km": round(
            state["distance_m"]
            * (1.0 - progress)
            / 1000.0,
            3
        ),
        "distance_km": round(
            state["distance_m"] / 1000.0,
            3
        ),
        "geometry": state["geometry"],
        "route_id": state.get("route_id"),
        "route_source": state.get(
            "route_source",
            "OSRM"
        ),
        "origin": {
            "latitude": state["origin_lat"],
            "longitude": state["origin_lon"]
        },
        "destination": {
            "latitude": state["destination_lat"],
            "longitude": state["destination_lon"]
        }
    }


def _advance_live_movement(db: Session):
    now = time.time()
    changed = False

    for resource_id, state in list(
        LIVE_MOVEMENT_STATE.items()
    ):
        resource = (
            db.query(Resource)
            .filter(
                Resource.resource_id == resource_id
            )
            .first()
        )

        if not resource:
            LIVE_MOVEMENT_STATE.pop(
                resource_id,
                None
            )
            continue

        duration = max(
            LIVE_MOVEMENT_MIN_SECONDS,
            float(state["duration_seconds"])
        )

        elapsed = max(
            0.0,
            now - state["started_at"]
        )

        progress = min(
            1.0,
            elapsed / duration
        )

        point = _interpolate_geometry(
            state["geometry"],
            progress
        )

        if point:
            # OSRM geometry is [longitude, latitude].
            resource.longitude = point[0]
            resource.latitude = point[1]
            changed = True

        if progress >= 1.0:
            resource.latitude = state[
                "destination_lat"
            ]
            resource.longitude = state[
                "destination_lon"
            ]

            incident_id = resource.current_incident_id
            incident = (
                db.get(Incident, incident_id)
                if incident_id
                else None
            )

            resource.status = "AVAILABLE"
            resource.current_incident_id = None

            if incident:
                incident.status = "RESOLVED"
                if hasattr(incident, "updated_at"):
                    from datetime import datetime as _dt
                    incident.updated_at = _dt.utcnow()

            LIVE_MOVEMENT_STATE.pop(
                resource_id,
                None
            )
            changed = True

    if changed:
        db.commit()


@app.post("/api/resources/{resource_id}/start-movement")
async def start_resource_movement(
    resource_id: str,
    db: Session = Depends(get_db)
):
    _advance_live_movement(db)

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
            detail="Resource not found"
        )

    if str(resource.status or "").upper() != "BUSY":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Resource {resource_id} must be BUSY "
                "before movement starts."
            )
        )

    if not resource.current_incident_id:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Resource {resource_id} has no "
                "current incident assignment."
            )
        )

    incident = db.get(
        Incident,
        resource.current_incident_id
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Assigned incident not found"
        )

    if (
        incident.latitude is None
        or incident.longitude is None
    ):
        raise HTTPException(
            status_code=400,
            detail="Assigned incident does not have valid coordinates."
        )

    if resource_id in LIVE_MOVEMENT_STATE:
        return {
            "message": "Resource is already moving.",
            "movement": _movement_public_state(
                resource_id,
                resource
            )
        }

    hazards = []
    try:
        if "Hazard" in globals():
            hazard_rows = db.query(Hazard).all()
            if "hazard_dict" in globals():
                hazards = [
                    hazard_dict(h)
                    for h in hazard_rows
                ]
    except Exception:
        hazards = []

    route_result = await recommend_route(
        float(resource.latitude),
        float(resource.longitude),
        float(incident.latitude),
        float(incident.longitude),
        hazards
    )

    routes = route_result.get(
        "routes",
        []
    )

    recommended = next(
        (
            r for r in routes
            if r.get("recommended")
            and r.get("geometry")
        ),
        None
    )

    if recommended is None:
        recommended = next(
            (
                r for r in routes
                if r.get("geometry")
            ),
            None
        )

    if recommended is None:
        raise HTTPException(
            status_code=502,
            detail=(
                "No OSRM road geometry was returned. "
                "Test /api/routes/recommend first."
            )
        )

    geometry = recommended.get(
        "geometry",
        []
    )

    if len(geometry) < 2:
        raise HTTPException(
            status_code=502,
            detail="OSRM route geometry contains fewer than two points."
        )

    osrm_seconds = (
        float(
            recommended.get(
                "duration_min",
                0.0
            )
        ) * 60.0
    )

    duration_seconds = max(
        LIVE_MOVEMENT_MIN_SECONDS,
        osrm_seconds * LIVE_MOVEMENT_TIME_SCALE
    )

    distance_m = _geometry_total_distance_m(
        geometry
    )

    LIVE_MOVEMENT_STATE[resource_id] = {
        "resource_id": resource_id,
        "incident_id": incident.id,
        "geometry": geometry,
        "route_id": recommended.get(
            "route_id"
        ),
        "route_source": route_result.get(
            "source",
            "OSRM"
        ),
        "origin_lat": float(
            resource.latitude
        ),
        "origin_lon": float(
            resource.longitude
        ),
        "destination_lat": float(
            incident.latitude
        ),
        "destination_lon": float(
            incident.longitude
        ),
        "distance_m": distance_m,
        "duration_seconds": duration_seconds,
        "started_at": time.time()
    }

    if str(incident.status or "").upper() == "NEW":
        incident.status = "RESPONDING"

    if hasattr(incident, "updated_at"):
        from datetime import datetime as _dt
        incident.updated_at = _dt.utcnow()

    db.commit()

    return {
        "message": "Resource movement started.",
        "resource_id": resource_id,
        "incident_id": incident.id,
        "status": "EN_ROUTE",
        "route_source": route_result.get(
            "source",
            "OSRM"
        ),
        "route_id": recommended.get(
            "route_id"
        ),
        "distance_km": round(
            distance_m / 1000.0,
            3
        ),
        "osrm_duration_min": recommended.get(
            "duration_min"
        ),
        "demo_duration_seconds": round(
            duration_seconds,
            1
        ),
        "geometry_points": len(
            geometry
        ),
        "movement": _movement_public_state(
            resource_id,
            resource
        )
    }


@app.get("/api/resources/{resource_id}/movement")
def get_resource_movement(
    resource_id: str,
    db: Session = Depends(get_db)
):
    _advance_live_movement(db)

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
            detail="Resource not found"
        )

    movement = _movement_public_state(
        resource_id,
        resource
    )

    if movement:
        return movement

    return {
        "active": False,
        "resource_id": resource_id,
        "status": resource.status,
        "incident_id": resource.current_incident_id,
        "latitude": resource.latitude,
        "longitude": resource.longitude
    }


@app.post("/api/resources/{resource_id}/release")
def release_resource(
    resource_id: str,
    db: Session = Depends(get_db)
):
    _advance_live_movement(db)

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
            detail="Resource not found"
        )

    incident_id = resource.current_incident_id

    resource.status = "AVAILABLE"
    resource.current_incident_id = None

    LIVE_MOVEMENT_STATE.pop(
        resource_id,
        None
    )

    if incident_id:
        incident = db.get(
            Incident,
            incident_id
        )

        if (
            incident
            and str(
                incident.status or ""
            ).upper() != "RESOLVED"
        ):
            incident.status = "RESOLVED"

            if hasattr(
                incident,
                "updated_at"
            ):
                from datetime import datetime as _dt
                incident.updated_at = _dt.utcnow()

    db.commit()

    return {
        "message": "Resource released successfully.",
        "resource_id": resource_id,
        "released_from_incident_id": incident_id,
        "status": "AVAILABLE"
    }


'''

if not BACKUP.exists():
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

source = (
    source[:resource_start]
    + helpers
    + new_endpoint
    + source[resource_end:]
)

TARGET.write_text(
    source,
    encoding="utf-8"
)

print("Live movement v2 patch applied successfully.")
print("Added POST /api/resources/{resource_id}/start-movement")
print("Added GET  /api/resources/{resource_id}/movement")
print("Added POST /api/resources/{resource_id}/release")
print("Run: python -m py_compile main.py")