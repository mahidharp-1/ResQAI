DEFAULT_WEIGHTS = {
    "life_threat": 30,
    "people_affected": 20,
    "severity": 20,
    "escalation_risk": 15,
    "time_sensitivity": 10,
    "location_sensitivity": 5,
}


def clamp(value, minimum=0, maximum=100):
    return max(
        minimum,
        min(maximum, int(round(value)))
    )


def calculate_priority(
    life_threat: bool,
    people_affected: int,
    severity_factor: int,
    escalation_risk: int,
    time_sensitivity: int,
    location_sensitivity: int,
    weights=None,
):
    """
    Deterministic and explainable priority engine.

    Score components:

    Life threat          30%
    People affected      20%
    Severity             20%
    Escalation risk      15%
    Time sensitivity     10%
    Location sensitivity 5%

    Final classification:

    81-100 = CRITICAL / P1
    61-80  = HIGH / P2
    31-60  = MODERATE / P3
    0-30   = LOW / P4
    """

    w = weights or DEFAULT_WEIGHTS

    people_affected = max(
        0,
        int(people_affected or 0)
    )

    # Five or more affected people reaches the maximum
    # people-impact factor.
    people_factor = min(
        people_affected / 5,
        1.0
    ) * 100

    life_factor = 100 if life_threat else 0

    severity_factor = clamp(severity_factor)
    escalation_risk = clamp(escalation_risk)
    time_sensitivity = clamp(time_sensitivity)
    location_sensitivity = clamp(location_sensitivity)

    score = (
        life_factor * w["life_threat"] / 100
        + people_factor * w["people_affected"] / 100
        + severity_factor * w["severity"] / 100
        + escalation_risk * w["escalation_risk"] / 100
        + time_sensitivity * w["time_sensitivity"] / 100
        + location_sensitivity * w["location_sensitivity"] / 100
    )

    score = clamp(score)

    # A confirmed life-threatening condition should never
    # fall into P2/P3/P4 because of a low population count
    # or missing location information.
    if life_threat:
        score = max(score, 81)

    if score >= 81:
        severity = "CRITICAL"
        priority = "P1"

    elif score >= 61:
        severity = "HIGH"
        priority = "P2"

    elif score >= 31:
        severity = "MODERATE"
        priority = "P3"

    else:
        severity = "LOW"
        priority = "P4"

    explanation = []

    if life_threat:
        explanation.append(
            "Life-threatening condition detected"
        )

    if people_affected >= 3:
        explanation.append(
            f"Multiple people affected ({people_affected})"
        )

    elif people_affected > 0:
        explanation.append(
            f"{people_affected} person(s) affected"
        )

    if severity_factor >= 70:
        explanation.append(
            "High incident severity"
        )

    if escalation_risk >= 70:
        explanation.append(
            "High escalation potential"
        )

    if time_sensitivity >= 70:
        explanation.append(
            "High time sensitivity"
        )

    if location_sensitivity >= 70:
        explanation.append(
            "Sensitive location context"
        )

    if not explanation:
        explanation.append(
            "No high-risk indicators detected"
        )

    return {
        "priority_score": score,
        "priority": priority,
        "severity": severity,
        "explanation": explanation,
    }