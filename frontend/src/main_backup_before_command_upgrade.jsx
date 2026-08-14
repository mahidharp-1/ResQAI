import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import {api} from "./api";

const nav=["Command Center","Report Emergency","Incidents","Resources","SafeRoute","Analytics"];
const badge={P1:"bg-red-500/20 text-red-300 border-red-500/40",P2:"bg-orange-500/20 text-orange-300 border-orange-500/40",P3:"bg-yellow-500/20 text-yellow-300 border-yellow-500/40",P4:"bg-emerald-500/20 text-emerald-300 border-emerald-500/40"};

function Shell({page,setPage,children}){
  const [q,setQ]=useState("");
  const [answer,setAnswer]=useState("");
  const [loading,setLoading]=useState(false);

  async function ask(){
    const question=q.trim();

    if(!question || loading) return;

    setLoading(true);
    setAnswer("");

    try{
      const result=await api("/ai/query",{
        method:"POST",
        body:JSON.stringify({
          question
        })
      });

      setAnswer(result.answer || "No answer returned.");
    }
    catch(e){
      setAnswer(
        "Unable to contact the ResQAI Assistant. Check that the backend is running."
      );
    }
    finally{
      setLoading(false);
    }
  }

  // function quickAsk(question){
  //   setQ(question);

  //   setTimeout(()=>{
  //     askQuestion(question);
  //   },0);
  // }

  async function askQuestion(question){
    if(!question || loading) return;

    setLoading(true);
    setAnswer("");

    try{
      const result=await api("/ai/query",{
        method:"POST",
        body:JSON.stringify({
          question
        })
      });

      setAnswer(result.answer || "No answer returned.");
    }
    catch(e){
      setAnswer(
        "Unable to contact the ResQAI Assistant. Check that the backend is running."
      );
    }
    finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">

      {/* HEADER */}
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


      {/* MAIN */}
      <div className="flex">

        <aside className="w-56 border-r border-slate-800 min-h-[calc(100vh-4rem)] p-3">

          {nav.map(n=>(
            <button
              key={n}
              onClick={()=>setPage(n)}
              className={`w-full text-left px-3 py-3 rounded-lg mb-1 text-sm ${
                page===n
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

            <br/>

            AI recommendations are decision support only
            and do not replace trained responders.

          </div>

        </aside>


        <main className="flex-1 p-6 max-w-[1600px]">
          {children}
        </main>

      </div>


      {/* RESQAI ASSISTANT */}
      <div className="fixed bottom-4 right-4 w-[380px] z-30">

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


          {/* QUICK QUESTIONS */}

          <div className="flex flex-wrap gap-1 mb-3">

            <button
              onClick={()=>askQuestion(
                "Which incidents require immediate attention?"
              )}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Critical incidents
            </button>

            <button
              onClick={()=>askQuestion(
                "Which ambulances are available?"
              )}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Available ambulances
            </button>

            <button
              onClick={()=>askQuestion(
                "What resources are currently available?"
              )}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Resources
            </button>

            <button
              onClick={()=>askQuestion(
                "What hazards are currently reported?"
              )}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Hazards
            </button>

          </div>


          {/* QUESTION */}

          <div className="flex gap-2">

            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  ask();
                }
              }}
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


          {/* ANSWER */}

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

function Stat({label,value,accent=""}){return <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131d]"><div className="text-xs text-slate-500 uppercase">{label}</div><div className={`text-3xl font-black mt-1 ${accent}`}>{value}</div></div>}

function Command(){
  const [s,setS]=useState(null);
  const [inc,setInc]=useState([]);
  const [resources,setResources]=useState([]);
  const [loading,setLoading]=useState(true);
  const [updated,setUpdated]=useState(null);

  async function load(){
    try{
      const [stats,incidents,resourceData]=await Promise.all([
        api("/dashboard/stats"),
        api("/incidents"),
        api("/resources")
      ]);
      setS(stats);
      setInc(Array.isArray(incidents)?incidents:incidents?.value||[]);
      setResources(Array.isArray(resourceData)?resourceData:resourceData?.value||[]);
      setUpdated(new Date());
    }catch(e){
      console.error("Command Center loading error:",e);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    load();
    const timer=setInterval(load,10000);
    return ()=>clearInterval(timer);
  },[]);

  const available=resources.filter(r=>String(r.status||"").toUpperCase()==="AVAILABLE").length;
  const busy=resources.filter(r=>String(r.status||"").toUpperCase()==="BUSY").length;
  const critical=inc.filter(x=>String(x.priority||"").toUpperCase()==="P1").length;

  return <>
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
      <div>
        <div className="text-[10px] uppercase tracking-[.25em] text-red-400 font-bold">Live Emergency Operations</div>
        <h1 className="text-3xl font-black tracking-tight mt-1">Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Incidents, responder resources and risk intelligence in one operational view.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300">● LIVE SYNC · 10s</div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-bold">Refresh</button>
      </div>
    </div>

    {s&&<div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      <Stat label="Active incidents" value={s.active_incidents}/>
      <Stat label="Critical" value={s.critical_incidents ?? critical} accent="text-red-400"/>
      <Stat label="Available resources" value={s.available_resources ?? available} accent="text-emerald-400"/>
      <Stat label="Deployed" value={s.deployed_resources ?? busy} accent="text-orange-400"/>
      <Stat label="Avg response ETA" value={`${s.avg_response_eta} min`} accent="text-cyan-300"/>
    </div>}

    <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
      <div className="rounded-2xl border border-slate-800 bg-[#0d131d] overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-bold text-sm">Live Response Map</div>
            <div className="text-[11px] text-slate-500">Incidents + all operational resources</div>
          </div>
          <div className="text-[10px] text-slate-500">{updated?`Updated ${updated.toLocaleTimeString()}`:"Loading..."}</div>
        </div>
        <div className="h-[560px]">
          <MapView incidents={inc} resources={resources}/>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0d131d] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold">Response Resources</h2>
            <p className="text-[11px] text-slate-500">Live deployment status</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400">{resources.length} TOTAL</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3"><div className="text-2xl font-black text-emerald-400">{available}</div><div className="text-[10px] text-slate-500 uppercase">Available</div></div>
          <div className="rounded-xl bg-orange-500/5 border border-orange-500/15 p-3"><div className="text-2xl font-black text-orange-400">{busy}</div><div className="text-[10px] text-slate-500 uppercase">Deployed</div></div>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {resources.map(r=>{
            const isBusy=String(r.status||"").toUpperCase()==="BUSY";
            const icon=resourceIcon(r.resource_type);
            return <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 hover:border-slate-700 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-lg">{icon}</div>
                <div className="min-w-0 flex-1"><div className="font-bold text-sm">{r.resource_id}</div><div className="text-[11px] text-slate-500 truncate">{r.resource_type}</div></div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isBusy?"bg-orange-500/10 text-orange-300":"bg-emerald-500/10 text-emerald-300"}`}>{r.status}</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 flex justify-between"><span>Capacity {r.capacity}</span><span>{isBusy&&r.current_incident_id?`INC-${String(r.current_incident_id).padStart(3,"0")}`:"READY"}</span></div>
            </div>;
          })}
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-5 mt-5">
      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-[#0d131d] p-4">
        <div className="flex items-center justify-between mb-2"><h2 className="font-bold">Priority Queue</h2><span className="text-[10px] text-slate-500">TOP {Math.min(7,inc.length)}</span></div>
        {inc.slice(0,7).map(x=><div key={x.id} className="py-3 border-t border-slate-800 flex justify-between gap-3"><div><div className="text-sm font-semibold">INC-{String(x.id).padStart(3,"0")} · {x.incident_type}</div><div className="text-xs text-slate-500">{x.people_affected} affected · {x.status}</div></div><span className={`h-fit px-2 py-1 rounded border text-xs font-bold ${badge[x.priority]}`}>{x.priority} · {x.priority_score}</span></div>)}
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Human verification</div><div className="text-sm text-amber-100 mt-2">AI recommendations are decision support only. Trained responders must verify dispatch decisions.</div></div>
    </div>
  </>;
}


function resourceIcon(type="") {
  const t=String(type).toLowerCase();
  if(t.includes("ambulance")) return "🚑";
  if(t.includes("fire")) return "🚒";
  if(t.includes("police")) return "🚓";
  if(t.includes("rescue")) return "🛟";
  if(t.includes("medical")) return "🩺";
  if(t.includes("disaster")) return "🧑‍🚒";
  return "🚨";
}

function MapView({ incidents = [], resources = [] }) {
  const ref = React.useRef(null);
  const [showIncidents,setShowIncidents]=useState(true);
  const [showResources,setShowResources]=useState(true);

  useEffect(() => {
    let map = null;
    let cancelled=false;

    import("leaflet").then((L) => {
      if (!ref.current || cancelled) return;
      map = L.map(ref.current,{zoomControl:true}).setView([17.003,82.25],13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
      const incidentById={};
      incidents.forEach(i=>{incidentById[i.id]=i;});

      if(showIncidents){
        incidents.forEach((incident) => {
          if (incident.latitude == null || incident.longitude == null) return;
          const markerColor=incident.priority==="P1"?"#ef4444":incident.priority==="P2"?"#f97316":incident.priority==="P3"?"#eab308":"#22c55e";
          L.circleMarker([Number(incident.latitude),Number(incident.longitude)],{radius:incident.priority==="P1"?10:8,color:markerColor,weight:3,fillColor:markerColor,fillOpacity:0.82}).addTo(map).bindPopup(`<div style="min-width:190px"><b style="font-size:14px">INC-${String(incident.id).padStart(3,"0")}</b><br/><span>${incident.incident_type||"Incident"}</span><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>${incident.priority||"P?"} · ${incident.priority_score??"-"}/100</b><br/>${incident.people_affected??0} people affected<br/>Status: ${incident.status||"UNKNOWN"}</div>`);
        });
      }

      if(showResources){
        resources.forEach((resource)=>{
          if(resource.latitude==null || resource.longitude==null) return;
          const busy=String(resource.status||"").toUpperCase()==="BUSY";
          const icon=resourceIcon(resource.resource_type);
          const border=busy?"#f97316":"#22c55e";
          const html=`<div style="width:38px;height:38px;border-radius:12px;background:#0b1220;border:2px solid ${border};box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:20px">${icon}</div>`;
          const marker=L.marker([Number(resource.latitude),Number(resource.longitude)],{icon:L.divIcon({className:"resq-resource-marker",html,iconSize:[38,38],iconAnchor:[19,19],popupAnchor:[0,-19]})}).addTo(map);
          const assignment=resource.current_incident_id?`INC-${String(resource.current_incident_id).padStart(3,"0")}`:"None";
          marker.bindPopup(`<div style="min-width:205px"><b style="font-size:14px">${resource.resource_id}</b><br/><span>${icon} ${resource.resource_type||"Resource"}</span><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>Status: ${resource.status||"UNKNOWN"}</b><br/>Capacity: ${resource.capacity??"-"}<br/>Assignment: ${assignment}<br/><small>${resource.capabilities||"No capability data"}</small></div>`);
          if(busy && resource.current_incident_id && incidentById[resource.current_incident_id]){
            const incident=incidentById[resource.current_incident_id];
            if(incident.latitude!=null && incident.longitude!=null){
              L.polyline([[Number(resource.latitude),Number(resource.longitude)],[Number(incident.latitude),Number(incident.longitude)]],{color:border,weight:2,dashArray:"6 6",opacity:.65}).addTo(map);
            }
          }
        });
      }
    });
    return ()=>{cancelled=true;if(map) map.remove();};
  },[incidents,resources,showIncidents,showResources]);

  return <div className="relative h-full">
    <div ref={ref} className="h-full" />
    <div className="absolute top-3 left-3 z-[1000] flex gap-2">
      <button onClick={()=>setShowIncidents(v=>!v)} className={`px-3 py-2 rounded-xl text-[11px] font-bold border backdrop-blur ${showIncidents?"bg-slate-900/90 border-red-500/40 text-white":"bg-slate-900/80 border-slate-700 text-slate-500"}`}>● Incidents</button>
      <button onClick={()=>setShowResources(v=>!v)} className={`px-3 py-2 rounded-xl text-[11px] font-bold border backdrop-blur ${showResources?"bg-slate-900/90 border-emerald-500/40 text-white":"bg-slate-900/80 border-slate-700 text-slate-500"}`}>🚑 Resources</button>
    </div>
    <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2 text-[10px] text-slate-300 shadow-xl">
      <div className="font-bold text-slate-200 mb-1">LIVE MAP</div>
      <div className="flex gap-3"><span><i className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"/>P1</span><span><i className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1"/>P2</span><span>🟢 Available</span><span>🟠 Busy</span></div>
    </div>
  </div>;
}

function Report({onCreated}){const [d,setD]=useState(""),[loc,setLoc]=useState(""),[lat,setLat]=useState("17.003"),[lon,setLon]=useState("82.250"),[loading,setLoading]=useState(false),[a,setA]=useState(null),[err,setErr]=useState("");
 async function analyze(){setLoading(true);setErr("");try{setA(await api("/incidents/analyze",{method:"POST",body:JSON.stringify({description:d,location:loc,latitude:+lat,longitude:+lon})}))}catch(e){setErr(e.message)}finally{setLoading(false)}}
 async function create(){const x=await api("/incidents",{method:"POST",body:JSON.stringify({description:d,incident_type:a.incident_type,severity:a.severity,severity_score:a.severity_score,priority:a.priority,priority_score:a.priority_score,people_affected:a.people_affected,latitude:+lat,longitude:+lon})});onCreated();setA(null);setD("");alert(`Incident #INC-${String(x.id).padStart(3,"0")} created.`)}
 return <><h1 className="text-2xl font-bold">Report Emergency</h1><p className="text-slate-500 text-sm mb-5">Convert an unstructured report into structured decision support.</p>
 <div className="grid lg:grid-cols-2 gap-5"><div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5"><label className="text-xs text-slate-400">Emergency description</label><textarea value={d} onChange={e=>setD(e.target.value)} rows="8" placeholder="Example: Major road accident near the college. Two injured and one unconscious. Traffic blocked." className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none"/>
 <div className="grid grid-cols-3 gap-2 mt-3"><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Location" className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"/><input value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitude" className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"/><input value={lon} onChange={e=>setLon(e.target.value)} placeholder="Longitude" className="bg-slate-950 border border-slate-700 rounded p-2 text-sm"/></div>
 <button disabled={!d||loading} onClick={analyze} className="mt-4 w-full py-3 rounded-lg bg-red-600 font-bold disabled:opacity-40">{loading?"AI ANALYZING INCIDENT...":"Analyze Emergency"}</button>{err&&<p className="text-red-400 text-xs mt-3">{err}</p>}</div>
 {a?<div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5"><div className="flex items-center justify-between"><span className={`px-3 py-1 rounded border font-black ${badge[a.priority]}`}>{a.priority}</span><span className="text-4xl font-black">{a.priority_score}<small className="text-sm text-slate-500">/100</small></span></div><div className="text-xl font-black mt-5">{a.severity} · {a.incident_type}</div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-slate-500">People affected</span><br/>{a.people_affected}</div><div><span className="text-slate-500">AI confidence</span><br/>{Math.round(a.confidence*100)}%</div></div><div className="mt-4"><div className="text-xs text-slate-500">Required resources</div><div className="flex gap-2 flex-wrap mt-2">{a.required_resources.map(x=><span className="px-2 py-1 bg-slate-800 rounded text-xs">{x}</span>)}</div></div><div className="mt-4"><div className="text-xs text-slate-500">Reasoning</div><ul className="list-disc ml-5 text-sm text-slate-300 mt-2">{a.reasoning.map(x=><li>{x}</li>)}</ul></div><button onClick={create} className="mt-5 w-full py-3 rounded-lg bg-emerald-600 font-bold">Verify & Create Incident</button></div>:<div className="rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-600 p-10">Analysis appears here</div>}</div></>}

function Incidents(){const [xs,setXs]=useState([]); const load=()=>api("/incidents").then(setXs);useEffect(load,[]);async function alloc(id){const r=await api("/resources/allocate",{method:"POST",body:JSON.stringify({incident_id:id})});alert(r.recommendations.length? r.recommendations.map(x=>`${x.resource_id}: ${x.reason}`).join("\n"):"No matching available resource.");load()} return <><h1 className="text-2xl font-bold">Incident Management</h1><div className="mt-5 rounded-xl border border-slate-800 overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-900 text-slate-500 text-xs uppercase"><tr><th className="p-3 text-left">Incident</th><th>Type</th><th>Priority</th><th>Status</th><th>People</th><th></th></tr></thead><tbody>{xs.map(x=><tr key={x.id} className="border-t border-slate-800"><td className="p-3 font-semibold">INC-{String(x.id).padStart(3,"0")}</td><td>{x.incident_type}</td><td><span className={`px-2 py-1 rounded border ${badge[x.priority]}`}>{x.priority} · {x.priority_score}</span></td><td>{x.status}</td><td>{x.people_affected}</td><td><button onClick={()=>alloc(x.id)} className="px-2 py-1 bg-slate-800 rounded text-xs">Allocate</button></td></tr>)}</tbody></table></div></>}

function Resources(){const [rs,setRs]=useState([]);useEffect(()=>{api("/resources").then(setRs)},[]);return <><h1 className="text-2xl font-bold">Resource Management</h1><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">{rs.map(r=><div className="rounded-xl border border-slate-800 bg-[#0d131d] p-4" key={r.id}><div className="flex justify-between"><b>{r.resource_id}</b><span className={`text-xs ${r.status==="AVAILABLE"?"text-emerald-400":"text-orange-400"}`}>{r.status}</span></div><div className="text-sm text-slate-400 mt-2">{r.resource_type}</div><div className="text-xs text-slate-500 mt-2">Capacity {r.capacity} · {r.capabilities}</div>{r.current_incident_id&&<div className="text-xs text-red-300 mt-2">Assigned to INC-{r.current_incident_id}</div>}</div>)}</div></>}

function SafeRoute(){const [origin,setOrigin]=useState("17.000,82.240"),[dest,setDest]=useState("17.010,82.255"),[r,setR]=useState(null),[loading,setLoading]=useState(false);async function go(){setLoading(true);const [a,b]=origin.split(",").map(Number),[c,d]=dest.split(",").map(Number);setR(await api("/routes/recommend",{method:"POST",body:JSON.stringify({origin_lat:a,origin_lon:b,destination_lat:c,destination_lon:d})}));setLoading(false)}return <><h1 className="text-2xl font-bold">SafeRoute</h1><p className="text-slate-500 text-sm">Risk-aware route recommendation; not a guaranteed safest route.</p><div className="mt-5 rounded-xl border border-slate-800 bg-[#0d131d] p-5"><div className="grid md:grid-cols-2 gap-3"><input value={origin} onChange={e=>setOrigin(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-3" placeholder="origin lat,lon"/><input value={dest} onChange={e=>setDest(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-3" placeholder="destination lat,lon"/></div><button onClick={go} className="mt-3 px-5 py-2 rounded bg-red-600">{loading?"Analyzing...":"Recommend Route"}</button>{r&&<div className="mt-5 grid md:grid-cols-2 gap-3">{r.routes.map(x=><div className={`p-4 rounded-xl border ${x.recommended?"border-emerald-500 bg-emerald-500/5":"border-slate-700"}`}><div className="flex justify-between"><b>{x.recommended?"RECOMMENDED":"ALTERNATIVE"}</b><span>Risk {x.risk_score}</span></div><div className="mt-3 text-sm">{x.distance_km} km · {x.duration_min} min</div><div className="text-xs text-slate-500 mt-2">{x.hazards_encountered?.length?x.hazards_encountered.join(", "):"No hazards reported for this route"}</div></div>)}</div>}</div></>}

function Analytics() {
  const [stats, setStats] = useState(null);
  const [datasetStats, setDatasetStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        setStats(operationalStats);
        setDatasetStats(historicalStats);
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

  // ==========================================================
  // LOADING
  // ==========================================================

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

  // ==========================================================
  // ERROR
  // ==========================================================

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
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-sm font-bold"
          >
            Retry
          </button>

        </div>
      </>
    );
  }

  // ==========================================================
  // LIVE OPERATIONAL DATA
  // ==========================================================

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MODERATE: 0,
    LOW: 0
  };

  const typeCounts = {};

  incidents.forEach((incident) => {

    const severity = String(
      incident.severity || "UNKNOWN"
    ).toUpperCase();

    if (
      severityCounts[severity] !== undefined
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

  // ==========================================================
  // RESOURCE DATA
  // ==========================================================

  const availableResources =
    resources.filter(
      (resource) =>
        String(resource.status || "")
          .toUpperCase() === "AVAILABLE"
    ).length;

  const busyResources =
    resources.filter(
      (resource) =>
        String(resource.status || "")
          .toUpperCase() !== "AVAILABLE"
    ).length;

  const totalResources =
    resources.length;

  const utilization =
    Math.round(
      (
        busyResources /
        Math.max(1, totalResources)
      ) * 100
    );

  // ==========================================================
  // HISTORICAL DATASET
  // ==========================================================

  const historicalIncidents =
    datasetStats?.dataset_incidents || 0;

  const historicalHazards =
    datasetStats?.dataset_hazards || 0;

  const severityDistribution =
    datasetStats?.severity_distribution || {};

  const incidentCategories =
    datasetStats?.incident_categories || {};

  // ==========================================================
  // HISTORICAL SEVERITY
  // ==========================================================

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

  // ==========================================================
  // HISTORICAL INCIDENT TYPES
  // ==========================================================

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

  // ==========================================================
  // TOP CATEGORIES
  // ==========================================================

  const topCategories =
    historicalCategoryRows.slice(0, 4);

  // ==========================================================
  // RESOLVED INCIDENTS
  // ==========================================================

  const resolvedIncidents =
    incidents.filter(
      (incident) =>
        String(incident.status || "")
          .toUpperCase() === "RESOLVED"
    ).length;

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <>
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold">
            Analytics
          </h1>

          <p className="text-slate-500 text-sm mt-1">
            Live emergency operations and historical
            emergency intelligence.
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


      {/* ================================================== */}
      {/* LIVE OPERATIONAL KPI */}
      {/* ================================================== */}

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


      {/* ================================================== */}
      {/* HISTORICAL DATASET */}
      {/* ================================================== */}

      <div className="mt-8">

        <div>
          <h2 className="text-lg font-bold">
            Historical Emergency Intelligence
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Historical Kakinada data is separated from
            active emergency operations.
          </p>
        </div>


        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">

          <Stat
            label="Historical incidents"
            value={
              historicalIncidents.toLocaleString()
            }
          />

          <Stat
            label="Historical hazards"
            value={
              historicalHazards.toLocaleString()
            }
          />

          <Stat
            label="Critical historical"
            value={
              (
                severityDistribution.Critical ||
                0
              ).toLocaleString()
            }
            accent="text-red-400"
          />

          <Stat
            label="High severity"
            value={
              (
                severityDistribution.High ||
                0
              ).toLocaleString()
            }
            accent="text-orange-400"
          />

        </div>

      </div>


      {/* ================================================== */}
      {/* HISTORICAL SEVERITY + CATEGORIES */}
      {/* ================================================== */}

      <div className="grid lg:grid-cols-2 gap-5 mt-5">

        {/* ---------------------------------------------- */}
        {/* SEVERITY */}
        {/* ---------------------------------------------- */}

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
                        className={textClass}
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


        {/* ---------------------------------------------- */}
        {/* INCIDENT CATEGORIES */}
        {/* ---------------------------------------------- */}

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


      {/* ================================================== */}
      {/* TOP HISTORICAL INCIDENT TYPES */}
      {/* ================================================== */}

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


      {/* ================================================== */}
      {/* LIVE OPERATIONAL STATUS */}
      {/* ================================================== */}

      <div className="grid lg:grid-cols-3 gap-4 mt-5">

        {/* SYSTEM */}

        <div className="rounded-xl border border-slate-800 bg-[#0d131d] p-5">

          <div className="text-xs text-slate-500 uppercase">
            Operational status
          </div>

          <div className="flex items-center gap-2 mt-3">

            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>

            <span className="font-bold">
              SYSTEM OPERATIONAL
            </span>

          </div>

          <p className="text-sm text-slate-500 mt-3">
            ResQAI APIs are providing live incident,
            resource and historical dataset intelligence.
          </p>

        </div>


        {/* RESOURCE */}

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


        {/* INCIDENT LOAD */}

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


      {/* ================================================== */}
      {/* RESOURCE UTILIZATION */}
      {/* ================================================== */}

      <div className="mt-5 rounded-xl border border-slate-800 bg-[#0d131d] p-5">

        <div className="flex justify-between items-center">

          <div>

            <h2 className="font-bold">
              Resource Utilization
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Current deployment pressure across
              response resources.
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


      {/* ================================================== */}
      {/* AI / DATA NOTICE */}
      {/* ================================================== */}

      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">

        <div className="text-xs text-amber-400 font-bold uppercase">
          Decision-support notice
        </div>

        <p className="text-sm text-amber-100/80 mt-2">
          Historical records are used for analytics and
          future model development. They are not treated
          as active emergency incidents. Live AI
          recommendations remain decision-support only
          and require trained human verification.
        </p>

      </div>

    </>
  );
}
function Landing({go}){return <div className="min-h-[80vh] flex items-center"><div className="max-w-3xl"><div className="text-red-400 font-bold tracking-[.25em] text-xs">EMERGENCY OPERATIONS INTELLIGENCE</div><h1 className="text-6xl font-black tracking-tight mt-4">From Emergency Reports to <span className="text-red-400">Intelligent Response Decisions.</span></h1><p className="text-lg text-slate-400 mt-6 max-w-2xl">ResQAI converts unstructured emergency reports into explainable priority scores, resource recommendations, and risk-aware route decisions for human verification.</p><button onClick={go} className="mt-8 px-6 py-3 rounded-lg bg-red-600 font-bold">Open Command Center →</button><div className="grid md:grid-cols-3 gap-3 mt-12">{["AI incident understanding","Explainable priority engine","Risk-aware routing"].map(x=><div className="p-4 rounded-xl border border-slate-800 bg-[#0d131d] text-sm">{x}</div>)}</div></div></div>}

function App(){const [page,setPage]=useState("Landing"); const content=page==="Landing"?<Landing go={()=>setPage("Command Center")}/>:page==="Command Center"?<Command/>:page==="Report Emergency"?<Report onCreated={()=>setPage("Incidents")}/>:page==="Incidents"?<Incidents/>:page==="Resources"?<Resources/>:page==="SafeRoute"?<SafeRoute/>:<Analytics/>;return page==="Landing"?<div className="p-8">{content}</div>:<Shell page={page} setPage={setPage}>{content}</Shell>}
createRoot(document.getElementById("root")).render(<App/>)
