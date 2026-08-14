from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from datetime import datetime
from database import Base

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True)
    description = Column(Text, nullable=False)
    incident_type = Column(String, default="other")
    severity = Column(String, default="LOW")
    severity_score = Column(Integer, default=0)
    priority = Column(String, default="P4")
    priority_score = Column(Integer, default=0)
    people_affected = Column(Integer, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String, default="NEW")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Resource(Base):
    __tablename__ = "resources"
    id = Column(Integer, primary_key=True)
    resource_id = Column(String, unique=True, nullable=False)
    resource_type = Column(String, nullable=False)
    status = Column(String, default="AVAILABLE")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity = Column(Integer, default=1)
    capabilities = Column(Text, default="")
    current_incident_id = Column(Integer, nullable=True)

class Hazard(Base):
    __tablename__ = "hazards"
    id = Column(Integer, primary_key=True)
    hazard_type = Column(String, nullable=False)
    description = Column(Text, default="")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    severity = Column(String, default="MODERATE")

class Assignment(Base):
    __tablename__ = "resource_assignments"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, nullable=False)
    resource_id = Column(String, nullable=False)
    reason = Column(Text, default="")
    eta_minutes = Column(Float, nullable=True)

class AIAnalysis(Base):
    __tablename__ = "ai_analysis"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, nullable=True)
    incident_type = Column(String)
    severity = Column(String)
    priority = Column(String)
    severity_score = Column(Integer)
    people_affected = Column(Integer)
    life_threatening = Column(String)
    location = Column(String)
    required_resources = Column(Text)
    hazards = Column(Text)
    confidence = Column(Float)
    reasoning = Column(Text)

class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, nullable=True)
    distance_km = Column(Float)
    duration_min = Column(Float)
    risk_score = Column(Integer)
    route_score = Column(Float)
    recommended = Column(Integer, default=0)
    reason = Column(Text, default="")

class IncidentHistory(Base):
    __tablename__ = "incident_history"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
