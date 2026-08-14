"""
ResQAI live resource movement engine.

Lifecycle:

    IDLE
      |
      v
    EN_ROUTE
      |
      v
    ARRIVED
      |
      v
    INCIDENT RESOLVED
      |
      v
    RETURNING
      |
      v
    IDLE / AVAILABLE

The outbound route uses the real OSRM road geometry supplied by main.py.

When a resource reaches the incident, the outbound geometry is reversed and
used as the return route. This keeps the demo on the same safe road path
without requiring another OSRM request.

The database remains the source of truth for resource status and coordinates.
MOVEMENTS stores only the temporary live movement state.
"""

from __future__ import annotations

import math
import time
from datetime import datetime


# ============================================================
# DEMO MOVEMENT SETTINGS
# ============================================================

# OSRM duration is multiplied by this value for the demo.
# Lower value = faster demo.
TIME_SCALE = 0.08

# Minimum travel time for every movement.
# This prevents resources from appearing to teleport.
MIN_SECONDS = 8.0


# ============================================================
# RESOURCE IDLE / BASE POSITIONS
# ============================================================

IDLE_POSITIONS = {
    "AMB-01": (17.000, 82.240),
    "AMB-02": (17.012, 82.250),
    "AMB-03": (17.005, 82.260),

    "FIRE-01": (17.004, 82.246),
    "FIRE-02": (17.020, 82.260),

    "POL-01": (16.998, 82.252),
    "POL-02": (17.014, 82.240),

    "RES-01": (17.006, 82.257),

    "MED-01": (17.011, 82.243),

    "DRT-01": (17.017, 82.248),
}


# ============================================================
# ACTIVE MOVEMENTS
# ============================================================

MOVEMENTS: dict[str, dict] = {}


# ============================================================
# DISTANCE
# ============================================================

def distance_m(a, b):
    """
    Approximate distance in meters between:

        [longitude, latitude]

    points.
    """

    lon1 = float(a[0])
    lat1 = float(a[1])

    lon2 = float(b[0])
    lat2 = float(b[1])

    dy = (
        lat2 - lat1
    ) * 111320.0

    dx = (
        (lon2 - lon1)
        * 111320.0
        * math.cos(
            math.radians(
                (lat1 + lat2) / 2.0
            )
        )
    )

    return math.hypot(
        dx,
        dy,
    )


# ============================================================
# TOTAL ROUTE DISTANCE
# ============================================================

def total_distance_m(geometry):
    """
    Calculate total route distance in meters.

    Geometry format:

        [
            [longitude, latitude],
            [longitude, latitude],
            ...
        ]
    """

    if (
        not isinstance(geometry, list)
        or len(geometry) < 2
    ):
        return 0.0

    return sum(
        distance_m(
            geometry[i - 1],
            geometry[i],
        )
        for i in range(
            1,
            len(geometry),
        )
    )


# ============================================================
# GEOMETRY INTERPOLATION
# ============================================================

def interpolate(
    geometry,
    progress,
):
    """
    Return [longitude, latitude] at a normalized progress value.
    """

    if not geometry:
        return None

    if len(geometry) == 1:

        return [
            float(geometry[0][0]),
            float(geometry[0][1]),
        ]

    progress = max(
        0.0,
        min(
            1.0,
            float(progress),
        ),
    )

    lengths = [
        distance_m(
            geometry[i - 1],
            geometry[i],
        )
        for i in range(
            1,
            len(geometry),
        )
    ]

    total = sum(lengths)

    if total <= 0:

        point = geometry[-1]

        return [
            float(point[0]),
            float(point[1]),
        ]

    target = total * progress

    travelled = 0.0

    for i, length in enumerate(lengths):

        if travelled + length >= target:

            ratio = (
                0.0
                if length <= 0
                else (
                    target - travelled
                ) / length
            )

            a = geometry[i]
            b = geometry[i + 1]

            return [
                float(a[0])
                + (
                    float(b[0])
                    - float(a[0])
                ) * ratio,

                float(a[1])
                + (
                    float(b[1])
                    - float(a[1])
                ) * ratio,
            ]

        travelled += length

    point = geometry[-1]

    return [
        float(point[0]),
        float(point[1]),
    ]


# ============================================================
# IDLE POSITION
# ============================================================

def idle_position(resource_id):
    """
    Return the configured idle/base position for a resource.
    """

    position = IDLE_POSITIONS.get(
        resource_id
    )

    if not position:
        return None

    return {
        "latitude": float(position[0]),
        "longitude": float(position[1]),
    }


# ============================================================
# PUBLIC MOVEMENT STATE
# ============================================================

def public(
    resource_id,
    resource,
):
    """
    Serialize the current movement state for the frontend.
    """

    state = MOVEMENTS.get(
        resource_id
    )

    if not state:
        return None

    duration = max(
        MIN_SECONDS,
        float(
            state["duration_seconds"]
        ),
    )

    elapsed = max(
        0.0,
        time.time()
        - state["started_at"],
    )

    progress = min(
        1.0,
        elapsed / duration,
    )

    remaining = max(
        0.0,
        duration - elapsed,
    )

    phase = state.get(
        "phase",
        "OUTBOUND",
    )

    if phase == "RETURNING":

        status = (
            "RETURNING"
            if progress < 1.0
            else "IDLE"
        )

    else:

        status = (
            "EN_ROUTE"
            if progress < 1.0
            else "ARRIVED"
        )

    return {
        "active": True,

        "resource_id": resource_id,

        "incident_id": state.get(
            "incident_id"
        ),

        "phase": phase,

        "status": status,

        "progress": round(
            progress,
            4,
        ),

        "progress_percent": round(
            progress * 100.0,
            1,
        ),

        "eta_seconds": int(
            math.ceil(
                remaining
            )
        ),

        "eta_minutes": round(
            remaining / 60.0,
            2,
        ),

        "remaining_distance_km": round(
            state["distance_m"]
            * (
                1.0 - progress
            )
            / 1000.0,
            3,
        ),

        "distance_km": round(
            state["distance_m"]
            / 1000.0,
            3,
        ),

        "geometry": state[
            "geometry"
        ],

        "route_id": state.get(
            "route_id"
        ),

        "route_source": state.get(
            "route_source",
            "OSRM",
        ),

        "origin": {
            "latitude": state[
                "origin_lat"
            ],
            "longitude": state[
                "origin_lon"
            ],
        },

        "destination": {
            "latitude": state[
                "destination_lat"
            ],
            "longitude": state[
                "destination_lon"
            ],
        },

        "returning_to_idle": (
            phase == "RETURNING"
        ),
    }


# ============================================================
# CREATE MOVEMENT
# ============================================================

def start_movement(
    resource_id,
    incident_id,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    geometry,
    distance_km=0.0,
    duration_seconds=None,
    route_id=None,
    route_source="OSRM",
):
    """
    Create an outbound movement.

    This function is kept compatible with the existing main.py architecture.
    """

    if (
        resource_id in MOVEMENTS
    ):
        return MOVEMENTS[
            resource_id
        ]

    if not isinstance(
        geometry,
        list
    ) or len(geometry) < 2:

        raise ValueError(
            "Movement requires at least two route geometry points."
        )

    distance_m = total_distance_m(
        geometry
    )

    if distance_m <= 0:

        # Fallback for a route response that contains a valid-looking
        # geometry but zero physical distance.
        distance_m = max(
            1.0,
            float(distance_km or 0)
            * 1000.0,
        )

    if duration_seconds is None:

        duration_seconds = max(
            MIN_SECONDS,
            20.0,
        )

    duration_seconds = max(
        MIN_SECONDS,
        float(
            duration_seconds
        ),
    )

    state = {
        "resource_id": resource_id,

        "incident_id": incident_id,

        "phase": "OUTBOUND",

        "geometry": geometry,

        "route_id": route_id,

        "route_source": route_source,

        "origin_lat": float(
            origin_lat
        ),

        "origin_lon": float(
            origin_lon
        ),

        "destination_lat": float(
            destination_lat
        ),

        "destination_lon": float(
            destination_lon
        ),

        "distance_m": distance_m,

        "duration_seconds": duration_seconds,

        "started_at": time.time(),
    }

    MOVEMENTS[
        resource_id
    ] = state

    return state


# ============================================================
# START RETURN TO IDLE
# ============================================================

def _start_return_to_idle(
    resource_id,
    state,
    resource,
):
    """
    Start the return journey after the resource reaches the incident.

    The outbound OSRM geometry is reversed, so the resource follows the same
    road path back to its idle/base position.
    """

    idle = idle_position(
        resource_id
    )

    if not idle:

        # If the resource is not known in the idle-position table,
        # safely release it where it currently is.
        return False

    current_lat = float(
        resource.latitude
    )

    current_lon = float(
        resource.longitude
    )

    idle_lat = idle[
        "latitude"
    ]

    idle_lon = idle[
        "longitude"
    ]

    geometry = list(
        reversed(
            state["geometry"]
        )
    )

    # Make absolutely sure the return geometry starts at the incident.
    geometry[0] = [
        current_lon,
        current_lat,
    ]

    # And ends exactly at the configured idle position.
    geometry[-1] = [
        idle_lon,
        idle_lat,
    ]

    distance_m = total_distance_m(
        geometry
    )

    # Never create a zero-second return movement.
    duration_seconds = max(
        MIN_SECONDS,
        float(
            state[
                "duration_seconds"
            ]
        ),
    )

    MOVEMENTS[
        resource_id
    ] = {
        "resource_id": resource_id,

        "incident_id": state.get(
            "incident_id"
        ),

        "phase": "RETURNING",

        "geometry": geometry,

        "route_id": (
            f"{state.get('route_id', 'route')}-return"
        ),

        "route_source": state.get(
            "route_source",
            "OSRM",
        ),

        "origin_lat": current_lat,

        "origin_lon": current_lon,

        "destination_lat": idle_lat,

        "destination_lon": idle_lon,

        "distance_m": distance_m,

        "duration_seconds": duration_seconds,

        "started_at": time.time(),
    }

    return True


# ============================================================
# ADVANCE MOVEMENT
# ============================================================

def advance(
    db,
    Resource,
    Incident,
):
    """
    Advance every active resource movement.

    This function is called by main.py during API polling.

    OUTBOUND:
        resource -> incident

    RETURNING:
        incident -> idle position
    """

    changed = False

    arrivals = []

    now = time.time()

    for resource_id, state in list(
        MOVEMENTS.items()
    ):

        resource = (
            db.query(Resource)
            .filter(
                Resource.resource_id
                == resource_id
            )
            .first()
        )

        if not resource:

            MOVEMENTS.pop(
                resource_id,
                None,
            )

            continue

        duration = max(
            MIN_SECONDS,
            float(
                state[
                    "duration_seconds"
                ]
            ),
        )

        progress = min(
            1.0,
            max(
                0.0,
                (
                    now
                    - state[
                        "started_at"
                    ]
                )
                / duration,
            ),
        )

        # Prevent a visible ARRIVED state while the resource is still BUSY.
        if progress >= 0.995:

            progress = 1.0

        point = interpolate(
            state["geometry"],
            progress,
        )

        if point:

            resource.longitude = (
                point[0]
            )

            resource.latitude = (
                point[1]
            )

            changed = True

        # ----------------------------------------------------
        # STILL MOVING
        # ----------------------------------------------------

        if progress < 1.0:

            continue

        # ====================================================
        # OUTBOUND ARRIVAL
        # ====================================================

        if state.get(
            "phase"
        ) == "OUTBOUND":

            incident_id = (
                resource.current_incident_id
            )

            # Place resource exactly at incident.
            resource.latitude = (
                state[
                    "destination_lat"
                ]
            )

            resource.longitude = (
                state[
                    "destination_lon"
                ]
            )

            incident = None

            if incident_id:

                incident = db.get(
                    Incident,
                    incident_id,
                )

            # ------------------------------------------------
            # Incident reached.
            # ------------------------------------------------

            if incident:

                incident.status = (
                    "RESOLVED"
                )

                if hasattr(
                    incident,
                    "updated_at",
                ):

                    incident.updated_at = (
                        datetime.utcnow()
                    )

            # ------------------------------------------------
            # IMPORTANT:
            #
            # Do NOT make the resource AVAILABLE yet.
            #
            # It is going back to its idle position.
            # ------------------------------------------------

            started_return = (
                _start_return_to_idle(
                    resource_id,
                    state,
                    resource,
                )
            )

            if started_return:

                resource.status = (
                    "BUSY"
                )

                # Keep the incident assignment while returning.
                resource.current_incident_id = (
                    incident_id
                )

                arrivals.append({
                    "resource_id":
                        resource_id,

                    "incident_id":
                        incident_id,

                    "status":
                        "ARRIVED",

                    "returning":
                        True,
                })

            else:

                # No configured idle position.
                # Safely release the resource.
                resource.status = (
                    "AVAILABLE"
                )

                resource.current_incident_id = (
                    None
                )

                MOVEMENTS.pop(
                    resource_id,
                    None,
                )

                arrivals.append({
                    "resource_id":
                        resource_id,

                    "incident_id":
                        incident_id,

                    "status":
                        "ARRIVED",

                    "returning":
                        False,
                })

            changed = True

            continue

        # ====================================================
        # RETURN TO IDLE COMPLETE
        # ====================================================

        if state.get(
            "phase"
        ) == "RETURNING":

            idle = idle_position(
                resource_id
            )

            if idle:

                resource.latitude = (
                    idle[
                        "latitude"
                    ]
                )

                resource.longitude = (
                    idle[
                        "longitude"
                    ]
                )

            incident_id = (
                resource.current_incident_id
            )

            # ------------------------------------------------
            # NOW the resource is actually free.
            # ------------------------------------------------

            resource.status = (
                "AVAILABLE"
            )

            resource.current_incident_id = (
                None
            )

            MOVEMENTS.pop(
                resource_id,
                None,
            )

            arrivals.append({
                "resource_id":
                    resource_id,

                "incident_id":
                    incident_id,

                "status":
                    "IDLE",

                "returning":
                    False,
            })

            changed = True

    # ========================================================
    # DATABASE COMMIT
    # ========================================================

    if changed:

        db.commit()

    return arrivals


# ============================================================
# CLEAR ALL MOVEMENTS
# ============================================================

def clear_movements():
    """
    Clear all in-memory movement state.

    Used by the demo reset endpoint.
    """

    MOVEMENTS.clear()


# ============================================================
# MODULE TEST
# ============================================================

if __name__ == "__main__":

    print(
        "ResQAI resource movement engine loaded."
    )

    print(
        f"Minimum movement time: {MIN_SECONDS}s"
    )

    print(
        f"Configured idle positions: "
        f"{len(IDLE_POSITIONS)}"
    )