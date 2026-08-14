"""
ResQAI Dispatch Audit backend patch.

Purpose:
- Persist every human verification decision.
- Keep audit data separate from incidents/resources.
- Provide GET /api/dispatch-audit and POST /api/dispatch-audit.

Integration:
1. Add the imports below to backend/main.py.
2. Add the model class before Base.metadata.create_all(...) is executed.
3. Add the two routes below to main.py.
4. Restart uvicorn.

This patch is intentionally independent of the operational incident/resource
tables so audit history does not alter the live dispatch state.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.types import JSON

# Add to imports in main.py:
#
# from dispatch_audit_backend_patch import DispatchAudit
#
# Make sure `Base` is the same SQLAlchemy declarative Base used by the project.

class DispatchAudit(Base):
    __tablename__ = "dispatch_audit"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    incident_label = Column(String(80), nullable=True)
    incident_type = Column(String(80), nullable=True)
    priority = Column(String(20), nullable=True)
    priority_score = Column(Integer, nullable=True)
    decision = Column(String(20), nullable=False)
    resource_ids = Column(JSON, nullable=False, default=list)
    note = Column(Text, nullable=True)
    incident_status_after = Column(String(50), nullable=True)
    source = Column(String(100), nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# Add after the model is imported and before the API starts serving:
#
# Base.metadata.create_all(bind=engine)


# Add these routes to main.py:
#
# @app.post("/api/dispatch-audit")
# def create_dispatch_audit(payload: dict, db: Session = Depends(get_db)):
#     decision = str(payload.get("decision", "")).upper()
#     if decision not in {"APPROVE", "MODIFY", "REJECT"}:
#         raise HTTPException(status_code=400, detail="Invalid decision")
#
#     incident_id = payload.get("incident_id")
#     if incident_id is None:
#         raise HTTPException(status_code=400, detail="incident_id is required")
#
#     entry = DispatchAudit(
#         incident_id=int(incident_id),
#         incident_label=payload.get("incident_label"),
#         incident_type=payload.get("incident_type"),
#         priority=payload.get("priority"),
#         priority_score=payload.get("priority_score"),
#         decision=decision,
#         resource_ids=payload.get("resource_ids") or [],
#         note=payload.get("note"),
#         incident_status_after=payload.get("incident_status_after"),
#         source=payload.get("source", "ResQAI Human Verification"),
#     )
#     db.add(entry)
#     db.commit()
#     db.refresh(entry)
#
#     return {
#         "id": entry.id,
#         "incident_id": entry.incident_id,
#         "incident_label": entry.incident_label,
#         "incident_type": entry.incident_type,
#         "priority": entry.priority,
#         "priority_score": entry.priority_score,
#         "decision": entry.decision,
#         "resource_ids": entry.resource_ids or [],
#         "note": entry.note,
#         "incident_status_after": entry.incident_status_after,
#         "source": entry.source,
#         "recorded_at": entry.recorded_at.isoformat(),
#     }
#
#
# @app.get("/api/dispatch-audit")
# def list_dispatch_audit(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
#     limit = max(1, min(limit, 200))
#     offset = max(0, offset)
#
#     rows = (
#         db.query(DispatchAudit)
#         .order_by(DispatchAudit.recorded_at.desc(), DispatchAudit.id.desc())
#         .offset(offset)
#         .limit(limit)
#         .all()
#     )
#
#     return [
#         {
#             "id": x.id,
#             "incident_id": x.incident_id,
#             "incident_label": x.incident_label,
#             "incident_type": x.incident_type,
#             "priority": x.priority,
#             "priority_score": x.priority_score,
#             "decision": x.decision,
#             "resource_ids": x.resource_ids or [],
#             "note": x.note,
#             "incident_status_after": x.incident_status_after,
#             "source": x.source,
#             "recorded_at": x.recorded_at.isoformat() if x.recorded_at else None,
#         }
#         for x in rows
#     ]
