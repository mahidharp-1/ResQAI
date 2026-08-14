import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { api } from "./api";

const nav = [
  "Command Center",
  "Report Emergency",
  "Incidents",
  "Human Verification",
  "Resources",
  "SafeRoute",
  "Analytics"
];

const badge = {
  P1: "bg-red-500/20 text-red-300 border-red-500/40",
  P2: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  P3: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  P4: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
};

const ACTIVE_ROUTE_STORAGE_KEY = "resqai_active_route";

function resourceIcon(type = "") {
  const t = String(type).toLowerCase();
  if (t.includes("ambulance")) return "🚑";
  if (t.includes("fire")) return "🚒";
  if (t.includes("police")) return "🚓";
  if (t.includes("rescue")) return "🛟";
  if (t.includes("medical")) return "🩺";
  if (t.includes("disaster")) return "🧑‍🚒";
  return "🚨";
}

function readActiveRoute() {
  try {
    const raw = localStorage.getItem(ACTIVE_ROUTE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveRoute(route) {
  try {
    localStorage.setItem(ACTIVE_ROUTE_STORAGE_KEY, JSON.stringify(route));
    window.dispatchEvent(new Event("resqai-route-updated"));
  } catch (e) {
    console.error("Unable to save active route:", e);
  }
}

function clearActiveRoute() {
  try {
    localStorage.removeItem(ACTIVE_ROUTE_STORAGE_KEY);
    window.dispatchEvent(new Event("resqai-route-updated"));
  } catch (e) {
    console.error("Unable to clear active route:", e);
  }
}

async function resetDemo() {
  const result = await api("/demo/reset", { method: "POST" });
  clearActiveRoute();
  return result;
}

function Stat({ label, value, accent = "" }) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131d]">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className={`text-3xl font-black mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function Shell({ page, setPage, children }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const navGroups = [
    {
      label: "OPERATIONS",
      items: [
        ["Command Center", "◉"],
        ["Report Emergency", "+"],
        ["Incidents", "⚠"]
      ]
    },
    {
      label: "DISPATCH",
      items: [
        ["Human Verification", "✓"],
        ["Resources", "◆"],
        ["SafeRoute", "⌁"]
      ]
    },
    {
      label: "INTELLIGENCE",
      items: [
        ["Analytics", "▦"]
      ]
    }
  ];

  async function askQuestion(question) {
    if (!question || loading) return;

    setLoading(true);
    setAnswer("");

    try {
      const result = await api("/ai/query", {
        method: "POST",
        body: JSON.stringify({
          question
        })
      });

      setAnswer(
        result.answer || "No answer returned."
      );
    } catch (e) {
      setAnswer(
        "Unable to contact the ResQAI Assistant. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    const question = q.trim();

    if (!question) return;

    await askQuestion(question);
  }

  return (
    <div className="resqai-app min-h-screen text-slate-100">

      {/* =====================================================
          TOP SYSTEM BAR
          ===================================================== */}

      <header
        className="
          h-14
          border-b border-slate-800/80
          flex items-center
          px-5
          gap-5
          sticky top-0
          bg-[#070b12]/95
          backdrop-blur-xl
          z-[2000]
        "
      >

        {/* BRAND */}

        <div className="flex items-center gap-3">

          <div className="resqai-brand text-xl">
            <span className="resqai-brand-main">
              RESQ
            </span>
            <span className="resqai-brand-ai">
              AI
            </span>
          </div>

          <div className="hidden md:block h-5 w-px bg-slate-800" />

          <div className="hidden md:block">

            <div className="text-[10px] font-bold tracking-[0.16em] text-slate-500">
              EMERGENCY OPERATIONS
            </div>

            <div className="text-[9px] text-slate-600 mt-0.5">
              INTELLIGENCE PLATFORM
            </div>

          </div>

        </div>


        {/* SYSTEM STATUS */}

        <div className="ml-auto flex items-center gap-3">

          <div
            className="
              hidden sm:flex
              items-center gap-2
              px-3 py-1.5
              rounded-full
              border border-emerald-500/20
              bg-emerald-500/5
            "
          >

            <span className="resqai-status-online text-[9px] font-bold">
              SYSTEM ONLINE
            </span>

          </div>

          <div
            className="
              hidden lg:flex
              items-center gap-2
              px-3 py-1.5
              rounded-full
              border border-cyan-500/15
              bg-cyan-500/5
              text-[9px]
              text-cyan-300
              font-bold
            "
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            LIVE DATA
          </div>

        </div>

      </header>


      {/* =====================================================
          APPLICATION BODY
          ===================================================== */}

      <div className="flex min-h-[calc(100vh-3.5rem)]">


        {/* ===================================================
            SIDEBAR
            =================================================== */}

        <aside
          className="
            resqai-sidebar
            w-52
            shrink-0
            min-h-[calc(100vh-3.5rem)]
            p-3
            flex
            flex-col
          "
        >

          {/* Navigation */}

          <nav className="space-y-5">

            {navGroups.map((group) => (

              <div key={group.label}>

                <div
                  className="
                    px-3 mb-2
                    text-[9px]
                    font-black
                    tracking-[0.18em]
                    text-slate-600
                  "
                >
                  {group.label}
                </div>

                <div className="space-y-1">

                  {group.items.map(([name, icon]) => {

                    const active =
                      page === name;

                    return (
                      <button
                        key={name}
                        onClick={() =>
                          setPage(name)
                        }
                        className={`
                          resqai-nav-button
                          w-full
                          flex
                          items-center
                          gap-3
                          px-3
                          py-2.5
                          rounded-lg
                          text-left
                          text-xs
                          font-semibold
                          border
                          ${
                            active
                              ? "resqai-nav-button-active border-slate-700/60"
                              : "border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-900/60"
                          }
                        `}
                      >

                        <span
                          className={`
                            w-7 h-7
                            rounded-md
                            flex
                            items-center
                            justify-center
                            text-xs
                            font-black
                            ${
                              active
                                ? "bg-slate-900 text-white"
                                : "bg-slate-950 text-slate-600"
                            }
                          `}
                        >
                          {icon}
                        </span>

                        <span className="truncate">
                          {name}
                        </span>

                        {active && (
                          <span className="ml-auto text-[9px] text-red-400">
                            ●
                          </span>
                        )}

                      </button>
                    );
                  })}

                </div>

              </div>

            ))}

          </nav>


          {/* =================================================
              HUMAN-IN-THE-LOOP NOTICE
              ================================================= */}

          <div className="mt-auto pt-5">

            <div className="resqai-alert rounded-xl p-3">

              <div className="flex items-center gap-2">

                <span
                  className="
                    w-6 h-6
                    rounded-md
                    bg-red-500/10
                    border border-red-500/20
                    flex items-center justify-center
                    text-red-400
                    text-xs
                  "
                >
                  !
                </span>

                <span className="text-[9px] font-black uppercase tracking-wider text-red-300">
                  Human verification
                </span>

              </div>

              <p className="text-[10px] text-slate-500 leading-4 mt-2">
                AI recommendations are decision support.
                Trained responders remain responsible for
                operational decisions.
              </p>

            </div>


            {/* VERSION */}

            <div className="text-[8px] text-slate-700 mt-3 px-1">
              ResQAI Command Platform · Demo v1
            </div>

          </div>

        </aside>


        {/* ===================================================
            MAIN CONTENT
            =================================================== */}

        <main
          className="
            resqai-main
            flex-1
            min-w-0
            p-4
            sm:p-5
            lg:p-6
          "
        >

          <div className="w-full max-w-none">
            {children}
          </div>

        </main>

      </div>


      {/* =====================================================
          RESQAI AI ASSISTANT — NEON POPUP
          ===================================================== */}

      {/* Floating assistant launcher */}
      <div className="fixed bottom-5 right-5 z-[3000]">
        <button
          type="button"
          onClick={() => setAssistantOpen((value) => !value)}
          aria-label="Open ResQAI Assistant"
          aria-expanded={assistantOpen}
          className={`
            resqai-ai-launcher
            relative
            w-14 h-14
            rounded-2xl
            flex items-center justify-center
            border
            transition-all duration-300
            ${assistantOpen ? "resqai-ai-launcher-open" : ""}
          `}
        >
          <span className="resqai-ai-ring" />
          <span className="relative z-10 text-lg font-black">
            {assistantOpen ? "×" : "AI"}
          </span>

          {!assistantOpen && (
            <span className="resqai-ai-notification">1</span>
          )}
        </button>

        {!assistantOpen && (
          <div className="resqai-ai-hint hidden sm:block">
            ResQAI Assistant
          </div>
        )}
      </div>

      {/* Popup */}
      {assistantOpen && (
        <div
          className="
            fixed
            bottom-24
            right-5
            z-[2999]
            w-[min(390px,calc(100vw-2rem))]
            resqai-ai-popup
          "
        >
          <div className="resqai-ai-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="resqai-ai-avatar">
                <span>AI</span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-black tracking-wide">
                    RESQAI ASSISTANT
                  </div>
                  <span className="resqai-ai-live-dot" />
                </div>

                <div className="text-[9px] text-cyan-300/60 mt-0.5">
                  Live operational intelligence
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="resqai-ai-close"
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          <div className="resqai-ai-status-strip">
            <span className="resqai-ai-status-dot" />
            <span>CONNECTED</span>
            <span className="mx-1 text-slate-700">•</span>
            <span>BACKEND AI</span>
          </div>

          <div className="resqai-ai-body">
            {!answer && !loading && (
              <div className="resqai-ai-welcome">
                <div className="text-sm font-black text-slate-100">
                  How can I help?
                </div>
                <div className="text-[10px] text-slate-500 mt-1 leading-4">
                  Ask about incidents, resources, hazards, dispatch
                  decisions or current emergency operations.
                </div>
              </div>
            )}

            {loading && (
              <div className="resqai-ai-thinking">
                <div className="resqai-ai-thinking-icon">AI</div>
                <div>
                  <div className="text-[10px] font-bold text-cyan-300">
                    ANALYZING
                  </div>
                  <div className="resqai-thinking-dots mt-1">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {answer && !loading && (
              <div className="resqai-ai-response">
                <div className="flex items-center gap-2 mb-2">
                  <span className="resqai-ai-response-icon">AI</span>
                  <span className="resqai-ai-label">
                    RESQAI RESPONSE
                  </span>
                </div>

                <div className="text-[10px] text-slate-300 whitespace-pre-line leading-5">
                  {answer}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-[8px] uppercase tracking-[0.18em] text-slate-600 font-black mb-2">
                Quick intelligence
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  [
                    "Critical incidents",
                    "Which incidents require immediate attention?"
                  ],
                  [
                    "Available resources",
                    "What resources are currently available?"
                  ],
                  [
                    "Current hazards",
                    "What hazards are currently reported?"
                  ],
                  [
                    "Dispatch status",
                    "What is the current dispatch status?"
                  ]
                ].map(([label, question]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setQ(question);
                      askQuestion(question);
                    }}
                    disabled={loading}
                    className="resqai-ai-quick"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="resqai-ai-input-area">
            <div className="resqai-ai-input-wrap">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask ResQAI..."
                className="resqai-ai-input"
                autoFocus
              />

              <button
                type="button"
                onClick={ask}
                disabled={!q.trim() || loading}
                className="resqai-ai-send"
                aria-label="Send prompt"
              >
                {loading ? "…" : "↑"}
              </button>
            </div>

            <div className="text-[8px] text-slate-700 mt-2 text-center">
              AI decision support · Human responder remains in control
            </div>
          </div>
        </div>
      )}
      </div>

  );
}

function MapView({ incidents = [], resources = [], height = "500px" }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const layersRef = useRef([]);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [activeRoute, setActiveRoute] = useState(readActiveRoute());

  useEffect(() => {
    const refresh = () => setActiveRoute(readActiveRoute());

    window.addEventListener("resqai-route-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("resqai-route-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    import("leaflet")
      .then((L) => {
        if (cancelled || !mapRef.current) return;

        // Create Leaflet map only once.
        if (!leafletRef.current) {
          const map = L.map(mapRef.current, {
            center: [17.003, 82.25],
            zoom: 13,
            zoomControl: true
          });

          L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
              attribution: "© OpenStreetMap contributors",
              maxZoom: 19
            }
          ).addTo(map);

          leafletRef.current = map;

          // Fix Leaflet sizing when the card is rendered/resized.
          setTimeout(() => {
            if (!cancelled) {
              map.invalidateSize();
            }
          }, 200);
        }

        const map = leafletRef.current;

        // Remove old dynamic layers before drawing fresh data.
        layersRef.current.forEach((layer) => {
          try {
            map.removeLayer(layer);
          } catch {}
        });
        layersRef.current = [];

        // --------------------------------------------------
        // INCIDENT MARKERS
        // --------------------------------------------------
        if (showIncidents) {
          incidents.forEach((incident) => {
            if (
              incident.latitude == null ||
              incident.longitude == null
            ) {
              return;
            }

            const priority = String(
              incident.priority || "P4"
            ).toUpperCase();

            const markerColor =
              priority === "P1"
                ? "#ef4444"
                : priority === "P2"
                  ? "#f97316"
                  : priority === "P3"
                    ? "#eab308"
                    : "#22c55e";

            const lat = Number(incident.latitude);
            const lon = Number(incident.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              return;
            }

            const marker = L.circleMarker([lat, lon], {
              radius: priority === "P1" ? 9 : 7,
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.75,
              weight: 2
            })
              .addTo(map)
              .bindPopup(
                `<b>INC-${String(incident.id).padStart(3, "0")}</b><br/>` +
                `${incident.incident_type || "incident"}<br/>` +
                `${priority} · ${incident.priority_score ?? "—"}/100<br/>` +
                `Status: ${incident.status || "NEW"}`
              );

            layersRef.current.push(marker);
          });
        }

        // --------------------------------------------------
        // RESOURCE MARKERS
        // --------------------------------------------------
        if (showResources) {
          resources.forEach((resource) => {
            if (
              resource.latitude == null ||
              resource.longitude == null
            ) {
              return;
            }

            const lat = Number(resource.latitude);
            const lon = Number(resource.longitude);

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              return;
            }

            const status = String(
              resource.status || "AVAILABLE"
            ).toUpperCase();

            const resourceId =
              resource.resource_id ||
              `RES-${resource.id}`;

            const resourceType =
              resource.resource_type ||
              "Emergency Resource";

            const type = resourceType.toLowerCase();

            let iconSymbol = "🚨";

            if (type.includes("ambulance")) {
              iconSymbol = "🚑";
            } else if (type.includes("fire")) {
              iconSymbol = "🚒";
            } else if (type.includes("police")) {
              iconSymbol = "🚓";
            } else if (type.includes("rescue")) {
              iconSymbol = "🛟";
            } else if (type.includes("medical")) {
              iconSymbol = "🩺";
            } else if (type.includes("disaster")) {
              iconSymbol = "🧑‍🚒";
            }

            const borderColor =
              status === "BUSY"
                ? "#f97316"
                : "#22c55e";

            const icon = L.divIcon({
              className: "resqai-resource-icon",
              html: `
                <div
                  style="
                    width:36px;
                    height:36px;
                    border-radius:50%;
                    background:#0b1220;
                    border:2px solid ${borderColor};
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:20px;
                    box-shadow:0 2px 8px rgba(0,0,0,.45);
                  "
                >
                  ${iconSymbol}
                </div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
              popupAnchor: [0, -18]
            });

            const movement = resource.movement;
            const eta = movement?.eta_seconds;

            const marker = L.marker(
              [lat, lon],
              {
                icon,
                title: resourceId
              }
            )
              .addTo(map)
              .bindPopup(
                `<b>${resourceId}</b><br/>` +
                `${resourceType}<br/>` +
                `Status: ${status}<br/>` +
                (eta != null
                  ? `ETA: ${Math.max(
                      0,
                      Math.ceil(Number(eta))
                    )} sec<br/>`
                  : "") +
                `Location: ${lat.toFixed(5)}, ${lon.toFixed(5)}`
              );

            layersRef.current.push(marker);
          });
        }

// --------------------------------------------------
// ROUTE GEOMETRY
// --------------------------------------------------

// ==================================================
// ROUTE COLOUR SYSTEM
// ==================================================
//
// CYAN   = Planned SafeRoute
// YELLOW = Active responder outbound route
// PURPLE = Resource returning to idle
//
// This keeps different operational states visually
// separate on the command-center map.
// ==================================================


// --------------------------------------------------
// A. SAVED SAFEROUTE / PLANNED ROUTE
// --------------------------------------------------

if (
  activeRoute?.geometry &&
  Array.isArray(activeRoute.geometry) &&
  activeRoute.geometry.length >= 2
) {
  const routePoints = activeRoute.geometry
    .map((point) => {
      if (
        Array.isArray(point) &&
        point.length >= 2
      ) {
        return [
          Number(point[1]),
          Number(point[0])
        ];
      }

      if (
        point &&
        point.latitude != null &&
        point.longitude != null
      ) {
        return [
          Number(point.latitude),
          Number(point.longitude)
        ];
      }

      return null;
    })
    .filter(
      (point) =>
        point &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
    );

  if (routePoints.length >= 2) {

    const line = L.polyline(
      routePoints,
      {
        color: "#06b6d4",
        weight: 4,
        opacity: 0.65,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "10 8"
      }
    ).addTo(map);

    line.bindTooltip(
      "SAFE ROUTE · PLANNED",
      {
        sticky: true,
        className: "resqai-route-tooltip"
      }
    );

    layersRef.current.push(line);
  }
}


// --------------------------------------------------
// B. LIVE RESPONDER MOVEMENT ROUTES
// --------------------------------------------------

resources.forEach((resource) => {

  const movement = resource.movement;

  if (
    !movement ||
    !movement.active ||
    !Array.isArray(movement.geometry) ||
    movement.geometry.length < 2
  ) {
    return;
  }

  const liveRoutePoints = movement.geometry
    .map((point) => {

      if (
        Array.isArray(point) &&
        point.length >= 2
      ) {
        return [
          Number(point[1]),
          Number(point[0])
        ];
      }

      if (
        point &&
        point.latitude != null &&
        point.longitude != null
      ) {
        return [
          Number(point.latitude),
          Number(point.longitude)
        ];
      }

      return null;
    })
    .filter(
      (point) =>
        point &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
    );

  if (liveRoutePoints.length < 2) {
    return;
  }


  // ------------------------------------------------
  // Determine movement phase
  // ------------------------------------------------

  const phase = String(
    movement.phase || "OUTBOUND"
  ).toUpperCase();

  const movementStatus = String(
    movement.status || ""
  ).toUpperCase();


  // ------------------------------------------------
  // OUTBOUND
  // Yellow = active responder travelling
  // ------------------------------------------------

  if (
    phase === "OUTBOUND" &&
    movementStatus !== "ARRIVED"
  ) {

    const liveLine = L.polyline(
      liveRoutePoints,
      {
        color: "#facc15",
        weight: 7,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round"
      }
    ).addTo(map);

    liveLine.bindTooltip(
      `${resource.resource_id || "RESPONDER"} · EN ROUTE`,
      {
        sticky: true,
        className: "resqai-route-tooltip"
      }
    );

    layersRef.current.push(liveLine);

  }


  // ------------------------------------------------
  // ARRIVED
  // Do not draw a second green route over the map.
  // The incident marker already shows arrival.
  // ------------------------------------------------

  else if (
    phase === "OUTBOUND" &&
    movementStatus === "ARRIVED"
  ) {

    const arrivalLine = L.polyline(
      liveRoutePoints,
      {
        color: "#22c55e",
        weight: 5,
        opacity: 0.45,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "4 7"
      }
    ).addTo(map);

    arrivalLine.bindTooltip(
      `${resource.resource_id || "RESPONDER"} · ARRIVED`,
      {
        sticky: true,
        className: "resqai-route-tooltip"
      }
    );

    layersRef.current.push(arrivalLine);

  }


  // ------------------------------------------------
  // RETURNING
  // Purple = responder returning to base
  // ------------------------------------------------

  else if (
    phase === "RETURNING"
  ) {

    const returnLine = L.polyline(
      liveRoutePoints,
      {
        color: "#a855f7",
        weight: 7,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "14 8"
      }
    ).addTo(map);

    returnLine.bindTooltip(
      `${resource.resource_id || "RESPONDER"} · RETURNING TO BASE`,
      {
        sticky: true,
        className: "resqai-route-tooltip"
      }
    );

    layersRef.current.push(returnLine);
  }

});


        // Make sure tiles and markers occupy the full container.
        setTimeout(() => {
          if (!cancelled && leafletRef.current) {
            leafletRef.current.invalidateSize();
          }
        }, 100);
      })
      .catch((error) => {
        console.error(
          "Leaflet map initialization failed:",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    incidents,
    resources,
    showIncidents,
    showResources,
    activeRoute
  ]);

  useEffect(() => {
    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        height,
        minHeight: "500px"
      }}
    >
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{
          minHeight: "500px",
          width: "100%"
        }}
      />

      <div className="absolute top-3 left-3 z-[1000] flex gap-2">
        <button
          onClick={() =>
            setShowIncidents((value) => !value)
          }
          className="px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-700 text-[10px] text-white shadow"
        >
          Incidents {showIncidents ? "ON" : "OFF"}
        </button>

        <button
          onClick={() =>
            setShowResources((value) => !value)
          }
          className="px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-700 text-[10px] text-white shadow"
        >
          Resources {showResources ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}

function CommandCenter() {
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState("");

  async function load() {
  try {
    const [s, incidentData, resourceData] = await Promise.all([
      api("/dashboard/stats"),
      api("/incidents"),
      api("/resources")
    ]);

    const incidentRows = Array.isArray(incidentData)
      ? incidentData
      : incidentData?.value || [];

    const resourceRows = Array.isArray(resourceData)
      ? resourceData
      : resourceData?.value || [];

    /*
     * Get the latest movement position for every resource.
     * This makes the map independent of whether /resources
     * includes the movement object correctly.
     */
    const resourcesWithMovement = await Promise.all(
      resourceRows.map(async (resource) => {
        try {
          const movement = await api(
            `/resources/${encodeURIComponent(resource.resource_id)}/movement`
          );

          return {
            ...resource,

            /*
             * Movement endpoint is the authoritative live position.
             */
            latitude:
              movement?.latitude != null
                ? Number(movement.latitude)
                : resource.latitude,

            longitude:
              movement?.longitude != null
                ? Number(movement.longitude)
                : resource.longitude,

            status:
              movement?.status || resource.status,

            current_incident_id:
              movement?.incident_id ??
              resource.current_incident_id,

            movement: {
              ...(resource.movement || {}),
              ...(movement || {})
            }
          };
        } catch (movementError) {
          console.warn(
            `Movement update failed for ${resource.resource_id}:`,
            movementError
          );

          return resource;
        }
      })
    );

    setStats(s);
    setIncidents(incidentRows);
    setResources(resourcesWithMovement);
    setUpdated(new Date());
    setError("");
  } catch (e) {
    console.error(
      "Command Center loading error:",
      e
    );

    setError(
      e.message ||
      "Unable to load command center."
    );
  }
}
  useEffect(() => {
    load();

    const timer = setInterval(load, 2000);

    return () => clearInterval(timer);
  }, []);

  const active = incidents.filter(
    (x) =>
      String(x.status || "").toUpperCase() !== "RESOLVED"
  );

  const critical = active.filter(
    (x) =>
      String(x.priority || "").toUpperCase() === "P1"
  );

  const available = resources.filter(
    (x) =>
      String(x.status || "").toUpperCase() === "AVAILABLE"
  );

  const busy = resources.filter(
    (x) =>
      String(x.status || "").toUpperCase() === "BUSY"
  );

  const enRoute = resources.filter(
    (x) =>
      x.movement?.active === true ||
      String(x.movement?.status || "").toUpperCase() === "EN_ROUTE"
  );

  const priorityQueue = [...active]
    .sort(
      (a, b) =>
        (b.priority_score || 0) -
        (a.priority_score || 0)
    )
    .slice(0, 7);

  function statusClass(status) {
    const value = String(status || "").toUpperCase();

    if (value === "AVAILABLE") {
      return "text-emerald-400 bg-emerald-500/5 border-emerald-500/20";
    }

    if (value === "BUSY") {
      return "text-orange-400 bg-orange-500/5 border-orange-500/20";
    }

    return "text-cyan-400 bg-cyan-500/5 border-cyan-500/20";
  }

  return (
    <div className="space-y-5 pb-24">

      {/* =====================================================
          COMMAND CENTER HEADER
          ===================================================== */}

      <section
        className="
          relative
          overflow-hidden
          rounded-2xl
          border border-slate-800
          bg-[#0d131d]
          p-5
          lg:p-6
        "
      >

        {/* subtle glow */}

        <div
          className="
            pointer-events-none
            absolute
            -right-24
            -top-24
            w-72
            h-72
            rounded-full
            bg-cyan-500/5
            blur-3xl
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -left-20
            -bottom-24
            w-64
            h-64
            rounded-full
            bg-red-500/5
            blur-3xl
          "
        />

        <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">

          <div>

            <div
              className="
                inline-flex
                items-center
                gap-2
                text-[9px]
                uppercase
                tracking-[0.24em]
                text-emerald-400
                font-black
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Emergency Operations
            </div>

            <div className="flex items-center gap-3 mt-2">

              <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
                Command Center
              </h1>

              <span
                className="
                  hidden sm:inline-flex
                  items-center
                  px-2
                  py-1
                  rounded-md
                  border border-cyan-500/20
                  bg-cyan-500/5
                  text-[9px]
                  text-cyan-300
                  font-bold
                "
              >
                LIVE
              </span>

            </div>

            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Unified operational intelligence for emergency
              prioritization, responder deployment and live
              situational awareness.
            </p>

            {updated && (
              <div className="flex items-center gap-2 mt-3 text-[9px] text-slate-600">

                <span>
                  LAST SYNCHRONIZED
                </span>

                <span className="text-slate-400">
                  {updated.toLocaleTimeString()}
                </span>

                <span className="text-emerald-500">
                  ●
                </span>

                <span>
                  AUTO REFRESH 2s
                </span>

              </div>
            )}

          </div>


          {/* HEADER CONTROLS */}

          <div className="flex flex-wrap items-center gap-2">

            <div
              className="
                inline-flex
                items-center
                gap-2
                px-3
                py-2
                rounded-xl
                border border-emerald-500/20
                bg-emerald-500/5
                text-[10px]
                text-emerald-300
                font-bold
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM OPERATIONAL
            </div>

            <button
              onClick={load}
              className="
                px-3
                py-2
                rounded-xl
                border border-slate-700
                bg-slate-900
                text-xs
                font-bold
                text-slate-300
                hover:text-white
                hover:border-slate-600
                transition
              "
            >
              ↻ Refresh
            </button>

            <button
              onClick={async () => {
                if (!window.confirm("Reset the ResQAI demo state?")) {
                  return;
                }

                try {
                  await resetDemo();
                  await load();
                  alert("Demo reset complete.");
                } catch (e) {
                  alert(e.message || "Reset failed.");
                }
              }}
              className="
                px-3
                py-2
                rounded-xl
                border border-amber-500/30
                bg-amber-500/10
                text-xs
                font-bold
                text-amber-300
                hover:bg-amber-500/15
                transition
              "
            >
              Reset Demo
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <div
          className="
            rounded-xl
            border border-red-500/30
            bg-red-500/5
            p-3
            text-xs
            text-red-300
          "
        >
          <span className="font-bold">
            SYSTEM ERROR:
          </span>{" "}
          {error}
        </div>
      )}


      {/* =====================================================
          LIVE OPERATION KPIs
          ===================================================== */}

      <section>

        <div className="flex items-center justify-between mb-3">

          <div>
            <div className="text-[9px] font-black tracking-[0.18em] text-slate-600 uppercase">
              Operational Overview
            </div>

            <div className="text-xs text-slate-400 mt-1">
              Current emergency response state
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            LIVE
          </div>

        </div>


        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">

          {/* ACTIVE */}

          <div
            className="
              group
              rounded-xl
              border border-slate-800
              bg-[#0d131d]
              p-4
              hover:border-slate-700
              transition
            "
          >

            <div className="flex justify-between items-start">

              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Active incidents
              </div>

              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 text-xs">
                !
              </div>

            </div>

            <div className="text-3xl font-black mt-3">
              {stats?.active_incidents ?? active.length}
            </div>

            <div className="text-[9px] text-slate-600 mt-1">
              Requiring operational attention
            </div>

          </div>


          {/* CRITICAL */}

          <div
            className="
              rounded-xl
              border border-red-500/20
              bg-red-500/[0.035]
              p-4
            "
          >

            <div className="flex justify-between items-start">

              <div className="text-[9px] uppercase tracking-wider text-red-300/70 font-bold">
                Critical P1
              </div>

              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 text-xs">
                P1
              </div>

            </div>

            <div className="text-3xl font-black text-red-400 mt-3">
              {stats?.critical_incidents ?? critical.length}
            </div>

            <div className="text-[9px] text-red-300/40 mt-1">
              Immediate human attention
            </div>

          </div>


          {/* AVAILABLE */}

          <div
            className="
              rounded-xl
              border border-emerald-500/15
              bg-emerald-500/[0.025]
              p-4
            "
          >

            <div className="flex justify-between items-start">

              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Available
              </div>

              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs">
                ✓
              </div>

            </div>

            <div className="text-3xl font-black text-emerald-400 mt-3">
              {stats?.available_resources ?? available.length}
            </div>

            <div className="text-[9px] text-slate-600 mt-1">
              Ready for dispatch
            </div>

          </div>


          {/* DEPLOYED */}

          <div
            className="
              rounded-xl
              border border-orange-500/15
              bg-orange-500/[0.025]
              p-4
            "
          >

            <div className="flex justify-between items-start">

              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Deployed
              </div>

              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 text-xs">
                →
              </div>

            </div>

            <div className="text-3xl font-black text-orange-400 mt-3">
              {stats?.deployed_resources ?? busy.length}
            </div>

            <div className="text-[9px] text-slate-600 mt-1">
              Currently assigned
            </div>

          </div>


          {/* ETA */}

          <div
            className="
              rounded-xl
              border border-cyan-500/15
              bg-cyan-500/[0.025]
              p-4
            "
          >

            <div className="flex justify-between items-start">

              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Avg response ETA
              </div>

              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-xs">
                ⏱
              </div>

            </div>

            <div className="text-3xl font-black text-cyan-300 mt-3">
              {stats?.avg_response_eta != null
                ? `${stats.avg_response_eta}`
                : "—"}
            </div>

            <div className="text-[9px] text-slate-600 mt-1">
              Estimated response time
              {stats?.avg_response_eta != null ? " · min" : ""}
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          LIVE MAP
          ===================================================== */}

      <section
        className="
          rounded-2xl
          border border-slate-800
          bg-[#0d131d]
          overflow-hidden
        "
      >

        <div
          className="
            px-5
            py-4
            border-b border-slate-800
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-3
          "
        >

          <div>

            <div className="flex items-center gap-2">

              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />

              <h2 className="font-black text-sm">
                Live Response Map
              </h2>

            </div>

            <p className="text-[10px] text-slate-500 mt-1">
              Real-time incidents, responders and movement
              positions.
            </p>

          </div>


          {/* MAP LEGEND */}

          <div className="flex flex-wrap items-center gap-3 text-[9px]">

  <span className="flex items-center gap-1.5 text-red-300">
    <span className="w-2 h-2 rounded-full bg-red-500" />
    P1 Critical
  </span>

  <span className="flex items-center gap-1.5 text-orange-300">
    <span className="w-2 h-2 rounded-full bg-orange-400" />
    P2 High
  </span>

  <span className="flex items-center gap-1.5 text-cyan-300">
    <span className="w-2 h-2 rounded-full bg-cyan-400" />
    SafeRoute
  </span>

  <span className="flex items-center gap-1.5 text-yellow-300">
    <span className="w-2 h-2 rounded-full bg-yellow-400" />
    En Route
  </span>

  <span className="flex items-center gap-1.5 text-purple-300">
    <span className="w-2 h-2 rounded-full bg-purple-400" />
    Returning
  </span>

  <span className="flex items-center gap-1.5 text-emerald-300">
    <span className="w-2 h-2 rounded-full bg-emerald-400" />
    Available
  </span>

</div>

        </div>

        <div className="h-[420px] lg:h-[500px]">
          <MapView
            incidents={incidents}
            resources={resources}
          />
        </div>

      </section> 


      {/* =====================================================
          OPERATIONAL PANELS
          ===================================================== */}

      <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-5">


        {/* ===================================================
            PRIORITY QUEUE
            =================================================== */}

        <section
          className="
            rounded-2xl
            border border-slate-800
            bg-[#0d131d]
            overflow-hidden
          "
        >

          <div className="px-5 py-4 border-b border-slate-800">

            <div className="flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <span className="w-2 h-2 rounded-full bg-red-500" />

                  <h2 className="font-black text-sm">
                    Priority Queue
                  </h2>

                </div>

                <p className="text-[10px] text-slate-500 mt-1">
                  Highest-risk incidents requiring attention.
                </p>

              </div>

              <div className="text-[9px] px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/15">
                {critical.length} P1
              </div>

            </div>

          </div>


          <div className="divide-y divide-slate-800">

            {priorityQueue.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-600">
                No active incidents.
              </div>
            )}

            {priorityQueue.map((x, index) => (

              <div
                key={x.id}
                className="
                  group
                  px-5
                  py-3.5
                  hover:bg-slate-900/40
                  transition
                "
              >

                <div className="flex items-center gap-3">

                  {/* RANK */}

                  <div
                    className={`
                      w-7
                      h-7
                      shrink-0
                      rounded-lg
                      flex
                      items-center
                      justify-center
                      text-[10px]
                      font-black
                      ${
                        String(x.priority || "").toUpperCase() === "P1"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-slate-900 text-slate-500 border border-slate-800"
                      }
                    `}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>


                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-2">

                      <span className="font-bold text-xs">
                        INC-{String(x.id).padStart(3, "0")}
                      </span>

                      <span className="text-[10px] text-slate-600">
                        {x.incident_type}
                      </span>

                    </div>

                    <div className="text-[9px] text-slate-600 mt-1">
                      {x.people_affected ?? 0} affected
                      {" · "}
                      {x.status}
                    </div>

                  </div>


                  <span
                    className={`
                      shrink-0
                      px-2
                      py-1
                      rounded-md
                      border
                      text-[10px]
                      font-black
                      ${badge[x.priority] || badge.P4}
                    `}
                  >
                    {x.priority} · {x.priority_score}
                  </span>

                </div>

              </div>

            ))}

          </div>

        </section>


        {/* ===================================================
            RESPONDER STATUS
            =================================================== */}

        <section
          className="
            rounded-2xl
            border border-slate-800
            bg-[#0d131d]
            overflow-hidden
          "
        >

          <div className="px-5 py-4 border-b border-slate-800">

            <div className="flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

                  <h2 className="font-black text-sm">
                    Responder Status
                  </h2>

                </div>

                <p className="text-[10px] text-slate-500 mt-1">
                  Live availability and deployment state.
                </p>

              </div>

              <div className="text-[9px] text-slate-500">
                {enRoute.length} EN ROUTE
              </div>

            </div>

          </div>


          <div className="p-4 grid sm:grid-cols-2 gap-2">

            {resources.map((r) => {

              const movementActive =
                r.movement?.active === true;

              const movementStatus =
                String(
                  r.movement?.status || ""
                ).toUpperCase();

              const isEnRoute =
                movementActive &&
                movementStatus === "EN_ROUTE";

              return (
                <div
                  key={r.id}
                  className="
                    group
                    rounded-xl
                    border border-slate-800
                    bg-slate-950/40
                    p-3
                    hover:border-slate-700
                    transition
                  "
                >

                  <div className="flex items-start gap-3">

                    <div
                      className="
                        w-9
                        h-9
                        shrink-0
                        rounded-lg
                        bg-slate-900
                        border border-slate-800
                        flex items-center justify-center
                        text-sm
                      "
                    >
                      {resourceIcon(r.resource_type)}
                    </div>


                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">

                        <span className="font-bold text-xs truncate">
                          {r.resource_id}
                        </span>

                        <span
                          className={`
                            shrink-0
                            px-1.5
                            py-0.5
                            rounded
                            border
                            text-[8px]
                            font-black
                            ${statusClass(
                              isEnRoute
                                ? "EN_ROUTE"
                                : r.status
                            )}
                          `}
                        >
                          {isEnRoute
                            ? "EN ROUTE"
                            : r.status}
                        </span>

                      </div>


                      <div className="text-[9px] text-slate-600 mt-1 truncate">
                        {r.resource_type}
                      </div>


                      {r.movement?.eta_seconds != null && (
                        <div className="mt-2">

                          <div className="flex justify-between text-[9px]">

                            <span className="text-cyan-300">
                              ETA{" "}
                              {Math.max(
                                0,
                                Math.ceil(
                                  Number(
                                    r.movement.eta_seconds
                                  )
                                )
                              )}
                              {" sec"}
                            </span>

                            <span className="text-slate-600">
                              {Math.round(
                                Number(
                                  r.movement.progress_percent || 0
                                )
                              )}
                              %
                            </span>

                          </div>

                          <div className="h-1 bg-slate-900 rounded-full mt-1 overflow-hidden">

                            <div
                              className="h-full bg-cyan-400 transition-all duration-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    Number(
                                      r.movement.progress_percent || 0
                                    )
                                  )
                                )}%`
                              }}
                            />

                          </div>

                        </div>
                      )}

                    </div>

                  </div>

                </div>
              );
            })}

          </div>

        </section>

      </div>


      {/* =====================================================
          OPERATIONAL FOOTER
          ===================================================== */}

      <div
        className="
          grid
          grid-cols-2
          md:grid-cols-4
          gap-2
          text-[9px]
        "
      >

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-600">
          <span className="text-slate-500 font-bold">
            INCIDENTS
          </span>
          {" "}
          {incidents.length}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-600">
          <span className="text-slate-500 font-bold">
            RESPONDERS
          </span>
          {" "}
          {resources.length}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-600">
          <span className="text-slate-500 font-bold">
            AVAILABLE
          </span>
          {" "}
          {available.length}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-slate-600">
          <span className="text-slate-500 font-bold">
            EN ROUTE
          </span>
          {" "}
          {enRoute.length}
        </div>

      </div>

    </div>
  );
}
function ReportEmergency({ onCreated }) {
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [lat, setLat] = useState("17.003");
  const [lon, setLon] = useState("82.250");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!description.trim()) {
      setError("Enter an emergency description.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api("/incidents/analyze", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          location: `${area} ${location}`.trim(),
          latitude: Number(lat),
          longitude: Number(lon)
        })
      });

      setAnalysis(result);
    } catch (e) {
      setError(e.message || "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function createIncident() {
    if (!analysis) return;

    setCreating(true);
    setError("");

    try {
      const result = await api("/incidents", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          incident_type: analysis.incident_type,
          severity: analysis.severity,
          severity_score: analysis.severity_score,
          priority: analysis.priority,
          priority_score: analysis.priority_score,
          people_affected: analysis.people_affected,
          latitude: Number(lat),
          longitude: Number(lon)
        })
      });

      alert(`Incident INC-${String(result.id).padStart(3, "0")} created.`);
      setDescription("");
      setLocation("");
      setArea("");
      setAnalysis(null);
      if (onCreated) onCreated();
    } catch (e) {
      setError(e.message || "Unable to create incident.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Report Emergency</h1>
        <p className="text-sm text-slate-500 mt-1">
          Convert an emergency report into structured AI decision support.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">
          <label className="text-xs text-slate-500">Emergency description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Example: Major road accident near the college. Two people injured and one unconscious."
            className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none"
          />

          <label className="text-xs text-slate-500 block mt-4">Area</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Example: Kakinada"
            className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none"
          />

          <label className="text-xs text-slate-500 block mt-4">Location / landmark</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Example: Near North College"
            className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none"
          />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none"
            />
            <input
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="Longitude"
              className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm outline-none"
            />
          </div>

          <button
            onClick={analyze}
            disabled={loading || !description.trim()}
            className="w-full mt-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 font-bold"
          >
            {loading ? "AI ANALYZING..." : "Analyze Emergency"}
          </button>

          {error && <div className="text-xs text-red-400 mt-3">{error}</div>}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">
          {!analysis ? (
            <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-slate-500">
              AI analysis will appear here.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded border font-black ${badge[analysis.priority] || badge.P4}`}>
                  {analysis.priority}
                </span>
                <span className="text-4xl font-black">
                  {analysis.priority_score ?? "—"}
                  <small className="text-sm text-slate-500">/100</small>
                </span>
              </div>

              <div className="text-xl font-black mt-5">
                {analysis.severity} · {analysis.incident_type}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <span className="text-slate-500">People affected</span>
                  <br />{analysis.people_affected ?? 0}
                </div>
                <div>
                  <span className="text-slate-500">Confidence</span>
                  <br />{Math.round(Number(analysis.confidence || 0) * 100)}%
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs text-slate-500">Required resources</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(analysis.required_resources || []).map((r) => (
                    <span key={r} className="px-2 py-1 bg-slate-800 rounded text-xs">{r}</span>
                  ))}
                </div>
              </div>

              <button
                onClick={createIncident}
                disabled={creating}
                className="w-full mt-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black"
              >
                {creating ? "CREATING..." : "CREATE INCIDENT"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api("/incidents");
      setIncidents(Array.isArray(data) ? data : data?.value || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Incidents</h1>
      <p className="text-sm text-slate-500 mt-1">All current emergency incidents.</p>

      {loading ? (
        <div className="mt-6 text-sm text-slate-500">Loading...</div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-950">
              <tr>
                <th className="text-left p-3">Incident</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Affected</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((x) => (
                <tr key={x.id} className="border-t border-slate-800">
                  <td className="p-3 font-semibold">INC-{String(x.id).padStart(3, "0")}</td>
                  <td className="p-3">{x.incident_type}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded border ${badge[x.priority] || badge.P4}`}>
                      {x.priority} · {x.priority_score}
                    </span>
                  </td>
                  <td className="p-3">{x.status}</td>
                  <td className="p-3">{x.people_affected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Resources() {
  const [resources, setResources] = useState([]);

  async function load() {
    try {
      const data = await api("/resources");
      setResources(Array.isArray(data) ? data : data?.value || []);
    } catch (e) {
      console.error("Resource loading error:", e);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Resource Management</h1>
      <p className="text-sm text-slate-500 mt-1">
        Live availability, capabilities, coordinates and assignments.
      </p>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
        {resources.map((r) => {
          const movement = r.movement;
          return (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-[#0d131d] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl">
                  {resourceIcon(r.resource_type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <b>{r.resource_id}</b>
                    <span className={`text-xs ${
                      r.status === "AVAILABLE"
                        ? "text-emerald-400"
                        : r.status === "BUSY"
                          ? "text-orange-400"
                          : "text-slate-500"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{r.resource_type}</div>
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-3">
                Capacity {r.capacity} · {r.capabilities}
              </div>

              <div className="text-[10px] text-slate-600 mt-2">
                {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
              </div>

              {r.current_incident_id && (
                <div className="text-xs text-red-300 mt-2">
                  Assigned to INC-{String(r.current_incident_id).padStart(3, "0")}
                </div>
              )}

              {movement && (
                <div className="mt-3 rounded-lg bg-slate-950/70 border border-slate-800 p-3">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-cyan-300">{movement.status || "MOVING"}</span>
                    <span>{Math.round(Number(movement.progress_percent || 0))}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded mt-2 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${Math.min(100, Math.max(0, Number(movement.progress_percent || 0)))}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    ETA: {movement.eta_seconds != null
                      ? `${Math.max(0, Math.ceil(Number(movement.eta_seconds)))} sec`
                      : "—"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SafeRoute() {
  const [origin, setOrigin] = useState("17.006,82.257");
  const [destination, setDestination] = useState("17.015,82.261");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function parsePair(value) {
    const [lat, lon] = String(value).split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Use latitude,longitude format.");
    }
    return [lat, lon];
  }

  async function calculate() {
    setLoading(true);
    setError("");

    try {
      const [originLat, originLon] = parsePair(origin);
      const [destinationLat, destinationLon] = parsePair(destination);

      const data = await api("/routes/recommend", {
        method: "POST",
        body: JSON.stringify({
          origin_lat: originLat,
          origin_lon: originLon,
          destination_lat: destinationLat,
          destination_lon: destinationLon
        })
      });

      setResult(data);
    } catch (e) {
      setError(e.message || "SafeRoute calculation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">SafeRoute</h1>
        <p className="text-sm text-slate-500 mt-1">
          Risk-aware route recommendations using OSRM and hazard data.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Origin latitude,longitude"
            className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
          />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination latitude,longitude"
            className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
          />
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="mt-3 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-black"
        >
          {loading ? "CALCULATING..." : "CALCULATE SAFEROUTE"}
        </button>

        {error && <div className="text-xs text-red-300 mt-3">{error}</div>}

        {result && (
          <div className="mt-5 space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Stat label="Source" value={result.source || "OSRM"} />
              <Stat label="Routes" value={result.routes?.length || 0} />
              <Stat label="Historical hazards" value={result.historical?.nearby_hazards ?? result.historical_hazards_count ?? 0} />
            </div>

            {(result.routes || []).map((route, index) => (
              <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex justify-between">
                  <b>{route.recommended ? "RECOMMENDED ROUTE" : `Route ${index + 1}`}</b>
                  <span className="text-emerald-300">{route.distance_km ?? "—"} km</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Duration: {route.duration_min ?? "—"} min · Risk: {route.risk_score ?? "—"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Hazards: {(route.hazards_encountered || []).join(", ") || "None detected"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HumanVerification() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [audit, setAudit] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [selectedResources, setSelectedResources] = useState([]);
  const [decision, setDecision] = useState("APPROVE");
  const [note, setNote] = useState("");
  const [availability, setAvailability] = useState(null);
  const [routeResourceId, setRouteResourceId] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedIncident = useMemo(
    () => incidents.find((x) => Number(x.id) === Number(selectedId)) || null,
    [incidents, selectedId]
  );

  async function loadIncidents() {
  const data = await api("/incidents");

  const rows = Array.isArray(data)
    ? data
    : data?.value || [];

  const queue = rows
    .filter(
      (x) =>
        String(x.status || "").toUpperCase() !== "RESOLVED"
    )
    .sort(
      (a, b) =>
        Number(b.priority_score || 0) -
        Number(a.priority_score || 0)
    );

  setIncidents(queue);

  setSelectedId((current) => {
    if (
      current &&
      queue.some(
        (x) => Number(x.id) === Number(current)
      )
    ) {
      return current;
    }

    return queue[0]?.id ?? null;
  });

  return queue;
}

  async function loadResources() {
    const data = await api("/resources");
    setResources(Array.isArray(data) ? data : data?.value || []);
  }

  async function loadAudit() {
    const data = await api("/dispatch-audit");
    setAudit(Array.isArray(data) ? data : data?.value || []);
  }

  async function loadRecommendation(id) {
  if (!id) {
    setRecommendation(null);
    setLoadingRecommendation(false);
    return;
  }

  setLoadingRecommendation(true);
  setRecommendation(null);
  setError("");

  try {
    const data = await api(
      `/incidents/${id}/recommendations`
    );

    if (!data) {
      throw new Error(
        "No recommendation was returned by the AI service."
      );
    }

    setRecommendation(data);

    const ids = (data.resources || [])
      .filter(
        (r) =>
          r.recommended &&
          r.available !== false &&
          String(r.status || "").toUpperCase() === "AVAILABLE"
      )
      .map((r) => r.resource_id);

    setSelectedResources(ids);
    setRouteResourceId(ids[0] || "");
  } catch (e) {
    console.error(
      `Recommendation loading failed for incident ${id}:`,
      e
    );

    setRecommendation(null);

    setError(
      e.message ||
      "Unable to load AI recommendation."
    );
  } finally {
    setLoadingRecommendation(false);
  }
}

  async function loadAvailability(id) {
    if (!id) return;
    try {
      const data = await api(`/incidents/${id}/resource-availability`);
      setAvailability(data);
    } catch {
      setAvailability(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function initialLoad() {
  setLoading(true);
  setError("");

  try {
    await loadIncidents();
  } catch (e) {
    console.error("Incident loading failed:", e);
    setError(
      e.message ||
      "Unable to load incidents. Check that the ResQAI backend is running."
    );
  } finally {
    setLoading(false);
  }

  // Load supporting data independently.
  try {
    await loadResources();
  } catch (e) {
    console.error("Resource loading failed:", e);
  }

  try {
    await loadAudit();
  } catch (e) {
    console.error("Audit loading failed:", e);
  }
}

    initialLoad();

    const timer = setInterval(async () => {
      try {
        await Promise.all([loadIncidents(), loadResources(), loadAudit()]);
        if (selectedId) await loadAvailability(selectedId);
      } catch (e) {
        console.error("Verification refresh error:", e);
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) {
      setError("");
      setSuccess("");
      setRecommendation(null);
      loadRecommendation(selectedId);
      loadAvailability(selectedId);
    }
  }, [selectedId]);

  async function calculateSafeRoute() {
    if (!selectedId || !routeResourceId || !selectedIncident) return;

    const resource = resources.find((r) => r.resource_id === routeResourceId);
    if (!resource) {
      setRouteError("Selected responder is not present in the live resource list.");
      return;
    }

    setRouteLoading(true);
    setRouteError("");

    try {
      const data = await api("/routes/recommend", {
        method: "POST",
        body: JSON.stringify({
          origin_lat: Number(resource.latitude),
          origin_lon: Number(resource.longitude),
          destination_lat: Number(selectedIncident.latitude),
          destination_lon: Number(selectedIncident.longitude)
        })
      });

      setRouteResult(data);
    } catch (e) {
      setRouteError(e.message || "SafeRoute calculation failed.");
      setRouteResult(null);
    } finally {
      setRouteLoading(false);
    }
  }

  function toggleResource(id) {
    setSelectedResources((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  async function submitDecision() {
    if (!selectedId || !recommendation || submitting) return;

    if (decision !== "REJECT" && selectedResources.length === 0) {
      setError("Select at least one resource.");
      return;
    }

    if (!note.trim()) {
      setError("Enter a dispatcher note.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const verifyResult = await api(`/incidents/${selectedId}/verify`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          resource_ids: decision === "REJECT" ? [] : selectedResources,
          note: note.trim()
        })
      });

      try {
        await api("/dispatch-audit", {
          method: "POST",
          body: JSON.stringify({
            incident_id: selectedId,
            incident_label: `INC-${String(selectedId).padStart(3, "0")}`,
            incident_type: selectedIncident?.incident_type || "unknown",
            priority: selectedIncident?.priority || recommendation?.priority?.priority || "P4",
            priority_score: selectedIncident?.priority_score ?? recommendation?.priority?.score ?? null,
            decision,
            resource_ids: decision === "REJECT" ? [] : selectedResources,
            note: note.trim(),
            incident_status_after:
              verifyResult?.incident?.status ||
              verifyResult?.status ||
              (decision === "REJECT" ? "NEW" : "RESOURCE_ASSIGNED"),
            source: "ResQAI Human Verification"
          })
        });
      } catch (auditError) {
        console.error("Audit recording failed:", auditError);
      }

      if (decision !== "REJECT" && routeResult?.routes?.length) {
        const route =
          routeResult.routes.find((x) => x.recommended) ||
          routeResult.routes[0];

        if (Array.isArray(route.geometry) && route.geometry.length >= 2) {
          saveActiveRoute({
            incident_id: selectedId,
            resource_id: routeResourceId || selectedResources[0] || null,
            geometry: route.geometry,
            distance_km: route.distance_km,
            duration_min: route.duration_min,
            risk_score: route.risk_score,
            dispatch_status: "DISPATCHED",
            updated_at: new Date().toISOString()
          });
        }
      }

      if (decision === "REJECT") clearActiveRoute();

      setSuccess(
        `INC-${String(selectedId).padStart(3, "0")} ${decision.toLowerCase()}d successfully.`
      );
      setNote("");

      await Promise.all([loadIncidents(), loadResources(), loadAudit()]);
      await loadRecommendation(selectedId);
    } catch (e) {
      setError(e.message || "Unable to submit the decision.");
    } finally {
      setSubmitting(false);
    }
  }

  const availableRecommended = (recommendation?.resources || []).filter(
    (r) =>
      r.available !== false &&
      String(r.status || "").toUpperCase() === "AVAILABLE"
  );

  const recentAudit = [...audit]
    .sort(
      (a, b) =>
        new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0)
    )
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[.28em] text-amber-400 font-bold">
          Human-in-the-loop dispatch
        </div>
        <h1 className="text-3xl font-black mt-2">Human Verification</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every incident remains in the queue. P1/P2 require human approval;
          lower-priority incidents may be AI auto-dispatched.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-5">
        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Incident Queue</h2>
            <button
              onClick={() => {
                loadIncidents();
                loadAudit();
              }}
              className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-[10px]"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">Loading incidents...</div>
          ) : (
            <div className="space-y-2 mt-4 max-h-[650px] overflow-y-auto">
              {incidents.map((incident) => {
                const p = String(incident.priority || "P4").toUpperCase();
                const selected = Number(selectedId) === Number(incident.id);
                const locked = String(incident.status || "").toUpperCase() !== "NEW";

                return (
                  <button
                    key={incident.id}
                    onClick={() => setSelectedId(incident.id)}
                    className={`w-full text-left rounded-xl border p-3 ${
                      selected
                        ? "border-red-500/50 bg-red-500/5"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                        p === "P1"
                          ? "bg-red-500/15 text-red-400"
                          : p === "P2"
                            ? "bg-orange-500/15 text-orange-400"
                            : p === "P3"
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-emerald-500/15 text-emerald-400"
                      }`}>
                        {p}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm">
                          INC-{String(incident.id).padStart(3, "0")}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {incident.incident_type} · {incident.status}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black">{incident.priority_score ?? "—"}</div>
                        {locked && (
                          <div className="text-[8px] text-orange-300">ASSIGNED</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!incidents.length && (
                <div className="py-10 text-center text-xs text-slate-500">
                  No active incidents are currently in the queue.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] overflow-hidden">
          {loadingRecommendation ? (
  <div className="min-h-[650px] flex flex-col items-center justify-center">

    <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />

    <div className="mt-4 text-sm text-cyan-300 font-bold">
      ANALYZING INCIDENT
    </div>

    <div className="mt-1 text-[10px] text-slate-600 text-center">
      ResQAI is evaluating severity, risk and responder requirements.
    </div>

  </div>
) : !recommendation ? (
  <div className="min-h-[650px] flex flex-col items-center justify-center">

    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sm font-black text-cyan-400">
      AI
    </div>

    <div className="mt-4 text-sm text-slate-400">
      No AI recommendation available
    </div>

    <div className="mt-1 text-[10px] text-slate-600">
      Select an incident from the queue.
    </div>

  </div>
) : (
            <div className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Selected incident
                  </div>
                  <h2 className="text-2xl font-black mt-1">
                    INC-{String(selectedId).padStart(3, "0")}
                  </h2>
                  <div className="text-sm text-slate-400 mt-1">
                    {selectedIncident?.description || "No description"}
                  </div>
                </div>

                <div className={`h-fit px-3 py-2 rounded-xl border font-black ${
                  badge[recommendation.priority?.priority] || badge.P4
                }`}>
                  {recommendation.priority?.priority || selectedIncident?.priority || "P4"}
                  {" · "}
                  {recommendation.priority?.score ?? selectedIncident?.priority_score ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-[10px] uppercase text-cyan-400 font-bold">
                  AI reasoning
                </div>
                <ul className="mt-2 space-y-1">
                  {(recommendation.reasoning || []).map((item, i) => (
                    <li key={i} className="text-xs text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs text-slate-500">Recommended resources</div>
                <div className="grid md:grid-cols-2 gap-2 mt-3">
                  {(recommendation.resources || []).map((resource) => {
                    const available =
                      resource.available !== false &&
                      String(resource.status || "").toUpperCase() === "AVAILABLE";
                    const selected = selectedResources.includes(resource.resource_id);

                    return (
                      <button
                        key={resource.resource_id}
                        disabled={!available || String(selectedIncident?.status || "").toUpperCase() !== "NEW"}
                        onClick={() => toggleResource(resource.resource_id)}
                        className={`text-left rounded-xl border p-3 ${
                          selected
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : "border-slate-800 bg-slate-950/50"
                        } ${available ? "" : "opacity-40"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-lg">
                            {resourceIcon(resource.resource_type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between">
                              <span className="font-bold text-sm">{resource.resource_id}</span>
                              <span className="text-[9px] text-emerald-300">
                                {selected ? "SELECTED" : resource.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {resource.resource_type} · {resource.distance_km ?? "—"} km
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {resource.reason || resource.capabilities}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex flex-col md:flex-row md:justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                      SafeRoute dispatch check
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Calculate a risk-aware route from the selected responder.
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300">
                    OSRM + HAZARDS
                  </span>
                </div>

                <div className="grid md:grid-cols-[1fr_auto] gap-2 mt-4">
                  <select
                    value={routeResourceId}
                    onChange={(e) => {
                      setRouteResourceId(e.target.value);
                      setRouteResult(null);
                      setRouteError("");
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-xs"
                  >
                    <option value="">Select responder</option>
                    {selectedResources.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>

                  <button
                    onClick={calculateSafeRoute}
                    disabled={routeLoading || !routeResourceId}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-black"
                  >
                    {routeLoading ? "ANALYZING..." : "CALCULATE SAFEROUTE"}
                  </button>
                </div>

                {routeError && <div className="text-xs text-red-300 mt-3">{routeError}</div>}

                {routeResult && (
                  <div className="mt-4 space-y-2">
                    {(routeResult.routes || []).map((route, i) => (
                      <div key={i} className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                        <div className="flex justify-between">
                          <b className="text-xs">{route.recommended ? "RECOMMENDED" : `ROUTE ${i + 1}`}</b>
                          <span className="text-xs text-emerald-300">{route.distance_km ?? "—"} km</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {route.duration_min ?? "—"} min · risk {route.risk_score ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                  Dispatcher decision
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  {["APPROVE", "MODIFY", "REJECT"].map((option) => (
                    <button
                      key={option}
                      onClick={() => setDecision(option)}
                      className={`py-2 rounded-lg text-xs font-black border ${
                        decision === option
                          ? option === "APPROVE"
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                            : option === "MODIFY"
                              ? "bg-orange-500/15 border-orange-500/50 text-orange-300"
                              : "bg-red-500/15 border-red-500/50 text-red-300"
                          : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Dispatcher note..."
                  className="w-full mt-3 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs"
                />

                <button
                  onClick={submitDecision}
                  disabled={
                    submitting ||
                    String(selectedIncident?.status || "").toUpperCase() !== "NEW"
                  }
                  className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black"
                >
                  {submitting ? "SUBMITTING..." : `${decision} DISPATCH`}
                </button>

                {String(selectedIncident?.status || "").toUpperCase() !== "NEW" && (
                  <div className="text-[10px] text-orange-300 mt-2">
                    This incident has already been assigned. Duplicate dispatch is disabled.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">
        <div className="flex justify-between">
          <div>
            <h2 className="font-bold">Dispatch Audit Trail</h2>
            <p className="text-[10px] text-slate-500 mt-1">
              Human and AI dispatch decisions recorded by ResQAI.
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400">
            {audit.length} RECORDS
          </span>
        </div>

        <div className="space-y-2 mt-4">
          {recentAudit.map((record) => (
            <div key={record.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className={`w-24 text-center py-2 rounded-lg text-[10px] font-black ${
                  record.decision === "APPROVE"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : record.decision === "MODIFY"
                      ? "bg-orange-500/10 text-orange-300"
                      : "bg-red-500/10 text-red-300"
                }`}>
                  {record.decision || "UNKNOWN"}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">
                    {record.incident_label || `INC-${String(record.incident_id).padStart(3, "0")}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {record.incident_type || "Incident"} · {record.priority || "P?"} · {record.resource_ids?.length || 0} resources
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">
                  {record.recorded_at ? new Date(record.recorded_at).toLocaleString() : "Unknown"}
                </div>
              </div>
              {record.source && (
                <div className="mt-2 text-[9px] uppercase text-cyan-400/70">
                  Source: {record.source}
                </div>
              )}
              {record.note && <div className="mt-2 text-xs text-slate-400">{record.note}</div>}
            </div>
          ))}
          {!recentAudit.length && (
            <div className="py-8 text-center text-xs text-slate-500">
              No dispatch decisions have been audited yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api("/dashboard/stats"),
      api("/dataset/stats"),
      api("/incidents"),
      api("/resources")
    ])
      .then(([stats, dataset, incidents, resources]) => {
        setData({
          stats,
          dataset,
          incidents: Array.isArray(incidents) ? incidents : incidents?.value || [],
          resources: Array.isArray(resources) ? resources : resources?.value || []
        });
      })
      .catch((e) => setError(e.message || "Unable to load analytics."));
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-500">Loading analytics...</div>;
  }

  const incidents = data.incidents;
  const resources = data.resources;
  const resolved = incidents.filter((x) => String(x.status).toUpperCase() === "RESOLVED").length;
  const available = resources.filter((x) => String(x.status).toUpperCase() === "AVAILABLE").length;
  const busy = resources.filter((x) => String(x.status).toUpperCase() === "BUSY").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live emergency operations and historical emergency intelligence.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Incidents" value={incidents.length} />
        <Stat label="Resolved" value={resolved} accent="text-emerald-400" />
        <Stat label="Available resources" value={available} accent="text-cyan-300" />
        <Stat label="Busy resources" value={busy} accent="text-orange-400" />
        <Stat label="Historical incidents" value={data.dataset?.dataset_incidents ?? "—"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">
          <h2 className="font-bold">Severity Distribution</h2>
          <div className="space-y-3 mt-4">
            {["CRITICAL", "HIGH", "MODERATE", "LOW"].map((severity) => {
              const count = incidents.filter(
                (x) => String(x.severity || "").toUpperCase() === severity
              ).length;
              return (
                <div key={severity}>
                  <div className="flex justify-between text-xs">
                    <span>{severity}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded mt-1">
                    <div
                      className="h-full bg-red-500 rounded"
                      style={{ width: `${Math.min(100, count * 10)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">
          <h2 className="font-bold">Dataset Intelligence</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Historical incidents</span>
              <b>{data.dataset?.dataset_incidents ?? "—"}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Historical hazards</span>
              <b>{data.dataset?.dataset_hazards ?? "—"}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("Command Center");
  const [refreshKey, setRefreshKey] = useState(0);

  function created() {
    setRefreshKey((x) => x + 1);
    setPage("Command Center");
  }

  let content;

  switch (page) {
    case "Report Emergency":
      content = <ReportEmergency key={refreshKey} onCreated={created} />;
      break;
    case "Incidents":
      content = <Incidents key={refreshKey} />;
      break;
    case "Human Verification":
      content = <HumanVerification key={refreshKey} />;
      break;
    case "Resources":
      content = <Resources key={refreshKey} />;
      break;
    case "SafeRoute":
      content = <SafeRoute key={refreshKey} />;
      break;
    case "Analytics":
      content = <Analytics key={refreshKey} />;
      break;
    default:
      content = <CommandCenter key={refreshKey} />;
  }

  return (
    <Shell page={page} setPage={setPage}>
      {content}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);