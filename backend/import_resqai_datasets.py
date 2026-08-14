"""
ResQAI Dataset Importer

Place this file in:
C:\Projects\ResQAI\backend\import_resqai_datasets.py

Place dataset_models.py in the same backend folder.

Run from the backend virtual environment:
    python import_resqai_datasets.py

What it does:

1. Creates dataset_incidents and dataset_hazards tables.
2. Imports 17,000 Kakinada incidents.
3. Imports 17,000 Kakinada hazards.
4. Does NOT delete or overwrite the working operational
   incidents/resources/hazards.
5. Uses source IDs to avoid duplicate imports when run again.

Historical/training data is kept separate from active operational data.
"""

from pathlib import Path
import sys

import pandas as pd


# ============================================================
# PATH CONFIGURATION
# ============================================================

# Correct Python special variable: __file__
BACKEND_DIR = Path(__file__).resolve().parent

# Make sure the backend directory is available for imports
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


# ============================================================
# APPLICATION IMPORTS
# ============================================================

from database import engine, Base
from dataset_models import DatasetIncident, DatasetHazard


# ============================================================
# DATASET FILE PATHS
# ============================================================

DATASET_DIR = BACKEND_DIR.parent / "dataset"

INCIDENT_FILE = (
    DATASET_DIR / "kakinada_incidents_17000.xlsx"
)

HAZARD_FILE = (
    DATASET_DIR / "kakinada_hazards_dataset_17000.xlsx"
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def require_file(path: Path):
    """
    Check whether the required dataset file exists.
    """

    if not path.exists():
        raise FileNotFoundError(
            f"\nDataset not found:\n{path}\n\n"
            f"Please copy the Excel files into:\n"
            f"{DATASET_DIR}\n"
        )


def normalize_text(value):
    """
    Convert Excel values safely into strings.
    """

    if pd.isna(value):
        return ""

    return str(value).strip()


def safe_int(value, default=0):
    """
    Safely convert a value to integer.

    Handles:
    - integers
    - floats
    - strings
    - empty Excel cells
    """

    if pd.isna(value):
        return default

    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def safe_float(value, default=None):
    """
    Safely convert a value to float.
    """

    if pd.isna(value):
        return default

    try:
        return float(value)
    except (ValueError, TypeError):
        return default


# ============================================================
# IMPORT KAKINADA INCIDENT DATASET
# ============================================================

def import_kakinada_incidents(session):

    require_file(INCIDENT_FILE)

    print(f"Reading incident dataset:")
    print(f"  {INCIDENT_FILE}")

    df = pd.read_excel(INCIDENT_FILE)

    print(f"Incident rows found: {len(df)}")

    # --------------------------------------------------------
    # Validate columns
    # --------------------------------------------------------

    required_columns = {
        "ID",
        "Type",
        "Severity",
        "Priority",
        "people-affected",
        "description_incident",
        "location",
    }

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            "Kakinada incident dataset is missing columns: "
            f"{sorted(missing)}\n\n"
            f"Available columns:\n{list(df.columns)}"
        )

    # --------------------------------------------------------
    # Get already imported source IDs
    # --------------------------------------------------------

    existing_rows = (
        session.query(DatasetIncident.source_id)
        .filter(
            DatasetIncident.source_dataset
            == "kakinada_incidents_17000"
        )
        .all()
    )

    existing = {
        row[0]
        for row in existing_rows
    }

    print(
        f"Existing incident dataset records: "
        f"{len(existing)}"
    )

    # --------------------------------------------------------
    # Import rows
    # --------------------------------------------------------

    added = 0
    skipped = 0

    for _, row in df.iterrows():

        source_id = normalize_text(
            row["ID"]
        )

        # Ignore rows without an ID
        if not source_id:
            skipped += 1
            continue

        # Avoid duplicate imports
        if source_id in existing:
            skipped += 1
            continue

        people_count = safe_int(
            row["people-affected"],
            default=0,
        )

        record = DatasetIncident(
            source_id=source_id,

            source_dataset=(
                "kakinada_incidents_17000"
            ),

            incident_type=normalize_text(
                row["Type"]
            ),

            severity=normalize_text(
                row["Severity"]
            ),

            priority_label=normalize_text(
                row["Priority"]
            ),

            people_affected=max(
                0,
                people_count,
            ),

            description=normalize_text(
                row["description_incident"]
            ),

            location=normalize_text(
                row["location"]
            ),
        )

        session.add(record)

        # Add to local set immediately so duplicate
        # IDs within the same Excel file are also ignored.
        existing.add(source_id)

        added += 1

    session.commit()

    return len(df), added, skipped


# ============================================================
# IMPORT KAKINADA HAZARD DATASET
# ============================================================

def import_kakinada_hazards(session):

    require_file(HAZARD_FILE)

    print()
    print(f"Reading hazard dataset:")
    print(f"  {HAZARD_FILE}")

    df = pd.read_excel(HAZARD_FILE)

    print(f"Hazard rows found: {len(df)}")

    # --------------------------------------------------------
    # Validate columns
    # --------------------------------------------------------

    required_columns = {
        "Hazards_ID",
        "Type",
        "Severity",
        "Latitude",
        "Longitude_hazards",
    }

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            "Kakinada hazard dataset is missing columns: "
            f"{sorted(missing)}\n\n"
            f"Available columns:\n{list(df.columns)}"
        )

    # --------------------------------------------------------
    # Get already imported source IDs
    # --------------------------------------------------------

    existing_rows = (
        session.query(DatasetHazard.source_id)
        .filter(
            DatasetHazard.source_dataset
            == "kakinada_hazards_dataset_17000"
        )
        .all()
    )

    existing = {
        row[0]
        for row in existing_rows
    }

    print(
        f"Existing hazard dataset records: "
        f"{len(existing)}"
    )

    # --------------------------------------------------------
    # Import rows
    # --------------------------------------------------------

    added = 0
    skipped = 0

    for _, row in df.iterrows():

        source_id = normalize_text(
            row["Hazards_ID"]
        )

        # Ignore rows without an ID
        if not source_id:
            skipped += 1
            continue

        # Avoid duplicate imports
        if source_id in existing:
            skipped += 1
            continue

        latitude = safe_float(
            row["Latitude"]
        )

        longitude = safe_float(
            row["Longitude_hazards"]
        )

        # Coordinates are required for spatial hazards
        if latitude is None or longitude is None:
            skipped += 1
            continue

        record = DatasetHazard(
            source_id=source_id,

            source_dataset=(
                "kakinada_hazards_dataset_17000"
            ),

            hazard_type=normalize_text(
                row["Type"]
            ),

            severity=normalize_text(
                row["Severity"]
            ),

            latitude=latitude,

            longitude=longitude,
        )

        session.add(record)

        existing.add(source_id)

        added += 1

    session.commit()

    return len(df), added, skipped


# ============================================================
# MAIN IMPORT FUNCTION
# ============================================================

def main():

    print()
    print("=" * 60)
    print("ResQAI DATASET IMPORT")
    print("=" * 60)

    # --------------------------------------------------------
    # Import dataset models BEFORE create_all()
    # --------------------------------------------------------
    #
    # Because DatasetIncident and DatasetHazard have already
    # been imported above, SQLAlchemy knows about their tables.
    #

    Base.metadata.create_all(
        bind=engine
    )

    print()
    print("Database tables verified/created.")
    print()

    # Import Session only when required
    from sqlalchemy.orm import Session

    # --------------------------------------------------------
    # Open database session
    # --------------------------------------------------------

    with Session(engine) as session:

        # ----------------------------------------------------
        # Import incidents
        # ----------------------------------------------------

        (
            incident_total,
            incident_added,
            incident_skipped,
        ) = import_kakinada_incidents(
            session
        )

        # ----------------------------------------------------
        # Import hazards
        # ----------------------------------------------------

        (
            hazard_total,
            hazard_added,
            hazard_skipped,
        ) = import_kakinada_hazards(
            session
        )

        # ----------------------------------------------------
        # Get final database counts
        # ----------------------------------------------------

        incident_count = (
            session.query(
                DatasetIncident
            ).count()
        )

        hazard_count = (
            session.query(
                DatasetHazard
            ).count()
        )

    # ========================================================
    # FINAL REPORT
    # ========================================================

    print()
    print("=" * 60)
    print("ResQAI DATASET IMPORT COMPLETE")
    print("=" * 60)

    print()
    print("KAKINADA INCIDENT DATASET")
    print("-" * 60)

    print(
        f"Rows read     : {incident_total}"
    )

    print(
        f"Rows added    : {incident_added}"
    )

    print(
        f"Rows skipped   : {incident_skipped}"
    )

    print(
        f"Database total: {incident_count}"
    )

    print()
    print("KAKINADA HAZARD DATASET")
    print("-" * 60)

    print(
        f"Rows read     : {hazard_total}"
    )

    print(
        f"Rows added    : {hazard_added}"
    )

    print(
        f"Rows skipped   : {hazard_skipped}"
    )

    print(
        f"Database total: {hazard_count}"
    )

    print()
    print("-" * 60)
    print(
        "Operational Incident/Resource/Hazard "
        "tables were NOT modified."
    )

    print(
        "Historical dataset data remains separate "
        "from live operational data."
    )

    print(
        "Duplicate source IDs will be skipped "
        "if the importer is run again."
    )

    print("=" * 60)
    print()


# ============================================================
# SCRIPT ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()