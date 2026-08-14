from priority_engine import calculate_priority
from database import SessionLocal
from models import Incident, Resource, Hazard


def seed_demo_data():
    """
    Seed the small live-demo dataset.

    Safe to call repeatedly:
    - incidents are inserted only when none exist
    - resources are inserted only when none exist
    - hazards are inserted only when none exist

    This is intentionally separate from the 17,000-row historical dataset.
    """

    db = SessionLocal()

    try:
        if db.query(Incident).count() == 0:
            incidents = [
                (
                    "Major road accident near North College. Two people injured and one unconscious. Traffic blocked.",
                    "road_accident", 3, 16.998, 82.247
                ),
                (
                    "Apartment fire with smoke visible from multiple floors. Several residents may be trapped.",
                    "fire", 12, 17.003, 82.255
                ),
                (
                    "Medical emergency: person unconscious at a community sports ground.",
                    "medical_emergency", 1, 17.010, 82.238
                ),
                (
                    "Waterlogging has submerged the main road after heavy rain.",
                    "flood", 8, 17.015, 82.261
                ),
                (
                    "Minor vehicle collision, no serious injuries reported.",
                    "road_accident", 2, 16.991, 82.250
                ),
                (
                    "Gas leak smell reported near a commercial kitchen.",
                    "gas_leak", 4, 17.007, 82.242
                ),
                (
                    "Elderly person reported missing from a residential area.",
                    "missing_vulnerable_person", 1, 16.986, 82.244
                ),
                (
                    "Construction material fell at a work site; one worker has a suspected injury.",
                    "industrial_accident", 1, 17.018, 82.251
                ),
                (
                    "Neighborhood power outage with no immediate injuries reported.",
                    "public_safety_incident", 0, 16.995, 82.235
                ),
                (
                    "Small roadside fire contained by nearby residents.",
                    "fire", 0, 17.021, 82.266
                ),
            ]

            for desc, typ, ppl, lat, lon in incidents:
                life = any(
                    x in desc.lower()
                    for x in [
                        "unconscious",
                        "trapped",
                        "serious",
                        "suspected injury",
                    ]
                )

                p = calculate_priority(
                    life,
                    ppl,
                    90 if life else 50,
                    80 if typ in [
                        "fire",
                        "gas_leak",
                        "industrial_accident",
                    ] else 40,
                    80 if life else 50,
                    50,
                )

                db.add(
                    Incident(
                        description=desc,
                        incident_type=typ,
                        severity=p["severity"],
                        severity_score=p["priority_score"],
                        priority=p["priority"],
                        priority_score=p["priority_score"],
                        people_affected=ppl,
                        latitude=lat,
                        longitude=lon,
                        status="NEW",
                    )
                )

        if db.query(Resource).count() == 0:
            resources = [
                ("AMB-01", "Ambulance", "AVAILABLE", 17.000, 82.240, 2, "trauma,ambulance"),
                ("AMB-02", "Ambulance", "AVAILABLE", 17.012, 82.250, 2, "ambulance,medical"),
                ("AMB-03", "Ambulance", "BUSY", 17.005, 82.260, 2, "trauma,ambulance"),
                ("FIRE-01", "Fire truck", "AVAILABLE", 17.004, 82.246, 6, "fire,foam,rescue"),
                ("FIRE-02", "Fire truck", "BUSY", 17.020, 82.260, 6, "fire,foam"),
                ("POL-01", "Police vehicle", "AVAILABLE", 16.998, 82.252, 4, "police,traffic"),
                ("POL-02", "Police vehicle", "AVAILABLE", 17.014, 82.240, 4, "police,traffic"),
                ("RES-01", "Rescue vehicle", "AVAILABLE", 17.006, 82.257, 8, "rescue,collapse,flood"),
                ("MED-01", "Medical team", "AVAILABLE", 17.011, 82.243, 5, "medical,triage"),
                ("DRT-01", "Disaster response team", "AVAILABLE", 17.017, 82.248, 12, "disaster,flood,collapse"),
            ]

            for x in resources:
                db.add(
                    Resource(
                        resource_id=x[0],
                        resource_type=x[1],
                        status=x[2],
                        latitude=x[3],
                        longitude=x[4],
                        capacity=x[5],
                        capabilities=x[6],
                    )
                )

        if db.query(Hazard).count() == 0:
            hazards = [
                ("Blocked road", "Vehicle accident debris", 17.000, 82.248, "HIGH"),
                ("Flooded road", "Waterlogging", 17.014, 82.260, "HIGH"),
                ("Fire", "Smoke plume near commercial area", 17.004, 82.256, "CRITICAL"),
                ("Construction", "Temporary road obstruction", 17.018, 82.251, "MODERATE"),
                ("Gas leak", "Reported gas odor", 17.007, 82.242, "HIGH"),
                ("Road closure", "Maintenance closure", 16.992, 82.236, "MODERATE"),
                ("Accident", "Minor collision zone", 16.991, 82.250, "MODERATE"),
                ("High-risk area", "Industrial access road", 17.020, 82.258, "HIGH"),
                ("Blocked road", "Debris after storm", 17.015, 82.244, "MODERATE"),
                ("Flooded road", "Low-lying underpass", 16.987, 82.247, "HIGH"),
            ]

            for x in hazards:
                db.add(
                    Hazard(
                        hazard_type=x[0],
                        description=x[1],
                        latitude=x[2],
                        longitude=x[3],
                        severity=x[4],
                    )
                )

        db.commit()

    finally:
        db.close()
