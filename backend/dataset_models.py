from sqlalchemy import Column, Integer, String, Float, Text, Index
from database import Base


class DatasetIncident(Base):
    """
    Historical/training incidents imported from the 17,000-row Excel datasets.

    These are intentionally separate from the live Incident table so importing
    17,000 historical records does not pollute the operational Command Center.
    """
    __tablename__ = "dataset_incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(64), nullable=False, index=True)
    source_dataset = Column(String(100), nullable=False, index=True)
    incident_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(30), nullable=False, index=True)
    priority_label = Column(String(30), nullable=False, index=True)
    people_affected = Column(Integer, default=0)
    description = Column(Text, nullable=False)
    location = Column(String(150), nullable=True, index=True)


class DatasetHazard(Base):
    """
    Historical/spatial hazard events imported from the 17,000-row hazard file.

    Kept separate from the small operational Hazard table. This avoids turning
    the live hazard layer into 17,000 permanent active hazards.
    """
    __tablename__ = "dataset_hazards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(64), nullable=False, index=True)
    source_dataset = Column(String(100), nullable=False, index=True)
    hazard_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(30), nullable=False, index=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)


Index("ix_dataset_incident_type_severity", DatasetIncident.incident_type, DatasetIncident.severity)
Index("ix_dataset_hazard_lat_lon", DatasetHazard.latitude, DatasetHazard.longitude)