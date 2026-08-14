"""
ResQAI SafeRoute geometry patch.

Run this ONCE from:
C:\Projects\ResQAI\backend

Command:
python apply_saferoute_geometry_patch.py

It updates route_engine.py so the OSRM route geometry is returned
to the frontend. A backup is created automatically.
"""

from pathlib import Path
import shutil
import re

TARGET = Path("route_engine.py")
BACKUP = Path("route_engine.py.before_geometry_patch")

if not TARGET.exists():
    raise SystemExit(
        "route_engine.py was not found. Run this script from C:\\Projects\\ResQAI\\backend"
    )

source = TARGET.read_text(encoding="utf-8")

if BACKUP.exists():
    print(f"Backup already exists: {BACKUP}")
else:
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

changed = False

# ------------------------------------------------------------
# 1. Return actual OSRM geometry from build_route()
# ------------------------------------------------------------

build_start = source.find("def build_route(")

if build_start == -1:
    raise SystemExit("Could not find def build_route() in route_engine.py")

main_start = source.find(
    "async def recommend_route(",
    build_start
)

if main_start == -1:
    raise SystemExit(
        "Could not find recommend_route() after build_route()."
    )

build_block = source[build_start:main_start]

if '"geometry": geometry' not in build_block:
    old = """        "hazards_encountered": [
            h["type"]
            for h in encountered
        ],
        "recommended": False,"""

    new = """        "hazards_encountered": [
            h["type"]
            for h in encountered
        ],
        # OSRM returns [longitude, latitude] GeoJSON coordinates.
        # Keep the geometry so Leaflet can draw the actual road route.
        "geometry": geometry,
        "recommended": False,"""

    if old not in build_block:
        raise SystemExit(
            "Could not find the build_route() return block. "
            "Open route_engine.py and check that the current route builder matches the project version."
        )

    build_block = build_block.replace(old, new, 1)

    source = (
        source[:build_start]
        + build_block
        + source[main_start:]
    )

    changed = True
    print("Added OSRM geometry to build_route().")
else:
    print("build_route() already returns geometry.")

# ------------------------------------------------------------
# 2. Mark fallback routes as geometry-free.
#    We do NOT draw a straight fake line and call it a road.
# ------------------------------------------------------------

fallback_start = source.find("# FALLBACK")

if fallback_start != -1:
    fallback_block = source[fallback_start:]

    fallback_block_new = re.sub(
        r'("hazards_encountered": \[\s*'
        r'h\["type"\]\s*for h in direct_hazards\s*\],\s*)'
        r'("recommended": False,)',
        r'\1        "geometry": [],\n        \2',
        fallback_block,
        count=1,
    )

    if fallback_block_new != fallback_block:
        source = source[:fallback_start] + fallback_block_new
        changed = True
        print("Marked fallback direct route as geometry-free.")

if changed:
    TARGET.write_text(source, encoding="utf-8")
    print("route_engine.py updated successfully.")
else:
    print("No changes were necessary.")

print()
print("Next:")
print("1. Run: python -m py_compile route_engine.py")
print("2. Restart uvicorn.")
print("3. Test /api/routes/recommend.")
print("4. Confirm a route object contains a non-empty 'geometry' array.")