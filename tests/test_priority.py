import sys
sys.path.insert(0, "backend")
from priority_engine import calculate_priority

def test_critical_life_threat():
    r = calculate_priority(True, 3, 90, 80, 90, 60)
    assert r["priority"] == "P1"
    assert r["severity"] == "CRITICAL"

def test_low_incident():
    r = calculate_priority(False, 0, 10, 10, 10, 10)
    assert r["priority"] == "P4"

def test_people_affect_score():
    a = calculate_priority(False, 1, 50, 40, 50, 50)
    b = calculate_priority(False, 8, 50, 40, 50, 50)
    assert b["priority_score"] > a["priority_score"]
