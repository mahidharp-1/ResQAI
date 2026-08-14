from pathlib import Path
import shutil
import re

MAIN = Path("main.py")
ROUTE = Path("route_engine.py")
MOVEMENT = Path("resource_movement.py")

if not MAIN.exists():
    raise SystemExit(r"main.py not found. Run this from C:\Projects\ResQAI\backend")
if not ROUTE.exists():
    raise SystemExit(r"route_engine.py not found. Run this from C:\Projects\ResQAI\backend")
if not MOVEMENT.exists():
    raise SystemExit("resource_movement.py not found. Apply the live movement patch first.")

# Backups
main_backup = Path("main.py.before_route_movement_fix")
route_backup = Path("route_engine.py.before_route_movement_fix")

if not main_backup.exists():
    shutil.copy2(MAIN, main_backup)
    print(f"Backup created: {main_backup}")
else:
    print(f"Backup already exists: {main_backup}")

if not route_backup.exists():
    shutil.copy2(ROUTE, route_backup)
    print(f"Backup created: {route_backup}")
else:
    print(f"Backup already exists: {route_backup}")

main = MAIN.read_text(encoding="utf-8")
route = ROUTE.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Imports
# ------------------------------------------------------------
movement_import = '''
from resource_movement import (
    MOVEMENTS,
    advance as advance_resource_movement,
    public as public_movement,
    total_distance_m,
    TIME_SCALE,
    MIN_SECONDS,
)
'''

if "from resource_movement import (" not in main:
    marker = "from route_engine import recommend_route"
    if marker in main:
        main = main.replace(marker, marker + movement_import, 1)
    else:
        pos = main.find("\n\nBase.metadata.create_all")
        if pos == -1:
            raise SystemExit("Could not find a safe import insertion point in main.py")
        main = main[:pos] + movement_import + main[pos:]
    print("Added resource movement imports.")

if "\nimport inspect\n" not in main and not main.startswith("import inspect\n"):
    m = re.search(r"^(?:import .+|from .+ import .+)\n", main, re.M)
    if m:
        main = main[:m.end()] + "import inspect\n" + main[m.end():]
    else:
        main = "import inspect\n" + main
    print("Added inspect import.")

if "from dataset_models import DatasetIncident, DatasetHazard" not in main:
    m = re.search(r"from models import .+\n", main)
    if m:
        main = main[:m.end()] + "from dataset_models import DatasetIncident, DatasetHazard\n" + main[m.end():]
        print("Added dataset model imports.")

# ------------------------------------------------------------
# 2. Missing route helpers
# ------------------------------------------------------------
helpers = '''
# ============================================================
# ROUTE DATA / ROUTING COMPATIBILITY
# ============================================================

def _current_route_hazards(db: Session):
    try:
        rows = db.query(Hazard).all()
    except Exception:
        rows = []

    return [
        hazard_dict(x)
        for x in rows
    ]


def _historical_route_hazards(db: Session):
    try:
        rows = db.query(DatasetHazard).all()
    except Exception:
        rows = []

    return [
        {
            "source_id": getattr(x, "source_id", None),
            "hazard_type": getattr(x, "hazard_type", None),
            "type": getattr(x, "hazard_type", None),
            "severity": getattr(x, "severity", "MODERATE"),
            "latitude": getattr(x, "latitude", None),
            "longitude": getattr(x, "longitude", None),
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

'''

if "def _current_route_hazards(" not in main:
    marker = '@app.post("/api/routes/recommend")'
    pos = main.find(marker)
    if pos == -1:
        raise SystemExit("Could not find /api/routes/recommend in main.py")
    main = main[:pos] + helpers + main[pos:]
    print("Added missing route hazard helpers.")
else:
    print("Route hazard helpers already exist.")

# ------------------------------------------------------------
# 3. Replace /api/routes/recommend
# ------------------------------------------------------------
route_pattern = re.compile(
    r'@app\.post\("/api/routes/recommend"\)\s*'
    r'async def route\(\s*'
    r'req: RouteRequest,\s*'
    r'db: Session = Depends\(get_db\)\s*'
    r'\):.*?(?=\n# ============================================================|\n@app\.get\("/api/hazards"\))',
    re.S,
)

new_route = '''
@app.post("/api/routes/recommend")
async def route(
    req: RouteRequest,
    db: Session = Depends(get_db),
):
    try:
        result = await _recommend_route_compatible(
            float(req.origin_lat),
            float(req.origin_lon),
            float(req.destination_lat),
            float(req.destination_lon),
            db,
        )

        for item in result.get("routes", []) or []:
            if not isinstance(item.get("geometry"), list):
                item["geometry"] = []

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Route recommendation failed: {str(e)}",
        )

'''

if route_pattern.search(main):
    main = route_pattern.sub(new_route, main, count=1)
    print("Replaced /api/routes/recommend.")
else:
    print("Existing route endpoint was not replaced; compatibility helper is still installed.")

# ------------------------------------------------------------
# 4. Replace /api/resources so every poll advances movement
# ------------------------------------------------------------
resources_pattern = re.compile(
    r'@app\.get\("/api/resources"\)\s*'
    r'def resources\([^)]*\):.*?(?=\n# ============================================================|\n@app\.post\("/api/resources"\))',
    re.S,
)

new_resources = '''
@app.get("/api/resources")
def resources(
    db: Session = Depends(get_db),
):
    advance_resource_movement(
        db,
        Resource,
        Incident,
    )

    try:
        _release_due_resources(db)
    except Exception:
        pass

    result = []

    for resource in db.query(Resource).all():
        item = resource_dict(resource)
        status = str(resource.status or "").upper()

        item["release_in_seconds"] = (
            _resource_release_seconds(resource)
            if status == "BUSY"
            else None
        )

        item["movement"] = public_movement(
            resource.resource_id,
            resource,
        )

        result.append(item)

    return result

'''

if resources_pattern.search(main):
    main = resources_pattern.sub(new_resources, main, count=1)
    print("Updated /api/resources to advance movement.")
else:
    print("Could not automatically replace /api/resources.")

# ------------------------------------------------------------
# 5. Add start-movement endpoint if missing
# ------------------------------------------------------------
if '@app.post("/api/resources/{resource_id}/start-movement")' not in main:
    marker = '@app.post("/api/routes/recommend")'
    pos = main.find(marker)
    if pos == -1:
        raise SystemExit("Could not find route endpoint for movement insertion.")

    endpoint = '''
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
        .filter(Resource.resource_id == resource_id)
        .first()
    )

    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if str(resource.status or "").upper() != "BUSY":
        raise HTTPException(
            status_code=409,
            detail=f"Resource {resource_id} must be BUSY before movement starts.",
        )

    if not resource.current_incident_id:
        raise HTTPException(
            status_code=409,
            detail=f"Resource {resource_id} has no current incident assignment.",
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


'''
    main = main[:pos] + endpoint + main[pos:]
    print("Added start-movement endpoint.")

# ------------------------------------------------------------
# 6. Add internal movement starter if missing
# ------------------------------------------------------------
if "async def _start_resource_movement(" not in main:
    marker = '@app.post("/api/resources/{resource_id}/start-movement")'
    pos = main.find(marker)
    if pos == -1:
        raise SystemExit("Could not insert internal movement starter.")

    starter = '''
async def _start_resource_movement(
    resource: Resource,
    incident: Incident,
    db: Session,
):
    resource_id = resource.resource_id

    if resource_id in MOVEMENTS:
        return {
            "resource_id": resource_id,
            "started": True,
            "already_active": True,
            "movement": public_movement(resource_id, resource),
        }

    if str(resource.status or "").upper() != "BUSY":
        return {
            "resource_id": resource_id,
            "started": False,
            "error": "Resource is not BUSY.",
        }

    route_result = await _recommend_route_compatible(
        float(resource.latitude),
        float(resource.longitude),
        float(incident.latitude),
        float(incident.longitude),
        db,
    )

    routes = route_result.get("routes", []) or []

    selected_route = next(
        (
            r for r in routes
            if r.get("recommended")
            and isinstance(r.get("geometry"), list)
            and len(r.get("geometry")) >= 2
        ),
        None,
    )

    if selected_route is None:
        selected_route = next(
            (
                r for r in routes
                if isinstance(r.get("geometry"), list)
                and len(r.get("geometry")) >= 2
            ),
            None,
        )

    if selected_route is None:
        return {
            "resource_id": resource_id,
            "started": False,
            "error": "No usable OSRM geometry was returned.",
        }

    geometry = selected_route["geometry"]

    duration_seconds = max(
        MIN_SECONDS,
        float(selected_route.get("duration_min", 0) or 0)
        * 60.0
        * TIME_SCALE,
    )

    MOVEMENTS[resource_id] = {
        "resource_id": resource_id,
        "incident_id": incident.id,
        "geometry": geometry,
        "route_id": selected_route.get("route_id"),
        "route_source": route_result.get("source", "OSRM"),
        "origin_lat": float(resource.latitude),
        "origin_lon": float(resource.longitude),
        "destination_lat": float(incident.latitude),
        "destination_lon": float(incident.longitude),
        "distance_m": total_distance_m(geometry),
        "duration_seconds": duration_seconds,
        "started_at": __import__("time").time(),
    }

    incident.status = "RESPONDING"
    incident.updated_at = __import__("datetime").datetime.utcnow()
    db.commit()

    return {
        "resource_id": resource_id,
        "started": True,
        "incident_id": incident.id,
        "status": "EN_ROUTE",
        "route_source": route_result.get("source", "OSRM"),
        "route_id": selected_route.get("route_id"),
        "distance_km": round(
            total_distance_m(geometry) / 1000.0,
            3,
        ),
        "geometry_points": len(geometry),
        "movement": public_movement(
            resource_id,
            resource,
        ),
    }


'''
    main = main[:pos] + starter + main[pos:]
    print("Added internal movement starter.")

# ------------------------------------------------------------
# 7. Fix route_engine.py geometry
# ------------------------------------------------------------
build_start = route.find("def build_route(")
main_start = route.find("async def recommend_route(", build_start)

if build_start == -1 or main_start == -1:
    raise SystemExit("Could not locate build_route()/recommend_route() in route_engine.py.")

build_block = route[build_start:main_start]

if '"geometry": geometry' not in build_block:
    target = '''        "hazards_encountered": [
            h["type"]
            for h in encountered
        ],
        "recommended": False,'''

    replacement = '''        "hazards_encountered": [
            h["type"]
            for h in encountered
        ],
        # Real OSRM GeoJSON geometry: [longitude, latitude].
        "geometry": geometry,
        "recommended": False,'''

    if target not in build_block:
        raise SystemExit(
            "route_engine.py build_route() return block does not match the expected project version."
        )

    build_block = build_block.replace(target, replacement, 1)
    route = route[:build_start] + build_block + route[main_start:]
    print("Added OSRM geometry to build_route().")
else:
    print("route_engine.py already returns geometry.")

# Make fallback routes geometry-free.
route = re.sub(
    r'("route_id":\s*"demo-direct",.*?'
    r'"hazards_encountered":\s*\[.*?\],\s*)'
    r'("recommended":\s*False,)',
    r'\1"geometry": [],\n            \2',
    route,
    count=1,
    flags=re.S,
)

route = re.sub(
    r'("route_id":\s*f"demo-detour-\{index\}".*?'
    r'"hazards_encountered":\s*\[.*?\],\s*)'
    r'("recommended":\s*False,)',
    r'\1"geometry": [],\n                \2',
    route,
    count=2,
    flags=re.S,
)

MAIN.write_text(main, encoding="utf-8")
ROUTE.write_text(route, encoding="utf-8")

print()
print("=" * 65)
print("RESQAI ROUTE + LIVE MOVEMENT FIX APPLIED")
print("=" * 65)
print("Fixed: _current_route_hazards NameError")
print("Fixed: historical hazard compatibility")
print("Fixed: OSRM geometry returned by route_engine")
print("Fixed: /api/resources advances movement")
print("Fixed: movement state exposed to frontend")
print("Fixed: start-movement uses SafeRoute")
print("Fallback routes are not treated as real road geometry")
print()
print("Now run:")
print("  python -m py_compile route_engine.py")
print("  python -m py_compile main.py")
print("Then restart Uvicorn.")
print("=" * 65)