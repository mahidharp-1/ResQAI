import re

from config import DEMO_MODE, AI_API_KEY, AI_MODEL


CATEGORIES = [
    "road_accident",
    "fire",
    "medical_emergency",
    "flood",
    "building_collapse",
    "gas_leak",
    "industrial_accident",
    "missing_vulnerable_person",
    "public_safety_incident",
    "other",
]


NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def _contains(text, terms):
    return any(term in text for term in terms)


def extract_people_count(text):
    """
    Extract people affected from both numeric and word-based descriptions.

    Examples:
        "2 people injured" -> 2
        "two people injured" -> 2
        "two people injured and one person unconscious" -> 3
        "five workers trapped" -> 5
    """

    total = 0
    found = False

    # Numeric forms:
    # 2 people
    # 3 persons
    # 4 victims
    # 5 workers
    numeric_pattern = re.compile(
        r"\b(\d+)\s+"
        r"(people|persons|victims|workers|children|students|patients|individuals)\b",
        re.IGNORECASE,
    )

    for match in numeric_pattern.finditer(text):
        total += int(match.group(1))
        found = True

    # Word-number forms:
    # two people
    # one person
    # five workers
    word_pattern = re.compile(
        r"\b("
        + "|".join(NUMBER_WORDS.keys())
        + r")\s+"
        r"(people|person|persons|victims|workers|children|students|patients|individuals)\b",
        re.IGNORECASE,
    )

    for match in word_pattern.finditer(text):
        total += NUMBER_WORDS[match.group(1).lower()]
        found = True

    if found:
        return total

    return 0


def detect_incident_type(text):
    if _contains(
        text,
        [
            "accident",
            "crash",
            "collision",
            "vehicle accident",
            "road accident",
            "car accident",
            "bike accident",
        ],
    ):
        return "road_accident"

    if _contains(
        text,
        [
            "fire",
            "flames",
            "burning",
            "burning building",
            "smoke",
        ],
    ):
        return "fire"

    if _contains(
        text,
        [
            "unconscious",
            "not breathing",
            "heart attack",
            "cardiac",
            "severe bleeding",
            "medical emergency",
            "injured",
            "injury",
        ],
    ):
        return "medical_emergency"

    if _contains(
        text,
        [
            "flood",
            "flooded",
            "waterlogging",
            "waterlogged",
            "submerged",
        ],
    ):
        return "flood"

    if _contains(
        text,
        [
            "building collapse",
            "building collapsed",
            "collapse",
            "collapsed",
            "structure fell",
        ],
    ):
        return "building_collapse"

    if _contains(
        text,
        [
            "gas leak",
            "gas smell",
            "gas leakage",
            "lpg leak",
        ],
    ):
        return "gas_leak"

    if _contains(
        text,
        [
            "factory accident",
            "industrial accident",
            "industrial",
            "chemical leak",
            "factory explosion",
        ],
    ):
        return "industrial_accident"

    if _contains(
        text,
        [
            "missing",
            "lost child",
            "missing child",
            "vulnerable person",
            "elderly person missing",
        ],
    ):
        return "missing_vulnerable_person"

    if _contains(
        text,
        [
            "fight",
            "threat",
            "weapon",
            "public safety",
            "violence",
        ],
    ):
        return "public_safety_incident"

    return "other"


def analyze_demo(description, location=None, people_affected=None):
    """
    Deterministic demo-mode incident understanding.

    IMPORTANT:
    This is an extraction/classification layer.
    The final priority is calculated separately by priority_engine.py.
    """

    text = description.lower().strip()
    incident_type = detect_incident_type(text)

    # Extract people from the description first.
    extracted_people = extract_people_count(text)

    # Explicit structured input can be used when the description
    # contains no usable people count.
    if extracted_people > 0:
        final_people = extracted_people
    elif people_affected is not None:
        final_people = max(0, int(people_affected))
    else:
        final_people = 0

    # Strong life-threatening indicators.
    life_threatening = _contains(
        text,
        [
            "unconscious",
            "not breathing",
            "no pulse",
            "severe bleeding",
            "heavy bleeding",
            "trapped",
            "critical condition",
            "life threatening",
            "life-threatening",
            "major fire",
            "explosion",
            "building collapsed",
        ],
    )

    hazards = []

    if _contains(
        text,
        [
            "traffic",
            "traffic blocked",
            "traffic blockage",
            "road blocked",
            "blocked road",
        ],
    ):
        hazards.append("traffic blockage")

    if _contains(
        text,
        [
            "smoke",
            "fire",
            "flames",
            "burning",
        ],
    ):
        hazards.append("smoke/fire")

    if _contains(
        text,
        [
            "gas",
            "gas leak",
            "gas leakage",
        ],
    ):
        hazards.append("gas exposure")

    if _contains(
        text,
        [
            "flood",
            "flooded",
            "waterlogging",
            "waterlogged",
        ],
    ):
        hazards.append("flooded road")

    if _contains(
        text,
        [
            "explosion",
            "blast",
        ],
    ):
        hazards.append("explosion risk")

    # Required resources.
    # Resource requirements are based on both the incident type
    # and specific emergency conditions detected in the description.
    required_resources = []

    # ---------------------------------------------------------
    # CORE INCIDENT-BASED RESOURCES
    # ---------------------------------------------------------

    if incident_type in [
        "road_accident",
        "medical_emergency",
    ]:
        required_resources.append("ambulance")

    if incident_type in [
        "road_accident",
        "public_safety_incident",
        "missing_vulnerable_person",
    ]:
        required_resources.append("police")

    if incident_type in [
        "fire",
        "gas_leak",
        "industrial_accident",
    ]:
        required_resources.append("fire truck")

    if incident_type in [
        "building_collapse",
        "flood",
    ]:
        required_resources.append("rescue vehicle")
        required_resources.append("disaster response team")

    if incident_type == "industrial_accident":
        required_resources.append("medical team")

    # ---------------------------------------------------------
    # CONDITION-BASED RESOURCES
    # ---------------------------------------------------------

    # Trapped people or blocked access require rescue support.
    if _contains(
        text,
        [
            "trapped",
            "people trapped",
            "person trapped",
            "unable to escape",
            "blocked entrance",
            "entrance blocked",
            "collapsed",
        ],
    ):
        required_resources.append("rescue vehicle")

    # Unconscious or seriously injured people require an ambulance.
    if _contains(
        text,
        [
            "unconscious",
            "not breathing",
            "no pulse",
            "severe bleeding",
            "heavy bleeding",
            "critical condition",
            "life threatening",
            "life-threatening",
        ],
    ):
        required_resources.append("ambulance")

    # Traffic blockage requires police/traffic-control support.
    if _contains(
        text,
        [
            "traffic blocked",
            "traffic blockage",
            "traffic congestion",
            "traffic is congested",
            "traffic congested",
            "congested traffic",
            "road blocked",
            "blocked road",
            "traffic cannot pass",
            "traffic jam",
            "heavy traffic",
        ],
    ):
        required_resources.append("police")

    # Gas exposure requires fire/hazard response.
    if _contains(
        text,
        [
            "gas leak",
            "gas leakage",
            "strong gas smell",
            "gas smell",
        ],
    ):
        required_resources.append("fire truck")

    # Flooding requires rescue capability.
    if _contains(
        text,
        [
            "flood",
            "flooded",
            "waterlogging",
            "waterlogged",
            "vehicles are stranded",
        ],
    ):
        required_resources.append("rescue vehicle")

    # ---------------------------------------------------------
    # FALLBACK
    # ---------------------------------------------------------

    if not required_resources:
        required_resources.append("police")

    # Remove duplicate resources.
    required_resources = sorted(set(required_resources))

    # Deterministic factors passed to priority_engine.py.
    if life_threatening:
        severity_factor = 95
        escalation_risk = 90
        time_sensitivity = 95
    elif incident_type in [
        "fire",
        "gas_leak",
        "building_collapse",
        "industrial_accident",
    ]:
        severity_factor = 75
        escalation_risk = 85
        time_sensitivity = 80
    elif final_people >= 3:
        severity_factor = 70
        escalation_risk = 60
        time_sensitivity = 70
    elif incident_type != "other":
        severity_factor = 55
        escalation_risk = 45
        time_sensitivity = 55
    else:
        severity_factor = 30
        escalation_risk = 25
        time_sensitivity = 30

    location_sensitivity = 60 if location else 30

    reasoning = []

    if life_threatening:
        reasoning.append("Life-threatening condition detected")
    else:
        reasoning.append("No explicit life-threatening condition detected")

    reasoning.append(
        f"Incident classified as {incident_type}"
    )

    if final_people > 0:
        reasoning.append(
            f"{final_people} people affected based on the emergency description"
        )
    else:
        reasoning.append(
            "Number of people affected is unknown"
        )

    if hazards:
        reasoning.append(
            "Detected hazards: " + ", ".join(hazards)
        )

    if location:
        reasoning.append("Location supplied by user")
    else:
        reasoning.append(
            "Location name is unknown; coordinates may still be supplied separately"
        )

    return {
        "incident_type": incident_type,
        "severity": "CRITICAL" if life_threatening else "MODERATE",
        "priority": "P1" if life_threatening else "P3",
        "severity_score": severity_factor,
        "people_affected": final_people,
        "life_threatening": life_threatening,
        "location": location if location else "unknown",
        "required_resources": sorted(set(required_resources)),
        "hazards": hazards if hazards else ["unknown"],
        "confidence": (
            0.95
            if incident_type != "other"
            else 0.60
        ),
        "reasoning": reasoning,
        "_factors": {
            "severity_factor": severity_factor,
            "escalation_risk": escalation_risk,
            "time_sensitivity": time_sensitivity,
            "location_sensitivity": location_sensitivity,
        },
    }


def analyze_incident(
    description,
    location=None,
    people_affected=None,
):
    """
    Provider abstraction.

    For the hackathon demo, deterministic demo mode is used.
    A real AI provider can be integrated here later while
    preserving the same response schema.
    """

    return analyze_demo(
        description=description,
        location=location,
        people_affected=people_affected,
    )