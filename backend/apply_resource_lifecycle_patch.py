from pathlib import Path
import shutil

TARGET = Path("main.py")
BACKUP = Path("main.py.before_resource_lifecycle_patch")

if not TARGET.exists():
    raise SystemExit(
        "main.py not found. Run this script from C:\\Projects\\ResQAI\\backend"
    )

source = TARGET.read_text(encoding="utf-8")

if not BACKUP.exists():
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

# 1. Import timedelta
if "from datetime import datetime, timedelta" not in source:
    if "from datetime import datetime" in source:
        source = source.replace(
            "from datetime import datetime",
            "from datetime import datetime, timedelta",
            1
        )
    else:
        source = "from datetime import datetime, timedelta\n" + source

# 2. Lifecycle helpers
helper_marker = 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])'

helpers = r'''
# ============================================================
# DEMO RESOURCE LIFECYCLE
# ============================================================

DEMO_RESOURCE_RELEASE_SECONDS = 90
DEMO_RESOURCE_RELEASES = {}


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

        if resource_id not in DEMO_RESOURCE_RELEASES:
            DEMO_RESOURCE_RELEASES[resource_id] = (
                now + timedelta(
                    seconds=DEMO_RESOURCE_RELEASE_SECONDS
                )
            )

        release_at = DEMO_RESOURCE_RELEASES[resource_id]

        if now >= release_at:
            resource.status = "AVAILABLE"
            resource.current_incident_id = None
            DEMO_RESOURCE_RELEASES.pop(
                resource_id,
                None
            )
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
    _release_due_resources(db)

    resources = db.query(Resource).all()

    for resource in resources:
        resource.status = "AVAILABLE"
        resource.current_incident_id = None

    incidents = db.query(Incident).all()
    reset_incidents = 0

    for incident in incidents:
        status = str(
            incident.status or ""
        ).upper()

        if status in {
            "RESOURCE_ASSIGNED",
            "RESPONDING"
        }:
            incident.status = "NEW"
            incident.updated_at = datetime.utcnow()
            reset_incidents += 1

    DEMO_RESOURCE_RELEASES.clear()

    db.commit()

    return {
        "message": "ResQAI demo state reset successfully.",
        "resources_reset": len(resources),
        "incidents_reset": reset_incidents,
        "audit_history_preserved": True
    }
'''

if "DEMO_RESOURCE_RELEASE_SECONDS" not in source:
    if helper_marker in source:
        source = source.replace(
            helper_marker,
            helper_marker + helpers,
            1
        )
    else:
        pos = source.find("@app.")
        if pos == -1:
            raise SystemExit("Could not find FastAPI routes.")
        source = source[:pos] + helpers + "\n" + source[pos:]

# 3. Resources endpoint
old_resources = '''@app.get("/api/resources")
def resources(db: Session = Depends(get_db)):
    return [resource_dict(x) for x in db.query(Resource).all()]'''

new_resources = '''@app.get("/api/resources")
def resources(db: Session = Depends(get_db)):
    _release_due_resources(db)

    result = []

    for resource in db.query(Resource).all():
        item = resource_dict(resource)

        if str(resource.status or "").upper() == "BUSY":
            item["release_in_seconds"] = _resource_release_seconds(
                resource
            )
        else:
            item["release_in_seconds"] = None

        result.append(item)

    return result'''

if old_resources in source:
    source = source.replace(
        old_resources,
        new_resources,
        1
    )

# 4. Recommendation lifecycle check
needle = '''def _build_resource_recommendations(incident, db):
    ai = analyze_incident('''
replacement = '''def _build_resource_recommendations(incident, db):
    _release_due_resources(db)

    ai = analyze_incident('''

if needle in source:
    source = source.replace(
        needle,
        replacement,
        1
    )

# 5. Availability endpoint
verify_marker = '@app.post("/api/incidents/{incident_id}/verify")'

availability_endpoint = r'''
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


'''

if verify_marker in source and "resource-availability" not in source:
    source = source.replace(
        verify_marker,
        availability_endpoint + verify_marker,
        1
    )

# 6. Schedule a resource after human verification
old_assignment = '''        resource.status = "BUSY"
        resource.current_incident_id = incident.id

        assigned.append(resource.resource_id)'''

new_assignment = '''        resource.status = "BUSY"
        resource.current_incident_id = incident.id

        DEMO_RESOURCE_RELEASES[
            resource.resource_id
        ] = (
            datetime.utcnow()
            + timedelta(
                seconds=DEMO_RESOURCE_RELEASE_SECONDS
            )
        )

        assigned.append(resource.resource_id)'''

if old_assignment in source:
    source = source.replace(
        old_assignment,
        new_assignment,
        1
    )

# 7. Replace reset endpoint block
start = source.find('@app.post("/api/resources/reset")')

if start != -1:
    end = source.find(
        '@app.post("/api/routes/recommend")',
        start
    )

    if end != -1:
        reset_block = r'''@app.post("/api/resources/reset")
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


'''

        source = (
            source[:start]
            + reset_block
            + source[end:]
        )

TARGET.write_text(
    source,
    encoding="utf-8"
)

print("Resource lifecycle patch applied.")
print("Run: python -m py_compile main.py")
print("Then restart Uvicorn.")
print("New endpoint: GET /api/incidents/{id}/resource-availability")
print("New endpoint: POST /api/demo/reset")