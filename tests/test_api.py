import sys
sys.path.insert(0, "backend")
from fastapi.testclient import TestClient
from main import app

client=TestClient(app)

def test_health():
    assert client.get("/api/health").status_code==200

def test_analysis_endpoint():
    r=client.post("/api/incidents/analyze",json={"description":"Person unconscious after accident","location":"North College"})
    assert r.status_code==200
    assert "priority_score" in r.json()

def test_hazards_endpoint():
    assert client.get("/api/hazards").status_code==200
