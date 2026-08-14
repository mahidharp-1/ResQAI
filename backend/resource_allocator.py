import json
from math import radians, sin, cos, sqrt, atan2

def distance_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2*R*atan2(sqrt(a), sqrt(1-a))

def allocate(incident, resources, required_resources):
    recommendations = []
    available = [r for r in resources if r.status == "AVAILABLE"]
    for req in required_resources:
        candidates = [r for r in available if req.lower() in r.resource_type.lower() or req.lower() in (r.capabilities or "").lower()]
        if not candidates:
            continue
        if incident.latitude is not None and incident.longitude is not None:
            chosen = min(candidates, key=lambda r: distance_km(incident.latitude, incident.longitude, r.latitude, r.longitude))
        else:
            chosen = candidates[0]
        available.remove(chosen)
        recommendations.append({
            "resource_id": chosen.resource_id,
            "resource_type": chosen.resource_type,
            "incident_id": incident.id,
            "reason": f"Available {chosen.resource_type} matched to required capability: {req}",
        })
    return recommendations
