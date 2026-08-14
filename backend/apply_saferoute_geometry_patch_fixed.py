from pathlib import Path
import shutil
import re

TARGET = Path("route_engine.py")
BACKUP = Path("route_engine.py.before_geometry_patch")

if not TARGET.exists():
    raise SystemExit("route_engine.py not found. Run this from C:\\Projects\\ResQAI\\backend")

source = TARGET.read_text(encoding="utf-8")

if '"geometry": geometry' in source:
    print("build_route() already returns geometry.")
else:
    build_start = source.find("def build_route(")
    main_start = source.find("async def recommend_route(", build_start)
    if build_start == -1:
        raise SystemExit("Could not find def build_route() in route_engine.py")
    if main_start == -1:
        raise SystemExit("Could not find recommend_route() after build_route().")
    block = source[build_start:main_start]
    marker = '"recommended": False,'
    pos = block.find(marker)
    if pos == -1:
        raise SystemExit("Could not locate the build_route() return dictionary. Send me that function.")
    block = block[:pos] + '        "geometry": geometry,\n' + block[pos:]
    source = source[:build_start] + block + source[main_start:]
    print("Added OSRM geometry to build_route().")

fallback_start = source.find("# FALLBACK")
if fallback_start != -1:
    fallback = source[fallback_start:]
    if '"route_id": "demo-direct"' in fallback and '"geometry": []' not in fallback:
        marker = '"recommended": False,'
        pos = fallback.find(marker)
        if pos != -1:
            fallback = fallback[:pos] + '            "geometry": [],\n' + fallback[pos:]
            source = source[:fallback_start] + fallback
            print("Marked fallback route as geometry-free.")

if not BACKUP.exists():
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

TARGET.write_text(source, encoding="utf-8")
print("route_engine.py updated successfully.")
print("Run: python -m py_compile route_engine.py")
print("Then: python -m py_compile main.py")
print("Then restart Uvicorn.")