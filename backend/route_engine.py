import math
import httpx

from config import ROUTING_BASE_URL


# =========================================================
# SEVERITY SCORES
# =========================================================

SEVERITY_SCORE = {
    "LOW": 10,
    "MODERATE": 25,
    "HIGH": 45,
    "CRITICAL": 70,
}


# =========================================================
# GEO FUNCTIONS
# =========================================================

def point_to_segment_distance(
    point_lat,
    point_lon,
    start_lat,
    start_lon,
    end_lat,
    end_lon,
):
    """
    Approximate distance from a geographic point
    to a line segment in kilometres.
    """

    avg_lat = math.radians(
        (start_lat + end_lat + point_lat) / 3
    )

    px = point_lon * 111.0 * math.cos(avg_lat)
    py = point_lat * 111.0

    ax = start_lon * 111.0 * math.cos(avg_lat)
    ay = start_lat * 111.0

    bx = end_lon * 111.0 * math.cos(avg_lat)
    by = end_lat * 111.0

    abx = bx - ax
    aby = by - ay

    apx = px - ax
    apy = py - ay

    ab_squared = (
        abx * abx +
        aby * aby
    )

    if ab_squared == 0:
        return math.sqrt(
            (px - ax) ** 2 +
            (py - ay) ** 2
        )

    t = (
        apx * abx +
        apy * aby
    ) / ab_squared

    t = max(
        0.0,
        min(1.0, t)
    )

    closest_x = ax + t * abx
    closest_y = ay + t * aby

    return math.sqrt(
        (px - closest_x) ** 2 +
        (py - closest_y) ** 2
    )


def point_to_route_distance(
    point_lat,
    point_lon,
    geometry,
):
    """
    Return minimum distance from a hazard point
    to an OSRM route geometry.
    """

    if not geometry or len(geometry) < 2:
        return float("inf")

    minimum = float("inf")

    for i in range(len(geometry) - 1):

        start_lon, start_lat = geometry[i]
        end_lon, end_lat = geometry[i + 1]

        distance = point_to_segment_distance(
            point_lat,
            point_lon,
            start_lat,
            start_lon,
            end_lat,
            end_lon,
        )

        minimum = min(
            minimum,
            distance,
        )

    return minimum


# =========================================================
# HAZARD HELPERS
# =========================================================

def get_hazard_type(hazard):

    return (
        hazard.get("type")
        or hazard.get("hazard_type")
        or hazard.get("name")
        or "Unknown hazard"
    )


def get_hazard_source(hazard):

    return (
        hazard.get("source")
        or "operational"
    )


def calculate_hazard_risk(
    geometry,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    hazards,
):
    """
    Calculate current/operational hazard risk.

    Historical hazards are handled separately so that
    historical exposure does not overpower a real-time hazard.
    """

    encountered = []
    severity_values = []

    for hazard in hazards:

        lat = hazard.get("latitude")
        lon = hazard.get("longitude")

        if lat is None or lon is None:
            continue

        try:
            lat = float(lat)
            lon = float(lon)
        except (
            ValueError,
            TypeError,
        ):
            continue

        if geometry:

            distance = point_to_route_distance(
                lat,
                lon,
                geometry,
            )

        else:

            distance = point_to_segment_distance(
                lat,
                lon,
                origin_lat,
                origin_lon,
                destination_lat,
                destination_lon,
            )

        # 250 metre route safety corridor
        if distance <= 0.25:

            severity = str(
                hazard.get(
                    "severity",
                    "MODERATE",
                )
            ).upper()

            severity_value = SEVERITY_SCORE.get(
                severity,
                25,
            )

            encountered.append(
                {
                    "type": get_hazard_type(hazard),
                    "severity": severity,
                    "distance_km": round(
                        distance,
                        2,
                    ),
                    "source": get_hazard_source(
                        hazard
                    ),
                }
            )

            severity_values.append(
                severity_value
            )

    if not encountered:
        return 5, []

    average_severity = (
        sum(severity_values)
        / len(severity_values)
    )

    count_penalty = min(
        len(encountered) * 8,
        25,
    )

    risk = int(
        average_severity * 0.90
        + count_penalty
    )

    return (
        min(100, max(0, risk)),
        encountered,
    )


# =========================================================
# HISTORICAL HAZARD RISK
# =========================================================

def calculate_historical_risk(
    geometry,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    historical_hazards,
):
    """
    Historical hazards are used as a risk signal.

    They should influence route selection, but they should
    never overpower a real-time emergency hazard.

    Historical exposure is therefore capped.
    """

    encountered = []
    severity_values = []

    for hazard in historical_hazards:

        lat = hazard.get("latitude")
        lon = hazard.get("longitude")

        if lat is None or lon is None:
            continue

        try:
            lat = float(lat)
            lon = float(lon)
        except (
            ValueError,
            TypeError,
        ):
            continue

        if geometry:

            distance = point_to_route_distance(
                lat,
                lon,
                geometry,
            )

        else:

            distance = point_to_segment_distance(
                lat,
                lon,
                origin_lat,
                origin_lon,
                destination_lat,
                destination_lon,
            )

        # Historical corridor is slightly wider.
        # Historical data represents exposure rather
        # than a confirmed current emergency.
        if distance <= 0.40:

            severity = str(
                hazard.get(
                    "severity",
                    "MODERATE",
                )
            ).upper()

            severity_value = SEVERITY_SCORE.get(
                severity,
                25,
            )

            encountered.append(
                {
                    "type": get_hazard_type(hazard),
                    "severity": severity,
                    "distance_km": round(
                        distance,
                        2,
                    ),
                    "source": "historical",
                }
            )

            severity_values.append(
                severity_value
            )

    if not encountered:
        return 0, []

    average_severity = (
        sum(severity_values)
        / len(severity_values)
    )

    count = len(encountered)

    # Historical exposure has intentionally lower weight.
    density_penalty = min(
        count * 2,
        15,
    )

    severity_component = (
        average_severity * 0.12
    )

    historical_risk = int(
        severity_component
        + density_penalty
    )

    # Never allow historical data alone to create
    # an extreme route risk.
    historical_risk = min(
        30,
        max(0, historical_risk),
    )

    return (
        historical_risk,
        encountered,
    )


# =========================================================
# COMBINED RISK
# =========================================================

def calculate_combined_risk(
    geometry,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    current_hazards,
    historical_hazards,
):
    """
    Combine real-time hazards and historical exposure.

    Current hazards have significantly higher weight.
    Historical exposure is supporting evidence.
    """

    current_risk, current_encountered = (
        calculate_hazard_risk(
            geometry,
            origin_lat,
            origin_lon,
            destination_lat,
            destination_lon,
            current_hazards,
        )
    )

    historical_risk, historical_encountered = (
        calculate_historical_risk(
            geometry,
            origin_lat,
            origin_lon,
            destination_lat,
            destination_lon,
            historical_hazards,
        )
    )

    # Current hazards dominate.
    combined_risk = int(
        current_risk
        + historical_risk * 0.35
    )

    combined_risk = min(
        100,
        max(0, combined_risk),
    )

    return (
        combined_risk,
        current_encountered,
        historical_encountered,
    )


# =========================================================
# ROUTE SCORE
# =========================================================

def route_score(
    duration_min,
    risk_score,
):
    """
    Lower score = better route.

    Emergency routing balances ETA and safety.
    """

    return round(
        duration_min * 0.60
        + risk_score * 0.40,
        2,
    )


# =========================================================
# OSRM
# =========================================================

async def request_osrm(
    client,
    coordinates,
    route_prefix,
):

    coordinate_string = ";".join(
        f"{lon},{lat}"
        for lat, lon in coordinates
    )

    url = (
        f"{ROUTING_BASE_URL}"
        f"/route/v1/driving/"
        f"{coordinate_string}"
    )

    params = {
        "alternatives": "true",
        "overview": "full",
        "geometries": "geojson",
    }

    response = await client.get(
        url,
        params=params,
    )

    response.raise_for_status()

    data = response.json()

    output = []

    for index, route in enumerate(
        data.get("routes", [])
    ):

        geometry = (
            route
            .get("geometry", {})
            .get("coordinates", [])
        )

        output.append(
            {
                "route_id":
                    f"{route_prefix}-{index + 1}",

                "distance":
                    route["distance"],

                "duration":
                    route["duration"],

                "geometry":
                    geometry,
            }
        )

    return output


# =========================================================
# ROUTE BUILDER
# =========================================================

def build_route(
    route_data,
    route_id,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    current_hazards,
    historical_hazards,
):

    geometry = route_data.get(
        "geometry",
        [],
    )

    (
        risk,
        current_encountered,
        historical_encountered,
    ) = calculate_combined_risk(
        geometry,
        origin_lat,
        origin_lon,
        destination_lat,
        destination_lon,
        current_hazards,
        historical_hazards,
    )

    distance = round(
        route_data["distance"] / 1000,
        2,
    )

    duration = round(
        route_data["duration"] / 60,
        1,
    )

    score = route_score(
        duration,
        risk,
    )

    return {
        "route_id": route_id,
        "distance_km": distance,
        "duration_min": duration,

        "risk_score": risk,
        "route_score": score,

        "hazards_encountered": [
            h["type"]
            for h in current_encountered
        ],

        "historical_hazards_count":
            len(historical_encountered),

        "historical_high_critical_count":
            sum(
                1
                for h in historical_encountered
                if h["severity"]
                in {
                    "HIGH",
                    "CRITICAL",
                }
            ),

        "historical_hazards_encountered": [
            h["type"]
            for h in historical_encountered[:10]
        ],

                "geometry": geometry,
"recommended": False,
    }


# =========================================================
# MAIN ENGINE
# =========================================================

async def recommend_route(
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    hazards,
    historical_hazards=None,
):

    if historical_hazards is None:
        historical_hazards = []

    try:

        async with httpx.AsyncClient(
            timeout=8
        ) as client:

            all_routes = []

            # =============================================
            # DIRECT ROUTE
            # =============================================

            direct_routes = await request_osrm(
                client,
                [
                    (
                        origin_lat,
                        origin_lon,
                    ),
                    (
                        destination_lat,
                        destination_lon,
                    ),
                ],
                "direct",
            )

            all_routes.extend(
                direct_routes
            )

            # =============================================
            # DETOURS
            # =============================================

            mid_lat = (
                origin_lat
                + destination_lat
            ) / 2

            mid_lon = (
                origin_lon
                + destination_lon
            ) / 2

            dlat = (
                destination_lat
                - origin_lat
            )

            dlon = (
                destination_lon
                - origin_lon
            )

            length = math.sqrt(
                dlat * dlat
                + dlon * dlon
            )

            if length > 0:

                # -----------------------------------------
                # DETOUR A
                # -----------------------------------------

                offset = 0.012

                waypoint1 = (
                    mid_lat
                    - (dlon / length) * offset,

                    mid_lon
                    + (dlat / length) * offset,
                )

                detour1 = await request_osrm(
                    client,
                    [
                        (
                            origin_lat,
                            origin_lon,
                        ),
                        waypoint1,
                        (
                            destination_lat,
                            destination_lon,
                        ),
                    ],
                    "detour-a",
                )

                all_routes.extend(
                    detour1
                )

                # -----------------------------------------
                # DETOUR B
                # -----------------------------------------

                offset = 0.020

                waypoint2 = (
                    mid_lat
                    - (dlon / length) * offset,

                    mid_lon
                    + (dlat / length) * offset,
                )

                detour2 = await request_osrm(
                    client,
                    [
                        (
                            origin_lat,
                            origin_lon,
                        ),
                        waypoint2,
                        (
                            destination_lat,
                            destination_lon,
                        ),
                    ],
                    "detour-b",
                )

                all_routes.extend(
                    detour2
                )

            # =============================================
            # BUILD UNIQUE ROUTES
            # =============================================

            routes = []

            seen = set()

            for route_data in all_routes:

                route_id = route_data[
                    "route_id"
                ]

                if route_id in seen:
                    continue

                seen.add(
                    route_id
                )

                route = build_route(
                    route_data,
                    route_id,
                    origin_lat,
                    origin_lon,
                    destination_lat,
                    destination_lon,
                    hazards,
                    historical_hazards,
                )

                routes.append(
                    route
                )

            # =============================================
            # KEEP BEST THREE
            # =============================================

            routes.sort(
                key=lambda x:
                x["route_score"]
            )

            routes = routes[:3]

            if routes:

                best = min(
                    routes,
                    key=lambda x:
                    x["route_score"]
                )

                for route in routes:

                    route["recommended"] = (
                        route["route_id"]
                        == best["route_id"]
                    )

                if best["risk_score"] <= 20:

                    reason = (
                        "Recommended because this "
                        "route has low current hazard "
                        "exposure and limited historical "
                        "hazard exposure while maintaining "
                        "efficient travel time."
                    )

                elif best["risk_score"] <= 50:

                    reason = (
                        "Recommended by balancing "
                        "travel time with current and "
                        "historical hazard exposure."
                    )

                else:

                    reason = (
                        "Recommended because it has "
                        "the lowest combined ETA and "
                        "hazard-risk score among the "
                        "available route options."
                    )

                return {
                    "source": "OSRM",

                    "historical_data_used":
                        len(historical_hazards) > 0,

                    "routes": routes,

                    "reason": reason,
                }

    except Exception:
        pass

    # =====================================================
    # DEMO FALLBACK
    # =====================================================

    base_distance = math.sqrt(
        (
            (
                destination_lat
                - origin_lat
            ) * 111
        ) ** 2
        +
        (
            (
                destination_lon
                - origin_lon
            )
            * 111
            * math.cos(
                math.radians(
                    origin_lat
                )
            )
        ) ** 2
    )

    direct_duration = (
        base_distance * 2
    )

    (
        direct_risk,
        direct_current,
        direct_historical,
    ) = calculate_combined_risk(
        None,
        origin_lat,
        origin_lon,
        destination_lat,
        destination_lon,
        hazards,
        historical_hazards,
    )

    routes = [
        {
            "route_id":
                "demo-direct",

            "distance_km":
                round(
                    base_distance,
                    2,
                ),

            "duration_min":
                round(
                    direct_duration,
                    1,
                ),

            "risk_score":
                direct_risk,

            "route_score":
                route_score(
                    direct_duration,
                    direct_risk,
                ),

            "hazards_encountered": [
                h["type"]
                for h in direct_current
            ],

            "historical_hazards_count":
                len(direct_historical),

            "historical_high_critical_count":
                sum(
                    1
                    for h in direct_historical
                    if h["severity"]
                    in {
                        "HIGH",
                        "CRITICAL",
                    }
                ),

            "historical_hazards_encountered": [
                h["type"]
                for h in direct_historical[:10]
            ],

            "geometry": [],
            "recommended": False,
        }
    ]

    # =============================================
    # FALLBACK DETOURS
    # =============================================

    for index, offset in enumerate(
        [0.005, 0.010],
        start=1,
    ):

        alt_origin_lat = (
            origin_lat + offset
        )

        alt_origin_lon = (
            origin_lon - offset
        )

        alt_destination_lat = (
            destination_lat + offset
        )

        alt_destination_lon = (
            destination_lon - offset
        )

        alt_distance = math.sqrt(
            (
                (
                    alt_destination_lat
                    - alt_origin_lat
                ) * 111
            ) ** 2
            +
            (
                (
                    alt_destination_lon
                    - alt_origin_lon
                )
                * 111
                * math.cos(
                    math.radians(
                        alt_origin_lat
                    )
                )
            ) ** 2
        )

        alt_distance += (
            index * 0.6
        )

        alt_duration = (
            alt_distance * 2
        )

        (
            alt_risk,
            alt_current,
            alt_historical,
        ) = calculate_combined_risk(
            None,
            alt_origin_lat,
            alt_origin_lon,
            alt_destination_lat,
            alt_destination_lon,
            hazards,
            historical_hazards,
        )

        routes.append(
            {
                "route_id":
                    f"demo-detour-{index}",

                "distance_km":
                    round(
                        alt_distance,
                        2,
                    ),

                "duration_min":
                    round(
                        alt_duration,
                        1,
                    ),

                "risk_score":
                    alt_risk,

                "route_score":
                    route_score(
                        alt_duration,
                        alt_risk,
                    ),

                "hazards_encountered": [
                    h["type"]
                    for h in alt_current
                ],

                "historical_hazards_count":
                    len(alt_historical),

                "historical_high_critical_count":
                    sum(
                        1
                        for h in alt_historical
                        if h["severity"]
                        in {
                            "HIGH",
                            "CRITICAL",
                        }
                    ),

                "historical_hazards_encountered": [
                    h["type"]
                    for h in alt_historical[:10]
                ],

                "geometry": [],
                "recommended": False,
            }
        )

    routes.sort(
        key=lambda x:
        x["route_score"]
    )

    routes = routes[:3]

    best = routes[0]

    for route in routes:

        route["recommended"] = (
            route["route_id"]
            == best["route_id"]
        )

    return {
        "source":
            "DEMO_FALLBACK",

        "historical_data_used":
            len(historical_hazards) > 0,

        "routes":
            routes,

        "reason":
            "Multiple route estimates were "
            "compared using travel time, "
            "current hazards, and historical "
            "hazard exposure.",
    }