import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { api } from "./api";

const nav = [
  "Command Center",
  "Report Emergency",
  "Incidents",
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

function Shell({ page, setPage, children }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function askQuestion(question) {
    if (!question || loading) return;

    setLoading(true);
    setAnswer("");

    try {
      const result = await api("/ai/query", {
        method: "POST",
        body: JSON.stringify({ question })
      });

      setAnswer(result.answer || "No answer returned.");
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
    <div className="min-h-screen bg-[#070b12] text-slate-100">

      <header className="h-16 border-b border-slate-800 flex items-center px-5 gap-6 sticky top-0 bg-[#070b12]/95 backdrop-blur z-20">
        <div className="font-black tracking-tight text-xl">
          <span className="text-red-400">RESQ</span>AI
        </div>

        <div className="text-xs text-slate-500 border-l border-slate-800 pl-5">
          EMERGENCY OPERATIONS INTELLIGENCE
        </div>

        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
            ● SYSTEM ONLINE
          </span>
        </div>
      </header>

      <div className="flex">

        <aside className="w-56 border-r border-slate-800 min-h-[calc(100vh-4rem)] p-3">

          {nav.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-full text-left px-3 py-3 rounded-lg mb-1 text-sm ${
                page === n
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-900"
              }`}
            >
              {n}
            </button>
          ))}

          <div className="mt-8 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-slate-400 leading-5">
            <b className="text-red-300">
              Human verification required
            </b>
            <br />
            AI recommendations are decision support only and do not replace
            trained responders.
          </div>

        </aside>

        <main className="flex-1 p-6 max-w-[1600px]">
          {children}
        </main>
      </div>

      {/* AI ASSISTANT */}
      <div className="fixed bottom-4 right-4 w-[380px] z-[1500]">
        <div className="rounded-2xl border border-slate-700 bg-[#0d131d] shadow-2xl p-4">

          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-slate-200">
                RESQAI ASSISTANT
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Live operational data assistant
              </div>
            </div>

            <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
              LIVE
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {[
              ["Critical incidents", "Which incidents require immediate attention?"],
              ["Available ambulances", "Which ambulances are available?"],
              ["Resources", "What resources are currently available?"],
              ["Hazards", "What hazards are currently reported?"]
            ].map(([label, question]) => (
              <button
                key={label}
                onClick={() => askQuestion(question)}
                className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              disabled={loading}
              placeholder="Ask about current operations..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-red-500 disabled:opacity-50"
            />

            <button
              onClick={ask}
              disabled={!q.trim() || loading}
              className="px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-bold"
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>

          {loading && (
            <div className="mt-3 rounded-lg bg-slate-900 border border-slate-800 p-3">
              <div className="text-xs text-slate-400">
                ResQAI is analyzing current operational data...
              </div>
            </div>
          )}

          {answer && !loading && (
            <div className="mt-3 rounded-lg bg-slate-900 border border-slate-800 p-3">
              <div className="text-[10px] text-red-400 font-bold uppercase mb-2">
                ResQAI Response
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-line leading-5">
                {answer}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "" }) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131d]">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className={`text-3xl font-black mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

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

/* ============================================================
   LIVE MAP
   ============================================================ */

function MapView({ incidents = [], resources = [] }) {
  const ref = React.useRef(null);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);

  useEffect(() => {
    let map = null;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (!ref.current || cancelled) return;

      map = L.map(ref.current, {
        zoomControl: true
      }).setView([17.003, 82.25], 13);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "© OpenStreetMap"
        }
      ).addTo(map);

      const incidentById = {};

      incidents.forEach((i) => {
        incidentById[i.id] = i;
      });

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

          L.circleMarker(
            [
              Number(incident.latitude),
              Number(incident.longitude)
            ],
            {
              radius: priority === "P1" ? 10 : 8,
              color: markerColor,
              weight: 3,
              fillColor: markerColor,
              fillOpacity: 0.82
            }
          )
            .addTo(map)
            .bindPopup(
              `<div style="min-width:190px">
                <b style="font-size:14px">
                  INC-${String(incident.id).padStart(3, "0")}
                </b>
                <br/>
                <span>${incident.incident_type || "Incident"}</span>
                <hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/>
                <b>${priority} · ${incident.priority_score ?? "-"}/100</b>
                <br/>
                ${incident.people_affected ?? 0} people affected
                <br/>
                Status: ${incident.status || "UNKNOWN"}
              </div>`
            );
        });
      }

      if (showResources) {
        resources.forEach((resource) => {
          if (
            resource.latitude == null ||
            resource.longitude == null
          ) {
            return;
          }

          const status = String(
            resource.status || "UNKNOWN"
          ).toUpperCase();

          const busy = status === "BUSY";
          const icon = resourceIcon(resource.resource_type);
          const border = busy ? "#f97316" : "#22c55e";

          const html = `
            <div style="
              width:38px;
              height:38px;
              border-radius:12px;
              background:#0b1220;
              border:2px solid ${border};
              box-shadow:0 4px 12px rgba(0,0,0,.35);
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:20px;
            ">${icon}</div>
          `;

          const marker = L.marker(
            [
              Number(resource.latitude),
              Number(resource.longitude)
            ],
            {
              icon: L.divIcon({
                className: "resq-resource-marker",
                html,
                iconSize: [38, 38],
                iconAnchor: [19, 19],
                popupAnchor: [0, -19]
              })
            }
          ).addTo(map);

          const assignment =
            resource.current_incident_id
              ? `INC-${String(
                  resource.current_incident_id
                ).padStart(3, "0")}`
              : "None";

          marker.bindPopup(
            `<div style="min-width:205px">
              <b style="font-size:14px">${resource.resource_id}</b>
              <br/>
              <span>${icon} ${
                resource.resource_type || "Resource"
              }</span>
              <hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/>
              <b>Status: ${resource.status || "UNKNOWN"}</b>
              <br/>
              Capacity: ${resource.capacity ?? "-"}
              <br/>
              Assignment: ${assignment}
              <br/>
              <small>${
                resource.capabilities || "No capability data"
              }</small>
            </div>`
          );

          if (
            busy &&
            resource.current_incident_id &&
            incidentById[resource.current_incident_id]
          ) {
            const incident =
              incidentById[resource.current_incident_id];

            if (
              incident.latitude != null &&
              incident.longitude != null
            ) {
              L.polyline(
                [
                  [
                    Number(resource.latitude),
                    Number(resource.longitude)
                  ],
                  [
                    Number(incident.latitude),
                    Number(incident.longitude)
                  ]
                ],
                {
                  color: border,
                  weight: 2,
                  dashArray: "6 6",
                  opacity: 0.65
                }
              ).addTo(map);
            }
          }
        });
      }
    });

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [
    incidents,
    resources,
    showIncidents,
    showResources
  ]);

  return (
    <div className="relative h-full">

      <div ref={ref} className="h-full" />

      <div className="absolute top-3 left-3 z-[1000] flex gap-2">
        <button
          onClick={() =>
            setShowIncidents((v) => !v)
          }
          className={`px-3 py-2 rounded-xl text-[11px] font-bold border backdrop-blur ${
            showIncidents
              ? "bg-slate-900/90 border-red-500/40 text-white"
              : "bg-slate-900/80 border-slate-700 text-slate-500"
          }`}
        >
          ● Incidents
        </button>

        <button
          onClick={() =>
            setShowResources((v) => !v)
          }
          className={`px-3 py-2 rounded-xl text-[11px] font-bold border backdrop-blur ${
            showResources
              ? "bg-slate-900/90 border-emerald-500/40 text-white"
              : "bg-slate-900/80 border-slate-700 text-slate-500"
          }`}
        >
          🚑 Resources
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2 text-[10px] text-slate-300 shadow-xl">
        <div className="font-bold text-slate-200 mb-1">
          LIVE MAP
        </div>

        <div className="flex gap-3">
          <span>
            <i className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
            P1
          </span>

          <span>
            <i className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" />
            P2
          </span>

          <span>🟢 Available</span>
          <span>🟠 Busy</span>
        </div>
      </div>

    </div>
  );
}

/* ============================================================
   COMMAND CENTER
   ============================================================ */

function Command() {
  const [s, setS] = useState(null);
  const [inc, setInc] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [resourceFilter, setResourceFilter] = useState("ALL");
  const [selectedIncident, setSelectedIncident] = useState(null);

  async function load() {
    try {
      const [
        stats,
        incidents,
        resourceData
      ] = await Promise.all([
        api("/dashboard/stats"),
        api("/incidents"),
        api("/resources")
      ]);

      setS(stats);

      setInc(
        Array.isArray(incidents)
          ? incidents
          : incidents?.value || []
      );

      setResources(
        Array.isArray(resourceData)
          ? resourceData
          : resourceData?.value || []
      );

      setUpdated(new Date());
    } catch (e) {
      console.error(
        "Command Center loading error:",
        e
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(
      load,
      10000
    );

    return () => clearInterval(timer);
  }, []);

  const available =
    resources.filter(
      (r) =>
        String(r.status || "")
          .toUpperCase() === "AVAILABLE"
    ).length;

  const busy =
    resources.filter(
      (r) =>
        String(r.status || "")
          .toUpperCase() === "BUSY"
    ).length;

  const offline =
    resources.filter((r) => {
      const status = String(
        r.status || ""
      ).toUpperCase();

      return (
        status === "OFFLINE" ||
        status === "MAINTENANCE"
      );
    }).length;

  const critical =
    inc.filter(
      (x) =>
        String(x.priority || "")
          .toUpperCase() === "P1"
    ).length;

  const active =
    inc.filter(
      (x) =>
        String(x.status || "")
          .toUpperCase() !== "RESOLVED"
    ).length;

  const utilization = Math.round(
    (busy / Math.max(resources.length, 1)) *
      100
  );

  const filteredResources =
    resources.filter((r) => {
      if (resourceFilter === "ALL") {
        return true;
      }

      return (
        String(r.status || "")
          .toUpperCase() === resourceFilter
      );
    });

  const priorityQueue = [...inc]
    .filter(
      (x) =>
        String(x.status || "")
          .toUpperCase() !== "RESOLVED"
    )
    .sort(
      (a, b) =>
        (b.priority_score || 0) -
        (a.priority_score || 0)
    )
    .slice(0, 7);

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#111827] via-[#0d131d] to-[#0b1018] p-5 shadow-xl">

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />

              <span className="text-[10px] uppercase tracking-[.28em] text-emerald-400 font-bold">
                Live Emergency Operations
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2">
              Command Center
            </h1>

            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Unified operational view of emergency incidents,
              responder resources and dispatch intelligence.
            </p>
          </div>

          <div className="flex items-center gap-2">

            <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">
              ● SYSTEM OPERATIONAL
            </div>

            <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs text-slate-400">
              {updated
                ? `SYNC ${updated.toLocaleTimeString()}`
                : "SYNCING..."}
            </div>

            <button
              onClick={load}
              className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-bold"
            >
              Refresh
            </button>

          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        <Stat
          label="Active incidents"
          value={
            s?.active_incidents ??
            active
          }
        />

        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="text-xs text-red-400 uppercase">
            Critical P1
          </div>

          <div className="text-3xl font-black text-red-400 mt-1">
            {s?.critical_incidents ??
              critical}
          </div>

          <div className="text-[10px] text-red-300/60 mt-1">
            Immediate attention
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs text-emerald-400 uppercase">
            Available
          </div>

          <div className="text-3xl font-black text-emerald-400 mt-1">
            {s?.available_resources ??
              available}
          </div>

          <div className="text-[10px] text-emerald-300/60 mt-1">
            Ready for dispatch
          </div>
        </div>

        <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
          <div className="text-xs text-orange-400 uppercase">
            Deployed
          </div>

          <div className="text-3xl font-black text-orange-400 mt-1">
            {s?.deployed_resources ??
              busy}
          </div>

          <div className="text-[10px] text-orange-300/60 mt-1">
            Currently responding
          </div>
        </div>

        <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
          <div className="text-xs text-cyan-300 uppercase">
            Avg response ETA
          </div>

          <div className="text-3xl font-black text-cyan-300 mt-1">
            {s?.avg_response_eta ??
              "—"}

            {s?.avg_response_eta != null && (
              <span className="text-sm ml-1 text-cyan-300/60">
                min
              </span>
            )}
          </div>

          <div className="text-[10px] text-cyan-300/60 mt-1">
            Current system estimate
          </div>
        </div>
      </div>

      {/* MAP + RESOURCES */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5">

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] overflow-hidden shadow-2xl">

          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/30">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">
                    Live Response Map
                  </h2>

                  <span className="text-[9px] px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                    LIVE
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-1">
                  Incidents, responder locations and active assignments
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-300">
                  P1 {critical}
                </span>

                <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300">
                  Available {available}
                </span>

                <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-300">
                  Busy {busy}
                </span>
              </div>
            </div>
          </div>

          <div className="h-[560px]">
            <MapView
              incidents={inc}
              resources={resources}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-4 shadow-xl">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">
                Response Resources
              </h2>

              <p className="text-[11px] text-slate-500 mt-1">
                Live deployment control
              </p>
            </div>

            <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400">
              {resources.length} TOTAL
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">

            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 uppercase">
                Deployment utilization
              </span>

              <span className="font-bold text-slate-300">
                {utilization}%
              </span>
            </div>

            <div className="h-2 mt-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{
                  width: `${utilization}%`
                }}
              />
            </div>

            <div className="flex justify-between mt-2 text-[10px] text-slate-500">
              <span>{available} ready</span>
              <span>{busy} deployed</span>
            </div>
          </div>

          <div className="flex gap-1 mt-4">

            {["ALL", "AVAILABLE", "BUSY"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() =>
                    setResourceFilter(status)
                  }
                  className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-bold border ${
                    resourceFilter === status
                      ? "bg-slate-800 border-slate-600 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>

          <div className="space-y-2 mt-3 max-h-[390px] overflow-y-auto pr-1">

            {filteredResources.map((r) => {

              const status =
                String(
                  r.status || "UNKNOWN"
                ).toUpperCase();

              const isBusy =
                status === "BUSY";

              return (
                <button
                  key={r.id}
                  onClick={() => {
                    if (
                      r.current_incident_id
                    ) {
                      const target =
                        inc.find(
                          (x) =>
                            x.id ===
                            r.current_incident_id
                        );

                      if (target) {
                        setSelectedIncident(
                          target
                        );
                      }
                    }
                  }}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/50 p-3 hover:border-slate-600 hover:bg-slate-900/70 transition"
                >

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl border border-slate-800">
                      {resourceIcon(
                        r.resource_type
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center justify-between gap-2">

                        <span className="font-bold text-sm">
                          {r.resource_id}
                        </span>

                        <span
                          className={`text-[9px] font-black px-2 py-1 rounded-full ${
                            isBusy
                              ? "bg-orange-500/10 text-orange-300"
                              : status ===
                                  "AVAILABLE"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1">
                        {r.resource_type}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>
                      Capacity {r.capacity ?? "—"}
                    </span>

                    <span>
                      {isBusy &&
                      r.current_incident_id
                        ? `INC-${String(
                            r.current_incident_id
                          ).padStart(3, "0")}`
                        : "READY"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PRIORITY + STATUS */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5">

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">
                Priority Response Queue
              </h2>

              <p className="text-[11px] text-slate-500 mt-1">
                Highest-priority active incidents
              </p>
            </div>

            <span className="text-[10px] text-slate-500">
              TOP {priorityQueue.length}
            </span>
          </div>

          <div className="space-y-1">

            {priorityQueue.map((x) => {

              const priority =
                String(
                  x.priority || "P4"
                ).toUpperCase();

              return (
                <button
                  key={x.id}
                  onClick={() =>
                    setSelectedIncident(x)
                  }
                  className="w-full text-left py-3 px-3 rounded-xl hover:bg-slate-900/70 border border-transparent hover:border-slate-800 transition"
                >
                  <div className="flex items-center gap-3">

                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                        priority === "P1"
                          ? "bg-red-500/15 text-red-400"
                          : priority === "P2"
                            ? "bg-orange-500/15 text-orange-400"
                            : priority === "P3"
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {priority}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="font-semibold text-sm truncate">
                        INC-
                        {String(x.id).padStart(
                          3,
                          "0"
                        )}
                        {" · "}
                        {x.incident_type}
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1">
                        {x.people_affected ?? 0} affected
                        {" · "}
                        {x.status || "UNKNOWN"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sm">
                        {x.priority_score ??
                          "—"}
                      </div>

                      <div className="text-[9px] text-slate-500">
                        /100
                      </div>
                    </div>

                  </div>
                </button>
              );
            })}

            {!priorityQueue.length && (
              <div className="py-8 text-center text-sm text-slate-500">
                No active incidents.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Operational readiness
          </div>

          <div className="flex items-center gap-3 mt-3">

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">
              ✓
            </div>

            <div>
              <div className="font-bold">
                System operational
              </div>

              <div className="text-[10px] text-slate-500">
                Live APIs responding
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">

            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500">
                Active
              </div>
              <div className="text-xl font-black mt-1">
                {active}
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500">
                Critical
              </div>
              <div className="text-xl font-black text-red-400 mt-1">
                {critical}
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500">
                Ready
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {available}
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-500">
                Offline / Maint.
              </div>
              <div className="text-xl font-black text-slate-300 mt-1">
                {offline}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">

            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
              Human verification
            </div>

            <p className="text-[11px] text-amber-100/70 mt-2 leading-5">
              AI recommendations are decision support only.
              Final dispatch decisions must be independently
              verified by trained responders.
            </p>
          </div>
        </div>
      </div>

      {/* INCIDENT DRAWER */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex justify-end">

          <div className="w-full max-w-md h-full bg-[#0b111b] border-l border-slate-700 shadow-2xl overflow-y-auto">

            <div className="sticky top-0 bg-[#0b111b]/95 backdrop-blur border-b border-slate-800 p-5">

              <div className="flex items-center justify-between">

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-red-400 font-bold">
                    Incident Detail
                  </div>

                  <h2 className="text-2xl font-black mt-1">
                    INC-
                    {String(
                      selectedIncident.id
                    ).padStart(3, "0")}
                  </h2>
                </div>

                <button
                  onClick={() =>
                    setSelectedIncident(null)
                  }
                  className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">

              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">

                <div className="flex items-center justify-between">

                  <div>
                    <div className="text-xs text-slate-500">
                      Incident type
                    </div>

                    <div className="font-bold mt-1">
                      {selectedIncident.incident_type ||
                        "Unknown"}
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-lg border text-xs font-black ${
                      badge[
                        selectedIncident.priority
                      ] || badge.P4
                    }`}
                  >
                    {selectedIncident.priority ||
                      "P?"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[10px] text-slate-500">
                    Priority score
                  </div>

                  <div className="text-3xl font-black text-red-400 mt-1">
                    {selectedIncident.priority_score ??
                      "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[10px] text-slate-500">
                    People affected
                  </div>

                  <div className="text-3xl font-black mt-1">
                    {selectedIncident.people_affected ??
                      0}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Operational status
                </div>

                <div className="font-bold mt-2">
                  {selectedIncident.status ||
                    "UNKNOWN"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Location
                </div>

                <div className="text-sm text-slate-300 mt-2">
                  {selectedIncident.location ||
                    "Coordinates supplied"}
                </div>

                {selectedIncident.latitude !=
                    null &&
                  selectedIncident.longitude !=
                    null && (
                    <div className="text-[10px] text-slate-500 mt-2">
                      {
                        selectedIncident.latitude
                      }
                      {", "}
                      {
                        selectedIncident.longitude
                      }
                    </div>
                  )}
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                  Dispatch policy
                </div>

                <p className="text-[11px] text-amber-100/70 mt-2 leading-5">
                  ResQAI provides AI-assisted prioritization
                  and resource recommendations. Final dispatch
                  requires trained human verification.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ============================================================
   REPORT EMERGENCY
   ============================================================ */

function Report({ onCreated }) {
  const [d, setD] = useState("");
  const [loc, setLoc] = useState("");
  const [lat, setLat] = useState("17.003");
  const [lon, setLon] = useState("82.250");
  const [loading, setLoading] = useState(false);
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");

  async function analyze() {
    setLoading(true);
    setErr("");

    try {
      const result = await api(
        "/incidents/analyze",
        {
          method: "POST",
          body: JSON.stringify({
            description: d,
            location: loc,
            latitude: +lat,
            longitude: +lon
          })
        }
      );

      setA(result);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    try {
      const x = await api(
        "/incidents",
        {
          method: "POST",
          body: JSON.stringify({
            description: d,
            incident_type: a.incident_type,
            severity: a.severity,
            severity_score: a.severity_score,
            priority: a.priority,
            priority_score: a.priority_score,
            people_affected:
              a.people_affected,
            latitude: +lat,
            longitude: +lon
          })
        }
      );

      onCreated();
      setA(null);
      setD("");

      alert(
        `Incident #INC-${String(
          x.id
        ).padStart(3, "0")} created.`
      );
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold">
        Report Emergency
      </h1>

      <p className="text-slate-500 text-sm mb-5">
        Convert an unstructured report into structured decision support.
      </p>

      <div className="grid lg:grid-cols-2 gap-5">

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <label className="text-xs text-slate-400">
            Emergency description
          </label>

          <textarea
            value={d}
            onChange={(e) =>
              setD(e.target.value)
            }
            rows="8"
            placeholder="Example: Major road accident near the college. Two injured and one unconscious. Traffic blocked."
            className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none"
          />

          <div className="grid grid-cols-3 gap-2 mt-3">

            <input
              value={loc}
              onChange={(e) =>
                setLoc(e.target.value)
              }
              placeholder="Location"
              className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"
            />

            <input
              value={lat}
              onChange={(e) =>
                setLat(e.target.value)
              }
              placeholder="Latitude"
              className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"
            />

            <input
              value={lon}
              onChange={(e) =>
                setLon(e.target.value)
              }
              placeholder="Longitude"
              className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"
            />
          </div>

          <button
            disabled={!d || loading}
            onClick={analyze}
            className="mt-4 w-full py-3 rounded-lg bg-red-600 font-bold disabled:opacity-40"
          >
            {loading
              ? "AI ANALYZING INCIDENT..."
              : "Analyze Emergency"}
          </button>

          {err && (
            <p className="text-red-400 text-xs mt-3">
              {err}
            </p>
          )}
        </div>

        {a ? (
          <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

            <div className="flex items-center justify-between">

              <span
                className={`px-3 py-1 rounded border font-black ${
                  badge[a.priority] ||
                  badge.P4
                }`}
              >
                {a.priority}
              </span>

              <span className="text-4xl font-black">
                {a.priority_score}
                <small className="text-sm text-slate-500">
                  /100
                </small>
              </span>
            </div>

            <div className="text-xl font-black mt-5">
              {a.severity} · {a.incident_type}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">

              <div>
                <span className="text-slate-500">
                  People affected
                </span>
                <br />
                {a.people_affected}
              </div>

              <div>
                <span className="text-slate-500">
                  AI confidence
                </span>
                <br />
                {Math.round(
                  (a.confidence || 0) * 100
                )}
                %
              </div>
            </div>

            <div className="mt-4">

              <div className="text-xs text-slate-500">
                Required resources
              </div>

              <div className="flex gap-2 flex-wrap mt-2">

                {(a.required_resources || []).map(
                  (x) => (
                    <span
                      key={x}
                      className="px-2 py-1 bg-slate-800 rounded text-xs"
                    >
                      {x}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="mt-4">

              <div className="text-xs text-slate-500">
                Reasoning
              </div>

              <ul className="list-disc ml-5 text-sm text-slate-300 mt-2">

                {(a.reasoning || []).map(
                  (x, i) => (
                    <li key={i}>{x}</li>
                  )
                )}
              </ul>
            </div>

            <button
              onClick={create}
              className="mt-5 w-full py-3 rounded-lg bg-emerald-600 font-bold"
            >
              Verify & Create Incident
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-600 p-10">
            Analysis appears here
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   INCIDENTS
   ============================================================ */

function Incidents() {
  const [xs, setXs] = useState([]);

  const load = () =>
    api("/incidents").then((data) => {
      setXs(
        Array.isArray(data)
          ? data
          : data?.value || []
      );
    });

  useEffect(() => {
    load();
  }, []);

  async function alloc(id) {
    try {
      const r = await api(
        "/resources/allocate",
        {
          method: "POST",
          body: JSON.stringify({
            incident_id: id
          })
        }
      );

      alert(
        r.recommendations?.length
          ? r.recommendations
              .map(
                (x) =>
                  `${x.resource_id}: ${x.reason}`
              )
              .join("\n")
          : "No matching available resource."
      );

      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold">
        Incident Management
      </h1>

      <div className="mt-5 rounded-xl border border-slate-800 overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-slate-900 text-slate-500 text-xs uppercase">

              <tr>
                <th className="p-3 text-left">
                  Incident
                </th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>People</th>
                <th />
              </tr>

            </thead>

            <tbody>

              {xs.map((x) => (
                <tr
                  key={x.id}
                  className="border-t border-slate-800"
                >
                  <td className="p-3 font-semibold">
                    INC-
                    {String(x.id).padStart(
                      3,
                      "0"
                    )}
                  </td>

                  <td>
                    {x.incident_type}
                  </td>

                  <td>
                    <span
                      className={`px-2 py-1 rounded border ${
                        badge[x.priority] ||
                        badge.P4
                      }`}
                    >
                      {x.priority} ·{" "}
                      {x.priority_score}
                    </span>
                  </td>

                  <td>{x.status}</td>
                  <td>{x.people_affected}</td>

                  <td>
                    <button
                      onClick={() =>
                        alloc(x.id)
                      }
                      className="px-2 py-1 bg-slate-800 rounded text-xs"
                    >
                      Allocate
                    </button>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   RESOURCES
   ============================================================ */

function Resources() {
  const [rs, setRs] = useState([]);

  async function load() {
    try {
      const data = await api(
        "/resources"
      );

      setRs(
        Array.isArray(data)
          ? data
          : data?.value || []
      );
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(
      load,
      10000
    );

    return () =>
      clearInterval(timer);
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold">
        Resource Management
      </h1>

      <p className="text-sm text-slate-500 mt-1">
        Live availability, capabilities and incident assignments.
      </p>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">

        {rs.map((r) => (
          <div
            className="rounded-xl border border-slate-800 bg-[#0d131d] p-4"
            key={r.id}
          >

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl">
                {resourceIcon(
                  r.resource_type
                )}
              </div>

              <div className="flex-1">

                <div className="flex justify-between">

                  <b>{r.resource_id}</b>

                  <span
                    className={`text-xs ${
                      r.status ===
                      "AVAILABLE"
                        ? "text-emerald-400"
                        : r.status === "BUSY"
                          ? "text-orange-400"
                          : "text-slate-500"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="text-sm text-slate-400 mt-1">
                  {r.resource_type}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mt-3">
              Capacity {r.capacity} ·{" "}
              {r.capabilities}
            </div>

            {r.current_incident_id && (
              <div className="text-xs text-red-300 mt-2">
                Assigned to INC-
                {String(
                  r.current_incident_id
                ).padStart(3, "0")}
              </div>
            )}

          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   SAFEROUTE
   ============================================================ */

function SafeRoute() {
  const [origin, setOrigin] =
    useState("17.000,82.240");

  const [dest, setDest] =
    useState("17.010,82.255");

  const [r, setR] = useState(null);
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function go() {
    setLoading(true);
    setError("");

    try {
      const [
        a,
        b
      ] = origin
        .split(",")
        .map(Number);

      const [
        c,
        d
      ] = dest
        .split(",")
        .map(Number);

      setR(
        await api(
          "/routes/recommend",
          {
            method: "POST",
            body: JSON.stringify({
              origin_lat: a,
              origin_lon: b,
              destination_lat: c,
              destination_lon: d
            })
          }
        )
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold">
        SafeRoute
      </h1>

      <p className="text-slate-500 text-sm">
        Risk-aware route recommendation; not a guaranteed safest route.
      </p>

      <div className="mt-5 rounded-xl border border-slate-800 bg-[#0d131d] p-5">

        <div className="grid md:grid-cols-2 gap-3">

          <input
            value={origin}
            onChange={(e) =>
              setOrigin(e.target.value)
            }
            className="bg-slate-950 border border-slate-700 rounded p-3"
            placeholder="origin lat,lon"
          />

          <input
            value={dest}
            onChange={(e) =>
              setDest(e.target.value)
            }
            className="bg-slate-950 border border-slate-700 rounded p-3"
            placeholder="destination lat,lon"
          />
        </div>

        <button
          onClick={go}
          disabled={loading}
          className="mt-3 px-5 py-2 rounded bg-red-600 disabled:opacity-40"
        >
          {loading
            ? "Analyzing..."
            : "Recommend Route"}
        </button>

        {error && (
          <div className="mt-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {r && (
          <>
            <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
              Source: {r.source || "Routing engine"}
              {" · "}
              Historical data used:{" "}
              {r.historical_data_used
                ? "YES"
                : "NO"}
            </div>

            <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-3 gap-3">

              {(r.routes || []).map(
                (x) => (
                  <div
                    key={x.route_id}
                    className={`p-4 rounded-xl border ${
                      x.recommended
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-slate-700"
                    }`}
                  >

                    <div className="flex justify-between">

                      <b>
                        {x.recommended
                          ? "RECOMMENDED"
                          : "ALTERNATIVE"}
                      </b>

                      <span>
                        Risk{" "}
                        {x.risk_score}
                      </span>
                    </div>

                    <div className="mt-3 text-sm">
                      {x.distance_km} km ·{" "}
                      {x.duration_min} min
                    </div>

                    <div className="text-xs text-slate-500 mt-2">
                      Current hazards:{" "}
                      {x.hazards_encountered
                        ?.length
                        ? x.hazards_encountered.join(
                            ", "
                          )
                        : "None"}
                    </div>

                    <div className="text-xs text-slate-500 mt-2">
                      Historical exposure:{" "}
                      {x.historical_hazards_count ??
                        0}{" "}
                      records
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      High/Critical:{" "}
                      {x.historical_high_critical_count ??
                        0}
                    </div>
                  </div>
                )
              )}
            </div>

            {r.reason && (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
                {r.reason}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
   ANALYTICS
   ============================================================ */

function Analytics() {
  const [stats, setStats] =
    useState(null);

  const [datasetStats, setDatasetStats] =
    useState(null);

  const [incidents, setIncidents] =
    useState([]);

  const [resources, setResources] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {

    async function loadAnalytics() {

      try {
        setLoading(true);
        setError("");

        const [
          operationalStats,
          historicalStats,
          incidentData,
          resourceData
        ] = await Promise.all([
          api("/dashboard/stats"),
          api("/dataset/stats"),
          api("/incidents"),
          api("/resources")
        ]);

        setStats(
          operationalStats
        );

        setDatasetStats(
          historicalStats
        );

        setIncidents(
          Array.isArray(incidentData)
            ? incidentData
            : incidentData?.value || []
        );

        setResources(
          Array.isArray(resourceData)
            ? resourceData
            : resourceData?.value || []
        );

      } catch (err) {
        console.error(
          "Analytics loading error:",
          err
        );

        setError(
          err?.message ||
          "Unable to load analytics data."
        );

      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <>
        <h1 className="text-2xl font-bold">
          Analytics
        </h1>

        <div className="mt-6 rounded-xl border border-slate-800 bg-[#0d131d] p-6 text-slate-500">
          Loading ResQAI analytics...
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="text-2xl font-bold">
          Analytics
        </h1>

        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/20 p-5">

          <div className="text-red-400 font-bold">
            Analytics unavailable
          </div>

          <p className="text-sm text-slate-400 mt-2">
            {error}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MODERATE: 0,
    LOW: 0
  };

  const typeCounts = {};

  incidents.forEach((incident) => {

    const severity = String(
      incident.severity ||
      "UNKNOWN"
    ).toUpperCase();

    if (
      severityCounts[severity] !==
      undefined
    ) {
      severityCounts[severity]++;
    }

    const type =
      incident.incident_type ||
      incident.type ||
      "Unknown";

    typeCounts[type] =
      (typeCounts[type] || 0) + 1;
  });

  const availableResources =
    resources.filter(
      (resource) =>
        String(
          resource.status || ""
        ).toUpperCase() ===
        "AVAILABLE"
    ).length;

  const busyResources =
    resources.filter(
      (resource) =>
        String(
          resource.status || ""
        ).toUpperCase() !==
        "AVAILABLE"
    ).length;

  const totalResources =
    resources.length;

  const utilization =
    Math.round(
      (
        busyResources /
        Math.max(
          1,
          totalResources
        )
      ) * 100
    );

  const historicalIncidents =
    datasetStats?.dataset_incidents ||
    0;

  const historicalHazards =
    datasetStats?.dataset_hazards ||
    0;

  const severityDistribution =
    datasetStats?.severity_distribution ||
    {};

  const incidentCategories =
    datasetStats?.incident_categories ||
    {};

  const historicalSeverityRows =
    Object.entries(
      severityDistribution
    ).sort(
      (a, b) => b[1] - a[1]
    );

  const maxHistoricalSeverity =
    Math.max(
      1,
      ...historicalSeverityRows.map(
        ([, value]) => value
      )
    );

  const historicalCategoryRows =
    Object.entries(
      incidentCategories
    ).sort(
      (a, b) => b[1] - a[1]
    );

  const maxHistoricalCategory =
    Math.max(
      1,
      ...historicalCategoryRows.map(
        ([, value]) => value
      )
    );

  const topCategories =
    historicalCategoryRows.slice(
      0,
      4
    );

  const resolvedIncidents =
    incidents.filter(
      (incident) =>
        String(
          incident.status || ""
        ).toUpperCase() ===
        "RESOLVED"
    ).length;

  return (
    <>
      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold">
            Analytics
          </h1>

          <p className="text-slate-500 text-sm mt-1">
            Live emergency operations and historical emergency intelligence.
          </p>
        </div>

        <div className="flex gap-2">

          <div className="text-xs text-emerald-400 border border-emerald-900 bg-emerald-950/30 px-3 py-2 rounded-lg">
            ● DATA CONNECTED
          </div>

          <div className="text-xs text-slate-400 border border-slate-800 bg-slate-900 px-3 py-2 rounded-lg">
            KAKINADA DATASET
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

        <Stat
          label="Active incidents"
          value={
            stats?.active_incidents ??
            incidents.length
          }
        />

        <Stat
          label="Critical incidents"
          value={
            stats?.critical_incidents ??
            severityCounts.CRITICAL
          }
          accent="text-red-400"
        />

        <Stat
          label="Available resources"
          value={availableResources}
          accent="text-emerald-400"
        />

        <Stat
          label="Resource utilization"
          value={`${utilization}%`}
          accent="text-orange-400"
        />
      </div>

      <div className="mt-8">

        <h2 className="text-lg font-bold">
          Historical Emergency Intelligence
        </h2>

        <p className="text-xs text-slate-500 mt-1">
          Historical Kakinada data is separated from active emergency operations.
        </p>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">

          <Stat
            label="Historical incidents"
            value={historicalIncidents.toLocaleString()}
          />

          <Stat
            label="Historical hazards"
            value={historicalHazards.toLocaleString()}
          />

          <Stat
            label="Critical historical"
            value={(
              severityDistribution.Critical ||
              0
            ).toLocaleString()}
            accent="text-red-400"
          />

          <Stat
            label="High severity"
            value={(
              severityDistribution.High ||
              0
            ).toLocaleString()}
            accent="text-orange-400"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <h2 className="font-bold">
            Historical Severity Distribution
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            17,000 historical incident records
          </p>

          <div className="space-y-5 mt-6">

            {historicalSeverityRows.map(
              ([severity, count]) => {

                const percentage =
                  historicalIncidents > 0
                    ? (
                        (count /
                          historicalIncidents) *
                        100
                      ).toFixed(1)
                    : "0.0";

                const width =
                  (
                    count /
                    maxHistoricalSeverity
                  ) * 100;

                let barClass =
                  "bg-slate-500";

                let textClass =
                  "text-slate-300";

                if (
                  severity.toUpperCase() ===
                  "CRITICAL"
                ) {
                  barClass =
                    "bg-red-500";
                  textClass =
                    "text-red-400";
                } else if (
                  severity.toUpperCase() ===
                  "HIGH"
                ) {
                  barClass =
                    "bg-orange-500";
                  textClass =
                    "text-orange-400";
                } else if (
                  severity.toUpperCase() ===
                  "MODERATE"
                ) {
                  barClass =
                    "bg-yellow-500";
                  textClass =
                    "text-yellow-400";
                } else if (
                  severity.toUpperCase() ===
                  "LOW"
                ) {
                  barClass =
                    "bg-emerald-500";
                  textClass =
                    "text-emerald-400";
                }

                return (
                  <div key={severity}>

                    <div className="flex justify-between text-xs mb-2">

                      <span
                        className={
                          textClass
                        }
                      >
                        {severity}
                      </span>

                      <span className="text-slate-400">
                        {count.toLocaleString()}
                        {" "}
                        ({percentage}%)
                      </span>
                    </div>

                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">

                      <div
                        className={`h-full ${barClass} rounded-full`}
                        style={{
                          width: `${width}%`
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <h2 className="font-bold">
            Historical Incident Categories
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Distribution across the imported dataset
          </p>

          <div className="space-y-4 mt-6">

            {historicalCategoryRows.map(
              ([category, count]) => {

                const width =
                  (
                    count /
                    maxHistoricalCategory
                  ) * 100;

                const percentage =
                  historicalIncidents > 0
                    ? (
                        (count /
                          historicalIncidents) *
                        100
                      ).toFixed(1)
                    : "0.0";

                return (
                  <div key={category}>

                    <div className="flex justify-between text-xs mb-2">

                      <span className="text-slate-300">
                        {category}
                      </span>

                      <span className="text-slate-500">
                        {count.toLocaleString()}
                        {" "}
                        ({percentage}%)
                      </span>
                    </div>

                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">

                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${width}%`
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-[#0d131d] p-5">

        <div className="flex items-center justify-between">

          <div>
            <div className="text-xs text-slate-500 uppercase">
              Most frequent emergency types
            </div>

            <div className="text-lg font-bold mt-1">
              Top historical patterns
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Source: 17,000 Kakinada incidents
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">

          {topCategories.map(
            ([category, count], index) => (
              <div
                key={category}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="text-xs text-slate-500">
                  #{index + 1}
                </div>

                <div className="font-bold mt-2">
                  {category}
                </div>

                <div className="text-2xl font-black mt-3">
                  {count.toLocaleString()}
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  historical incidents
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-5">

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="text-xs text-slate-500 uppercase">
            Operational status
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />

            <span className="font-bold">
              SYSTEM OPERATIONAL
            </span>
          </div>

          <p className="text-sm text-slate-500 mt-3">
            ResQAI APIs are providing live incident,
            resource and historical dataset intelligence.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="text-xs text-slate-500 uppercase">
            Resource status
          </div>

          <div className="flex justify-between mt-4">

            <div>
              <div className="text-2xl font-black text-emerald-400">
                {availableResources}
              </div>
              <div className="text-xs text-slate-500">
                Available
              </div>
            </div>

            <div>
              <div className="text-2xl font-black text-orange-400">
                {busyResources}
              </div>
              <div className="text-xs text-slate-500">
                Deployed
              </div>
            </div>

            <div>
              <div className="text-2xl font-black">
                {totalResources}
              </div>
              <div className="text-xs text-slate-500">
                Total
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="text-xs text-slate-500 uppercase">
            Current incident load
          </div>

          <div className="text-3xl font-black mt-3">
            {incidents.length}
          </div>

          <div className="text-xs text-slate-500 mt-1">
            Active operational records
          </div>

          <div className="text-xs text-slate-500 mt-3">
            Resolved:
            {" "}
            <span className="text-slate-300">
              {resolvedIncidents}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-[#0d131d] p-5">

        <div className="flex justify-between items-center">

          <div>
            <h2 className="font-bold">
              Resource Utilization
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Current deployment pressure across response resources.
            </p>
          </div>

          <div className="text-2xl font-black">
            {utilization}%
          </div>
        </div>

        <div className="mt-5 h-3 bg-slate-900 rounded-full overflow-hidden">

          <div
            className="h-full bg-orange-500 rounded-full"
            style={{
              width: `${utilization}%`
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 mt-3">
          <span>
            {availableResources} available
          </span>

          <span>
            {busyResources} deployed
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">

        <div className="text-xs text-amber-400 font-bold uppercase">
          Decision-support notice
        </div>

        <p className="text-sm text-amber-100/80 mt-2">
          Historical records are used for analytics and future model
          development. They are not treated as active emergency incidents.
          Live AI recommendations remain decision-support only and require
          trained human verification.
        </p>
      </div>
    </>
  );
}

/* ============================================================
   LANDING
   ============================================================ */

function Landing({ go }) {
  return (
    <div className="min-h-[80vh] flex items-center">

      <div className="max-w-3xl">

        <div className="text-red-400 font-bold tracking-[.25em] text-xs">
          EMERGENCY OPERATIONS INTELLIGENCE
        </div>

        <h1 className="text-6xl font-black tracking-tight mt-4">
          From Emergency Reports to{" "}
          <span className="text-red-400">
            Intelligent Response Decisions.
          </span>
        </h1>

        <p className="text-lg text-slate-400 mt-6 max-w-2xl">
          ResQAI converts unstructured emergency reports into explainable
          priority scores, resource recommendations, and risk-aware route
          decisions for human verification.
        </p>

        <button
          onClick={go}
          className="mt-8 px-6 py-3 rounded-lg bg-red-600 font-bold"
        >
          Open Command Center →
        </button>

        <div className="grid md:grid-cols-3 gap-3 mt-12">

          {[
            "AI incident understanding",
            "Explainable priority engine",
            "Risk-aware routing"
          ].map((x) => (
            <div
              key={x}
              className="p-4 rounded-xl border border-slate-800 bg-[#0d131d] text-sm"
            >
              {x}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

function App() {
  const [page, setPage] =
    useState("Landing");

  const content =
    page === "Landing"
      ? (
        <Landing
          go={() =>
            setPage("Command Center")
          }
        />
      )
      : page === "Command Center"
        ? <Command />
        : page === "Report Emergency"
          ? (
            <Report
              onCreated={() =>
                setPage("Incidents")
              }
            />
          )
          : page === "Incidents"
            ? <Incidents />
            : page === "Resources"
              ? <Resources />
              : page === "SafeRoute"
                ? <SafeRoute />
                : <Analytics />;

  return page === "Landing"
    ? <div className="p-8">{content}</div>
    : (
      <Shell
        page={page}
        setPage={setPage}
      >
        {content}
      </Shell>
    );
}

createRoot(
  document.getElementById("root")
).render(
  <App />
);