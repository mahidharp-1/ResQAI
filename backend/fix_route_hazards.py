from pathlib import Path
import shutil

TARGET = Path("main.py")
BACKUP = Path("main.py.before_route_hazard_helpers")

if not TARGET.exists():
    raise SystemExit("main.py not found. Run this from C:\\Projects\\ResQAI\\backend")

source = TARGET.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Add inspect import
# ------------------------------------------------------------

if "import inspect" not in source:
    source = "import inspect\n" + source
    print("Added: import inspect")

# ------------------------------------------------------------
# 2. Check DatasetHazard exists
# ------------------------------------------------------------

if "DatasetHazard" not in source:
    raise SystemExit(
        "DatasetHazard is not available in main.py. "
        "Do not continue; send me the first 30 lines of main.py."
    )

# ------------------------------------------------------------
# 3. Add missing route hazard helpers
# ------------------------------------------------------------

if "def _current_route_hazards(" not in source:

    marker = "async def _recommend_route_compatible("

    position = source.find(marker)

    if position == -1:
        raise SystemExit(
            "Could not find _recommend_route_compatible()."
        )

    helpers = r'''
def _current_route_hazards(db: Session):
    """
    Return currently active operational hazards.
    """
    rows = db.query(Hazard).all()

    return [
        hazard_dict(x)
        for x in rows
    ]


def _historical_route_hazards(db: Session):
    """
    Return historical hazard records used by SafeRoute.
    """
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


'''

    source = (
        source[:position]
        + helpers
        + source[position:]
    )

    print("Added:")
    print("  _current_route_hazards()")
    print("  _historical_route_hazards()")

else:
    print("Route hazard helpers already exist.")

# ------------------------------------------------------------
# 4. Backup
# ------------------------------------------------------------

if not BACKUP.exists():
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

# ------------------------------------------------------------
# 5. Write
# ------------------------------------------------------------

TARGET.write_text(
    source,
    encoding="utf-8"
)

print()
print("Route hazard helper fix applied successfully.")
print()
print("Next:")
print("python -m py_compile main.py")