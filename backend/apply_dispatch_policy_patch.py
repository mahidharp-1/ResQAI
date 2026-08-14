from pathlib import Path
import shutil

TARGET = Path("main.py")
BACKUP = Path("main.py.before_dispatch_policy_patch")

if not TARGET.exists():
    raise SystemExit(
        "main.py was not found. Run this script from C:\\Projects\\ResQAI\\backend"
    )

source = TARGET.read_text(encoding="utf-8")

if BACKUP.exists():
    print(f"Backup already exists: {BACKUP}")
else:
    shutil.copy2(TARGET, BACKUP)
    print(f"Backup created: {BACKUP}")

if '@app.post("/api/incidents/{incident_id}/auto-dispatch")' in source:
    print("Dispatch policy endpoints already exist. Nothing to add.")
else:
    marker = '@app.post("/api/incidents/{incident_id}/verify")'

    if marker not in source:
        raise SystemExit(
            "Could not find the existing /api/incidents/{incident_id}/verify endpoint."
        )

    patch = '# ============================================================\n# RISK-AWARE DISPATCH POLICY\n# ============================================================\n\n@app.get("/api/incidents/{incident_id}/dispatch-policy")\ndef incident_dispatch_policy(incident_id: int, db: Session = Depends(get_db)):\n    incident = db.get(Incident, incident_id)\n    if not incident:\n        raise HTTPException(status_code=404, detail="Incident not found")\n\n    priority = str(incident.priority or "P4").upper()\n    if priority in {"P1", "P2"}:\n        return {\n            "incident_id": incident.id,\n            "priority": priority,\n            "human_approval_required": True,\n            "ai_auto_dispatch_allowed": False,\n            "label": "HUMAN APPROVAL REQUIRED",\n            "reason": "High-risk incidents require trained human authorization before dispatch."\n        }\n\n    return {\n        "incident_id": incident.id,\n        "priority": priority,\n        "human_approval_required": False,\n        "ai_auto_dispatch_allowed": True,\n        "label": "AI AUTO-DISPATCH ELIGIBLE",\n        "reason": "Lower-priority incidents may be dispatched automatically when compatible resources are available. Human override remains available."\n    }\n\n\n@app.post("/api/incidents/{incident_id}/auto-dispatch")\ndef auto_dispatch_incident(incident_id: int, db: Session = Depends(get_db)):\n    """Demo-mode automatic dispatch for P3/P4 only."""\n    incident = db.get(Incident, incident_id)\n    if not incident:\n        raise HTTPException(status_code=404, detail="Incident not found")\n\n    priority = str(incident.priority or "P4").upper()\n    if priority not in {"P3", "P4"}:\n        raise HTTPException(\n            status_code=403,\n            detail=f"AI auto-dispatch is disabled for {priority}. Human approval is required."\n        )\n\n    if str(incident.status or "").upper() != "NEW":\n        raise HTTPException(\n            status_code=409,\n            detail=f"Incident is {incident.status or "ACTIVE"} and cannot be auto-dispatched again."\n        )\n\n    try:\n        _, required_resources, recommendations = _build_resource_recommendations(\n            incident,\n            db\n        )\n    except NameError:\n        raise HTTPException(\n            status_code=500,\n            detail="Recommendation engine is not installed. Install the human verification recommendation patch first."\n        )\n\n    selected_ids = [\n        x["resource_id"]\n        for x in recommendations\n        if x.get("recommended")\n        and x.get("available") is not False\n        and str(x.get("status", "")).upper() == "AVAILABLE"\n    ]\n\n    if not selected_ids:\n        raise HTTPException(\n            status_code=409,\n            detail="No compatible AVAILABLE resource is currently available. The incident remains NEW."\n        )\n\n    # Reuse the existing verification function so resource availability\n    # checks and state changes remain centralized.\n    result = verify_incident_recommendation(\n        incident_id,\n        {\n            "decision": "APPROVE",\n            "resource_ids": selected_ids,\n            "note": f"AI auto-dispatch executed in demo mode for {priority} incident."\n        },\n        db\n    )\n\n    return {\n        "incident_id": incident.id,\n        "priority": priority,\n        "dispatch_mode": "AI_AUTO",\n        "required_resources": required_resources,\n        "assigned_resources": result.get("assigned_resources", []),\n        "status": "RESOURCE_ASSIGNED",\n        "message": "AI auto-dispatch completed for a lower-priority incident. Human override remains available."\n    }\n\n'
    source = source.replace(marker, patch + "\n" + marker, 1)
    TARGET.write_text(source, encoding="utf-8")
    print("Dispatch policy endpoints added successfully.")

print("Run: python -m py_compile main.py")
print("Then restart Uvicorn.")
print("P1/P2 auto-dispatch must return HTTP 403.")
print("P3/P4 may auto-dispatch AVAILABLE resources.")