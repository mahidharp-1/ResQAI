import sys
sys.path.insert(0, "backend")
from ai_service import analyze_incident

def test_accident_classification():
    r=analyze_incident("Major road accident. One person is unconscious.")
    assert r["incident_type"]=="road_accident"
    assert r["life_threatening"] is True

def test_fire_classification():
    r=analyze_incident("Major fire with smoke and flames.")
    assert r["incident_type"]=="fire"

def test_missing_location_is_unknown():
    r=analyze_incident("Someone needs help.")
    assert r["location"]=="unknown"
