from pydantic import BaseModel, Field
from typing import Optional, List

class IncidentAnalyzeRequest(BaseModel):
    description: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    people_affected: Optional[int] = None

class IncidentCreate(BaseModel):
    description: str
    incident_type: str
    severity: str
    severity_score: int
    priority: str
    priority_score: int
    people_affected: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ResourceCreate(BaseModel):
    resource_id: str
    resource_type: str
    status: str = "AVAILABLE"
    latitude: float
    longitude: float
    capacity: int = 1
    capabilities: str = ""

class AllocationRequest(BaseModel):
    incident_id: int

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    destination_lat: float
    destination_lon: float

class HazardCreate(BaseModel):
    hazard_type: str
    description: str = ""
    latitude: float
    longitude: float
    severity: str = "MODERATE"

class AIQuery(BaseModel):
    question: str
