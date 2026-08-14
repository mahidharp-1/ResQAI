from pathlib import Path
import shutil

TARGET = Path("main.py")
BACKUP = Path("main.py.before_live_movement_patch")

if not TARGET.exists():
    raise SystemExit("main.py not found. Run this from C:\\Projects\\ResQAI\\backend")

source = TARGET.read_text(encoding="utf-8")

if "from resource_movement import" in source:
    print("Live movement patch already exists. Nothing to add.")
    raise SystemExit(0)

if not BACKUP.exists():
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

# Import movement engine after existing imports.
imports = "from resource_movement import MOVEMENTS, advance, public, total_distance_m, TIME_SCALE, MIN_SECONDS\n"
insert_at = source.find("\n\n# ============================================================\n# DATABASE / APPLICATION SETUP")
if insert_at == -1:
    insert_at = source.find("\n\nBase.metadata.create_all")
if insert_at == -1:
    raise SystemExit("Could not find a safe import insertion point in main.py")
source = source[:insert_at] + "\n" + imports + source[insert_at:]

# Replace lifecycle-aware resources endpoint.
old = '''@app.get("/api/resources")
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
new = '''@app.get("/api/resources")
def resources(db: Session = Depends(get_db)):
    _release_due_resources(db)
    advance(db, Resource, Incident)

    result = []
    for resource in db.query(Resource).all():
        item = resource_dict(resource)
        item["release_in_seconds"] = (
            _resource_release_seconds(resource)
            if str(resource.status or "").upper() == "BUSY"
            else None
        )
        item["movement"] = public(resource.resource_id, resource)
        result.append(item)
    return result'''
if old not in source:
    raise SystemExit("Could not find the existing lifecycle /api/resources endpoint. Apply apply_resource_lifecycle_patch.py first.")
source = source.replace(old, new, 1)

marker = '@app.post("/api/routes/recommend")'
if marker not in source:
    raise SystemExit("Could not find /api/routes/recommend")

routes = r'''
@app.post("/api/resources/{resource_id}/start-movement")
async def start_resource_movement(resource_id: str, db: Session = Depends(get_db)):
    advance(db, Resource, Incident)
    resource = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if str(resource.status or "").upper() != "BUSY":
        raise HTTPException(status_code=409, detail=f"Resource {resource_id} must be BUSY before movement starts.")
    if not resource.current_incident_id:
        raise HTTPException(status_code=409, detail=f"Resource {resource_id} has no current incident assignment.")
    incident = db.get(Incident, resource.current_incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Assigned incident not found")
    if incident.latitude is None or incident.longitude is None:
        raise HTTPException(status_code=400, detail="Assigned incident has no valid coordinates.")
    if resource_id in MOVEMENTS:
        return {"message": "Resource is already moving.", "movement": public(resource_id, resource)}

    hazards = [hazard_dict(h) for h in db.query(Hazard).all()]
    route_result = await recommend_route(
        float(resource.latitude), float(resource.longitude),
        float(incident.latitude), float(incident.longitude), hazards
    )
    routes = route_result.get("routes", [])
    route = next((r for r in routes if r.get("recommended") and r.get("geometry")), None)
    route = route or next((r for r in routes if r.get("geometry")), None)
    if not route or len(route.get("geometry", [])) < 2:
        raise HTTPException(status_code=502, detail="OSRM did not return usable route geometry. Run the SafeRoute geometry patch first.")

    geometry = route["geometry"]
    osrm_seconds = float(route.get("duration_min", 0)) * 60.0
    duration_seconds = max(MIN_SECONDS, osrm_seconds * TIME_SCALE)
    distance_m = total_distance_m(geometry)

    MOVEMENTS[resource_id] = {
        "resource_id": resource_id,
        "incident_id": incident.id,
        "geometry": geometry,
        "route_id": route.get("route_id"),
        "route_source": route_result.get("source", "OSRM"),
        "origin_lat": float(resource.latitude),
        "origin_lon": float(resource.longitude),
        "destination_lat": float(incident.latitude),
        "destination_lon": float(incident.longitude),
        "distance_m": distance_m,
        "duration_seconds": duration_seconds,
        "started_at": __import__("time").time(),
    }
    incident.status = "RESPONDING"
    incident.updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Resource movement started.",
        "resource_id": resource_id,
        "incident_id": incident.id,
        "status": "EN_ROUTE",
        "route_source": route_result.get("source", "OSRM"),
        "route_id": route.get("route_id"),
        "distance_km": round(distance_m / 1000, 3),
        "osrm_duration_min": route.get("duration_min"),
        "demo_duration_seconds": round(duration_seconds, 1),
        "geometry_points": len(geometry),
        "movement": public(resource_id, resource),
    }


@app.get("/api/resources/{resource_id}/movement")
def get_resource_movement(resource_id: str, db: Session = Depends(get_db)):
    advance(db, Resource, Incident)
    resource = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    movement = public(resource_id, resource)
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
def release_resource(resource_id: str, db: Session = Depends(get_db)):
    advance(db, Resource, Incident)
    resource = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    incident_id = resource.current_incident_id
    resource.status = "AVAILABLE"
    resource.current_incident_id = None
    MOVEMENTS.pop(resource_id, None)
    if incident_id:
        incident = db.get(Incident, incident_id)
        if incident and str(incident.status or "").upper() != "RESOLVED":
            incident.status = "RESOLVED"
            incident.updated_at = datetime.utcnow()
    db.commit()
    return {
        "message": "Resource released successfully.",
        "resource_id": resource_id,
        "released_from_incident_id": incident_id,
        "status": "AVAILABLE",
    }


'''
source = source.replace(marker, routes + marker, 1)

# Clear movement on demo reset.
if "MOVEMENTS.clear()" not in source and "DEMO_RESOURCE_RELEASES.clear()" in source:
    source = source.replace("DEMO_RESOURCE_RELEASES.clear()", "DEMO_RESOURCE_RELEASES.clear()\n    MOVEMENTS.clear()", 1)

TARGET.write_text(source, encoding="utf-8")
print("Live movement patch applied successfully.")
print("Run: python -m py_compile main.py")
print("Then restart Uvicorn.")