from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.types import JSON

from database import Base


class DispatchAudit(Base):

    __tablename__ = "dispatch_audit"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    incident_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    incident_label = Column(
        String(80),
        nullable=True
    )

    incident_type = Column(
        String(80),
        nullable=True
    )

    priority = Column(
        String(20),
        nullable=True
    )

    priority_score = Column(
        Integer,
        nullable=True
    )

    decision = Column(
        String(20),
        nullable=False
    )

    resource_ids = Column(
        JSON,
        nullable=False,
        default=list
    )

    note = Column(
        Text,
        nullable=True
    )

    incident_status_after = Column(
        String(50),
        nullable=True
    )

    source = Column(
        String(100),
        nullable=True
    )

    recorded_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )