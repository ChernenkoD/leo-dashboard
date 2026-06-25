// mangel.js v10 — Linear-style Mängel-Management

let MAENGEL = [];
let ARCHIV_MAENGEL = [];
let PEOPLE = { managers: [], technicians: [] };

let mfSearch = "";
let mfBauleiter = "";
let mfStadt = "";
let mfStatus = "";
let mfFaellig = "";
let mfManager = "";
let mfTechniker = "";
let mfNeu = false;
let mfSort = "faellig";
let currentView = "list";
let showTab = "active";
let expandedRows = new Set();

const REPO = "ChernenkoD/leo-dashboard";
const ASSIGNMENTS_FILE = "assignments.json";

(function injectCSS() {
  const s = document.createElement("style");
  s.textContent = `
    :root { --mk-radius: 8px; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }

    .mk-kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:16px; }
    @media(max-width:900px){ .mk-kpi-row{ grid-template-columns:repeat(3,1fr); } }
    .mk-kpi { background:var(--panel); border:1px solid var(--border); border-radius:var(--mk-radius); padding:14px 16px 12px; border-top:3px solid transparent; transition:box-shadow .15s; }
    .mk-kpi:hover { box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .mk-kpi-val   { font-size:30px; font-weight:800; line-height:1.1; }
    .mk-kpi-label { font-size:10px; font-weight:600; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:.06em; }
    .mk-kpi-sub   { font-size:11px; color:var(--accent); margin-top:1px; }
    .mk-kpi--red    { border-top-color:#ef4444; }
    .mk-kpi--orange { border-top-color:#f97316; }
    .mk-kpi--blue   { border-top-color:#3b82f6; }
    .mk-kpi--green  { border-top-color:#22c55e; }

    .mk-filterbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; background:var(--panel); border:1px solid var(--border); border-radius:var(--mk-radius); padding:8px 12px; margin-bottom:8px; }
    .mk-filter-left  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1; }
    .mk-filter-right { display:flex; align-items:center; gap:6px; flex-shrink:0; flex-wrap:wrap; }

    .mk-search-wrap { position:relative; }
    .mk-search { padding:5px 10px 5px 30px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:var(--bg); color:var(--text); width:160px; transition:border-color .15s, width .2s; }
    .mk-search:focus { outline:none; border-color:var(--accent); width:200px; }

    .mk-select { padding:5px 28px 5px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; background:var(--bg); color:var(--text); cursor:pointer; appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; transition:border-color .15s; }
    .mk-select:focus { outline:none; border-color:var(--accent); }
    .mk-select.mk-active { border-color:var(--accent); background-color:color-mix(in srgb,var(--accent) 8%,var(--bg)); color:var(--accent); font-weight:600; }

    .mk-neu-label { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--muted); cursor:pointer; white-space:nowrap; padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--bg); transition:border-color .15s; }
    .mk-neu-label.mk-active { border-color:var(--accent); background-color:color-mix(in srgb,var(--accent) 8%,var(--bg)); color:var(--accent); font-weight:600; }

    .mk-view-toggle { display:flex; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
    .mk-view-btn { padding:5px 9px; background:var(--bg); border:none; cursor:pointer; color:var(--muted); transition:background .12s,color .12s; display:flex; align-items:center; }
    .mk-view-btn.active { background:var(--accent); color:#fff; }
    .mk-view-btn:not(.active):hover { background:var(--border); }

    .mk-tabs { display:flex; gap:2px; }
    .mk-tab { padding:5px 12px; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--muted); cursor:pointer; font-size:12px; transition:background .12s,color .12s,border-color .12s; }
    .mk-tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }
    .mk-tab:not(.active):hover { border-color:var(--accent); color:var(--accent); }

    .mk-reset { padding:5px 10px; border:1px solid #ef4444; border-radius:6px; background:none; color:#ef4444; cursor:pointer; font-size:12px; }

    .mk-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
    .mk-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; background:color-mix(in srgb,var(--accent) 12%,var(--bg)); color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 30%,transparent); transition:background .12s; }
    .mk-chip:hover { background:color-mix(in srgb,var(--accent) 20%,var(--bg)); }

    .neu-heute-bar { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg,#fef9c3,#fef3c7); border:1px solid #fde68a; border-radius:var(--mk-radius); padding:10px 16px; margin-bottom:12px; font-size:13px; font-weight:700; color:#92400e; }

    .mk-table-wrap { overflow-x:auto; }
    .mk-table { width:100%; border-collapse:collapse; font-size:13px; }
    .mk-table thead th { padding:7px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); border-bottom:2px solid var(--border); background:var(--bg); position:sticky; top:0; z-index:1; white-space:nowrap; }
    .mk-row { border-left:3px solid transparent; cursor:pointer; transition:background .1s; }
    .mk-row:hover { background:color-mix(in srgb,var(--accent) 4%,transparent); }
    .mk-row td { padding:9px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
    .mk-row--red    { border-left-color:#ef4444; }
    .mk-row--orange { border-left-color:#f97316; }
    .mk-row--yellow { border-left-color:#eab308; }
    .mk-row--green  { border-left-color:#22c55e; }
    .mk-row--gray   { border-left-color:var(--border); }

    .mk-deadline { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:800; white-space:nowrap; }

    .mk-expand-td { background:var(--bg) !important; padding:0 !important; }
    .mk-expand-inner { padding:16px 20px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media(max-width:700px){ .mk-expand-inner{ grid-template-columns:1fr; } }

    .mk-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
    .mk-card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; border-left:4px solid transparent; transition:box-shadow .15s,transform .15s; animation:fadeIn .2s ease; }
    .mk-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.1); transform:translateY(-1px); }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

    .mk-badge { display:inline-block; border-radius:5px; padding:2px 7px; font-size:11px; font-weight:700; white-space:nowrap; }
    .mk-badge--offen    { background:#fee2e2; color:#b91c1c; }
    .mk-badge--behoben  { background:#fef9c3; color:#854d0e; }
    .mk-badge--geprueft { background:#dcfce7; color:#166534; }
    .mk-badge--blue     { background:#dbeafe; color:#1d4ed8; }
    .mk-badge--green    { background:#dcfce7; color:#166534; }
    .mk-badge--gray     { background:var(--bg); color:var(--muted); }
    .mk-badge--assign   { background:#f3f4f6; color:#374151; }
    .mk-badge--pos      { background:#eef2ff; color:#3730a3; }
    .mk-badge--new      { background:#fef9c3; color:#854d0e; }

    .pos-list { display:flex; flex-direction:column; gap:4px; margin-top:8px; }
    .pos-item { display:flex; align-items:flex-start; gap:8px; padding:8px 10px; background:var(--bg); border:1px solid var(--border); border-radius:6px; cursor:default; }
    .pos-item-done { opacity:.65; }
    .pos-item input[type=checkbox] { margin-top:2px; flex-shrink:0; cursor:pointer; }
    .pos-info { flex:1; min-width:0; }
    .pos-code { font-size:11px; color:var(--muted); display:block; }
    .pos-leistung { font-size:12px; color:var(--muted); display:block; }
    .pos-desc { font-size:12px; font-weight:600; color:var(--text); overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
    .pos-gewerk { font-size:11px; color:var(--accent); }
    .pos-desc-row { margin-top:2px; }
    .trans-btns { display:inline-flex; gap:4px; margin-left:6px; vertical-align:middle; }
    .btn-translate { font-size:11px; padding:1px 5px; border:1px solid var(--border); border-radius:4px; background:var(--bg); cursor:pointer; color:var(--muted); }
    .btn-translate:hover { border-color:var(--accent); color:var(--accent); }
    .trans-box { margin-top:4px; padding:6px 8px; background:var(--panel); border-radius:4px; font-size:12px; }
    .btn-copy-trans { font-size:11px; padding:2px 8px; border:1px solid var(--border); border-radius:4px; cursor:pointer; background:var(--bg); color:var(--muted); margin-top:4px; }
    .pos-badge { font-size:10px; flex-shrink:0; padding:2px 6px; border-radius:4px; background:var(--bg); color:var(--muted); white-space:nowrap; max-width:90px; overflow:hidden; text-overflow:ellipsis; }
    .pos-open     { background:#fee2e2; color:#b91c1c; }
    .pos-behoben  { background:#fef9c3; color:#854d0e; }
    .pos-done     { background:#dcfce7; color:#166534; }
    .pos-rejected { background:#f3f4f6; color:#6b7280; }

    .progress-wrap  { display:flex; align-items:center; gap:8px; margin:6px 0; }
    .progress-bar   { flex:1; height:4px; background:var(--border); border-radius:2px; overflow:hidden; }
    .progress-fill  { height:100%; background:#10b981; border-radius:2px; transition:width .3s; }
    .progress-label { font-size:11px; color:var(--muted); white-space:nowrap; }

    .assign-panel   { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid var(--border); }
    .assign-select  { padding:4px 8px; border:1px solid var(--border); border-radius:6px; font-size:12px; background:var(--bg); color:var(--text); flex:1; min-width:100px; }
    .btn-senden     { padding:5px 12px; background:var(--accent); color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:600; }
    .btn-senden:disabled { opacity:.4; cursor:not-allowed; }
    .mk-photos-row  { margin:8px 0 4px; min-height:0; }
    .mk-photo-grid  { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .mk-photo-thumb { width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid var(--border); cursor:zoom-in; transition:transform .15s; }
    .mk-photo-thumb:hover { transform:scale(1.06); box-shadow:0 4px 12px rgba(0,0,0,.2); }
    .btn-fertig     { padding:4px 10px; background:#10b981; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; }
    .assign-sent    { font-size:11px; color:var(--muted); }
    .assign-fertig  { color:#10b981; font-weight:700; }

    .mk-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:56px; color:var(--muted); gap:10px; }
    .mk-empty-icon { font-size:40px; opacity:.25; }
    .mk-empty-text { font-size:14px; }

    @media print { .mk-filterbar, #sidebar-mount, .topbar, .mk-kpi-row { display:none!important; } }
  `;
  document.head.appendChild(s);
})();

async function saveAssignmentToGitHub(mangelId) {
  const token = localStorage.getItem("github_pat");
  if (!token) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`, { headers:{ Authorization:`token ${token}`, Accept:"application/vnd.github.v3+json" } });
    const curr = await r.json();
    const all = {};
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(key?.startsWith("assign_")) { try{ const id=key.slice(7); const a=JSON.parse(localStorage.getItem(key)); const mgr=(PEOPLE.managers||[]).find(p=>p.id===a.manager); const tech=(PEOPLE.technicians||[]).find(p=>p.id===a.technician); if(mgr) a.manager_name=mgr.name; if(tech) a.technician_name=tech.name; all[id]=a; }catch{} }
    }
    const content=btoa(unescape(encodeURIComponent(JSON.stringify({assignments:all},null,2))));
    await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`,{ method:"PUT", headers:{ Authorization:`token ${token}`, "Content-Type":"application/json", Accept:"application/vnd.github.v3+json" }, body:JSON.stringify({ message:`Update assignment ${mangelId}`, content, sha:curr.sha }) });
  } catch(e) { console.error("GitHub sync:",e); }
}

function parseDate(str) { if(!str)return null; const[d,m,y]=str.split("."); return(d&&m&&y)?new Date(+y,+m-1,+d):null; }
function fmtDate(str) { const dt=parseDate(str); return dt?dt.toLocaleDateString("ru-RU"):"—"; }
function today0() { const d=new Date(); d.setHours(0,0,0,0); return d; }
function daysUntil(str) { const dt=parseDate(str); if(!dt)return null; return Math.round((dt-today0())/86400000); }
function cityOf(m) { const a=(m.address||"").split(","); const last=a[a.length-1]?.trim()||""; return last.replace(/^\d{4,5}\s*/,"").trim()||""; }
function isNewRecent(m) { if(!m.first_seen)return false; const s=new Date(today0()); s.setDate(s.getDate()-7); return new Date(m.first_seen)>=s; }
function isNewToday(m) { if(!m.first_seen)return false; return new Date(m.first_seen)>=today0(); }

async function loadPeople() {
  const local=localStorage.getItem("people_config");
  if(local){try{PEOPLE=JSON.parse(local);return;}catch{}}
  try{const r=await fetch("people.json?"+Date.now());PEOPLE=await r.json();}catch{}
}
function getAssignment(id) { try{ const r=localStorage.getItem("assign_"+id); return r?JSON.parse(r):{manager:"",technician:"",sentAt:null,date_started:null,date_finished:null}; }catch{ return{manager:"",technician:"",sentAt:null,date_started:null,date_finished:null}; } }
function saveAssignment(id,obj){ localStorage.setItem("assign_"+id,JSON.stringify(obj)); }
function isAutoChecked(status){ return status&&status.toLowerCase().includes("geprüft"); }
function isChecked(id,idx,status){ if(isAutoChecked(status))return true; return localStorage.getItem(`chk_${id}_${idx}`)==="1"; }
function setChecked(id,idx,val){ if(val)localStorage.setItem(`chk_${id}_${idx}`,"1"); else localStorage.removeItem(`chk_${id}_${idx}`); }
function checkedCount(m){ const pos=m.positionen||[]; if(!pos.length)return{done:0,total:m.anzahl||0}; return{done:pos.filter((p,i)=>isChecked(m.id,i,p.status)).length,total:pos.length}; }
function mangelStatusGroup(m){ const pos=m.positionen||[]; if(!pos.length)return"offen"; const ss=pos.map(p=>(p.status||"").toLowerCase()); if(ss.every(s=>s.includes("geprüft")))return"geprueft"; if(ss.some(s=>s.includes("behoben")))return"behoben"; return"offen"; }

function statusBadge(ms){ const map={offen:["--offen","🔴 Offen"],behoben:["--behoben","🟡 Behoben"],geprueft:["--geprueft","✅ Geprüft"]}; const[cls,label]=map[ms]||["--gray",ms||"—"]; return`<span class="mk-badge mk-badge${cls}">${label}</span>`; }
function workflowBadge(id){ const a=getAssignment(id); if(a.date_finished)return`<span class="mk-badge mk-badge--green">✓ Fertig ${a.date_finished}</span>`; if(a.sentAt){const tech=(PEOPLE.technicians||[]).find(p=>p.id===a.technician); return`<span class="mk-badge mk-badge--blue">🔵 ${tech?tech.name.split(" ")[0]:"In Arbeit"}</span>`;} if(a.manager||a.technician){const tech=(PEOPLE.technicians||[]).find(p=>p.id===a.technician); return`<span class="mk-badge mk-badge--assign">👤 ${tech?tech.name.split(" ")[0]:"Zugewiesen"}</span>`;} return""; }
function deadlineRowClass(m){ const d=daysUntil(m.fertigstellung); if(d===null)return"mk-row--gray"; if(d<0||d<=3)return"mk-row--red"; if(d<=7)return"mk-row--orange"; if(d<=14)return"mk-row--yellow"; return"mk-row--green"; }
function deadlinePill(m){ const d=daysUntil(m.fertigstellung); if(d===null)return`<span class="mk-deadline" style="background:var(--bg);color:var(--muted)">—</span>`; if(d<0)return`<span class="mk-deadline" style="background:#fee2e2;color:#b91c1c">${Math.abs(d)}d !</span>`; if(d===0)return`<span class="mk-deadline" style="background:#fee2e2;color:#b91c1c">Heute</span>`; if(d<=3)return`<span class="mk-deadline" style="background:#fee2e2;color:#b91c1c">${d}d</span>`; if(d<=7)return`<span class="mk-deadline" style="background:#ffedd5;color:#c2410c">${d}d</span>`; if(d<=14)return`<span class="mk-deadline" style="background:#fef9c3;color:#854d0e">${d}d</span>`; return`<span class="mk-deadline" style="background:#dcfce7;color:#166534">${d}d</span>`; }
function borderColor(m){ const d=daysUntil(m.fertigstellung); if(m.mangel_status==="geprueft")return"#22c55e"; if(d!==null&&d<0)return"#ef4444"; if(d!==null&&d<=7)return"#f97316"; return"#6b7280"; }
function statusClass(s){ if(!s)return""; const l=s.toLowerCase(); if(l.includes("geprüft"))return"pos-done"; if(l.includes("behoben"))return"pos-behoben"; if(l.includes("angenommen"))return"pos-open"; if(l.includes("abgelehnt"))return"pos-rejected"; return""; }

async function translatePos(id,idx,text,lang){
  const box=document.getElementById(`trans-${id}-${idx}`); if(!box)return;
  if(box.style.display!=="none"&&box.dataset.lang===lang){box.style.display="none";box.dataset.lang="";return;}
  box.innerHTML=`<span style="color:var(--muted);font-size:12px">⏳…</span>`; box.style.display="block"; box.dataset.lang=lang;
  const src=lang==="ru"?"de":"ru";
  try{ const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`); const data=await r.json(); const tr=data[0].map(s=>s[0]).join(""); const flag=lang==="ru"?"🇷🇺":"🇩🇪"; const esc=tr.replace(/\\/g,"\\\\").replace(/'/g,"\\'"); box.innerHTML=`<div style="font-size:12px;color:var(--text)">${flag} ${tr}</div><button class="btn-copy-trans" onclick="navigator.clipboard.writeText('${esc}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1500)})">📋</button>`; }catch(e){ box.innerHTML=`<span style="color:#dc2626;font-size:11px">Fehler</span>`; }
}

function renderPositionen(m){
  const pos=m.positionen||[];
  if(!pos.length){ const n=m.anzahl||0; if(!n)return""; return`<div class="pos-list">${Array.from({length:n},(_,i)=>`<label class="pos-item" onclick="event.stopPropagation()"><input type="checkbox" ${isChecked(m.id,i)?"checked":""} onchange="toggleCheck('${m.id}',${i},this.checked)"><span class="pos-code">Position ${i+1}</span></label>`).join("")}</div>`; }
  return`<div class="pos-list">${pos.map((p,i)=>{ const auto=isAutoChecked(p.status); const chk=isChecked(m.id,i,p.status); const desc=(p.mangel_beschreibung||p.leistung||"").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); return`<label class="pos-item ${chk?"pos-item-done":""}" onclick="event.stopPropagation()"><input type="checkbox" ${chk?"checked":""} ${auto?"disabled":""} onchange="toggleCheck('${m.id}',${i},this.checked)"><div class="pos-info"><span class="pos-code">${p.code||""} · ${p.gewerk||""}</span>${p.leistung?`<span class="pos-leistung">${p.leistung}</span>`:""}${p.mangel_beschreibung?`<div class="pos-desc-row"><span class="pos-desc">${p.mangel_beschreibung}</span><span class="trans-btns"><button class="btn-translate" onclick="event.stopPropagation();translatePos('${m.id}',${i},'${desc}','ru')">DE→RU</button><button class="btn-translate" onclick="event.stopPropagation();translatePos('${m.id}',${i},'${desc}','de')">RU→DE</button></span></div>`:""}${p.bereich?`<span class="pos-gewerk">${p.bereich}</span>`:""}<div id="trans-${m.id}-${i}" class="trans-box" style="display:none"></div></div>${p.status?`<span class="pos-badge ${statusClass(p.status)}" title="${p.status}">${p.status.length>12?p.status.substring(0,12)+"…":p.status}</span>`:""}</label>`; }).join("")}</div>`;
}
function renderProgress(m){ const{done,total}=checkedCount(m); if(!total)return""; const pct=Math.round((done/total)*100); return`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-label">${done}/${total}</span></div>`; }

function renderAssignPanel(m){
  const a=getAssignment(m.id); const mgrs=PEOPLE.managers||[]; const techs=PEOPLE.technicians||[];
  const mO=`<option value="">— Manager —</option>`+mgrs.map(p=>`<option value="${p.id}" ${a.manager===p.id?"selected":""}>${p.name}</option>`).join("");
  const tO=`<option value="">— Techniker —</option>`+techs.map(p=>`<option value="${p.id}" ${a.technician===p.id?"selected":""}>${p.name}</option>`).join("");
  let extra="";
  if(a.date_finished) extra=`<span class="assign-sent assign-fertig">✓ Fertig: ${a.date_finished}</span>`;
  else if(a.sentAt){ const d=new Date(a.sentAt).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); extra=`<span class="assign-sent">✓ In Arbeit ${d}</span><button class="btn-fertig" onclick="markFertig('${m.id}')">✓ Fertig</button>`; }
  return`<div class="assign-panel" onclick="event.stopPropagation()"><select class="assign-select" onchange="onAssignChange('${m.id}','manager',this.value)">${mO}</select><select class="assign-select" onchange="onAssignChange('${m.id}','technician',this.value)">${tO}</select><button class="btn-senden" onclick="sendInArbeit('${m.id}')" ${a.technician?"":"disabled"}>✈ In Arbeit</button>${extra}</div>`;
}
function onAssignChange(id,field,val){ const a=getAssignment(id); a[field]=val; saveAssignment(id,a); render(); }
function markFertig(id){ const t=new Date().toISOString().slice(0,10); const input=prompt("Datum Fertigstellung (JJJJ-MM-TT):",t); if(!input)return; const a=getAssignment(id); a.date_finished=input; saveAssignment(id,a); saveAssignmentToGitHub(id); render(); }
async function sendInArbeit(id) {
  const m = MAENGEL.find(x => x.id === id); if (!m) return;
  const a = getAssignment(id);
  const tech = (PEOPLE.technicians||[]).find(p => p.id === a.technician);
  const mgr  = (PEOPLE.managers  ||[]).find(p => p.id === a.manager);
  const positions = (m.positionen||[]).map((p,i) =>
    `${i+1}. ${p.code||""} ${p.gewerk||""}: ${p.mangel_beschreibung||p.leistung||"—"}`
  ).join("\n");
  const fullMsg = [
    `⚠️ *Neuer Mängelauftrag*`, `📋 ${m.id}`, `📍 ${m.address||"—"}`,
    m.lage ? `🏠 ${m.lage}` : null,
    `📅 Termin: ${fmtDate(m.fertigstellung)}`,
    `👔 Manager: ${mgr?mgr.name:"—"}`, `🔧 Techniker: ${tech?tech.name:"—"}`,
    ``, positions||"Keine Positionen", ``,
    m.leo_url ? `🔗 ${m.leo_url}` : null,
    ``, `📸 _Fotos nach Fertigstellung in den Telegram-Thread hochladen!_`
  ].filter(x=>x!==null).join("\n");

  const TG_TOKEN = "8965752014:AAHmLt64ORP4ijB7UACg2Zo50_m0W3f6BvI";
  const TG_GROUP = "-1004348117970";

  // 1. Уведомление в групповой тред
  try {
    const topics = await fetch(
      "https://raw.githubusercontent.com/ChernenkoD/leo-dashboard/main/scraper/telegram_topics.json?t="+Date.now()
    ).then(r=>r.ok?r.json():{}).catch(()=>({}));
    const threadId = topics[m.id];
    const p = new URLSearchParams({
      chat_id: TG_GROUP,
      text: `✈️ *In Arbeit gesetzt*\n👔 ${mgr?mgr.name:"—"}\n🔧 ${tech?tech.name:"—"}\n📅 ${new Date().toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`,
      parse_mode: "Markdown",
    });
    if (threadId) p.append("message_thread_id", threadId);
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {method:"POST", body:p});
  } catch(e) { console.warn("Telegram group notify:", e); }

  // 2. Личное сообщение технику (если задан telegram_id)
  if (tech?.telegram_id) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST",
        body: new URLSearchParams({ chat_id: tech.telegram_id, text: fullMsg, parse_mode: "Markdown" })
      });
    } catch(e) { console.warn("Telegram personal:", e); }
  }

  navigator.clipboard.writeText(fullMsg).catch(()=>{});
  a.sentAt = new Date().toISOString(); a.date_started = new Date().toISOString().slice(0,10);
  saveAssignment(id, a); saveAssignmentToGitHub(id); render();
  alert(`✈️ Отправлено в Telegram!\nТехник: ${tech?.name||"?"}`);
}
function toggleCheck(id,idx,val){ setChecked(id,idx,val); render(); }

function renderKPI(){
  const now=today0(); const all=MAENGEL;
  const ueb=all.filter(m=>{const d=parseDate(m.fertigstellung);return d&&d<now&&m.mangel_status!=="geprueft";}).length;
  const le7=all.filter(m=>{const d=daysUntil(m.fertigstellung);return d!==null&&d>=0&&d<=7&&m.mangel_status!=="geprueft";}).length;
  const s7=new Date(now); s7.setDate(now.getDate()-7);
  const neuW=all.filter(m=>m.first_seen&&new Date(m.first_seen)>=s7).length;
  const gep=all.filter(m=>m.mangel_status==="geprueft").length;
  document.getElementById("mangelKPI").innerHTML=[
    {val:all.length,label:"Gesamt Mängel",  sub:"aktiv",                 cls:"",        clr:""},
    {val:ueb,       label:"Überfällig",      sub:"Deadline überschritten",cls:"--red",   clr:"color:#b91c1c"},
    {val:le7,       label:"Fällig ≤7 Tage", sub:"dringend",              cls:"--orange",clr:"color:#d97706"},
    {val:neuW,      label:"Neu diese Woche", sub:"first_seen <7d",        cls:"--blue",  clr:"color:#2563eb"},
    {val:gep,       label:"Geprüft",         sub:"abgeschlossen",         cls:"--green", clr:"color:#16a34a"},
  ].map(k=>`<div class="mk-kpi mk-kpi${k.cls}"><div class="mk-kpi-val" style="${k.clr}">${k.val}</div><div class="mk-kpi-label">${k.label}</div><div class="mk-kpi-sub">${k.sub}</div></div>`).join("");
}

function renderChips(){
  const chips=[];
  const add=(label,fn)=>chips.push({label,fn});
  if(mfSearch)    add(`Suche: "${mfSearch}"`,    ()=>{mfSearch="";    document.getElementById("mfSearch").value=""; render();});
  if(mfBauleiter) add(`BL: ${mfBauleiter}`,       ()=>{mfBauleiter=""; document.getElementById("mfBauleiter").value=""; render();});
  if(mfStadt)     add(`Stadt: ${mfStadt}`,         ()=>{mfStadt="";     document.getElementById("mfStadt").value=""; render();});
  if(mfStatus)    add(`Status: ${mfStatus}`,       ()=>{mfStatus="";    document.getElementById("mfStatus").value=""; render();});
  if(mfFaellig)   add(`Fälligkeit: ${mfFaellig}`,  ()=>{mfFaellig="";   document.getElementById("mfFaellig").value=""; render();});
  if(mfManager)   add(`Manager: ${mfManager}`,     ()=>{mfManager="";   document.getElementById("mfManager").value=""; render();});
  if(mfTechniker) add(`Tech: ${mfTechniker}`,      ()=>{mfTechniker=""; document.getElementById("mfTechniker").value=""; render();});
  if(mfNeu)       add("Neu ≤7d",                   ()=>{mfNeu=false;    document.getElementById("mfNeu").checked=false; render();});
  const el=document.getElementById("mkChips");
  el.innerHTML=chips.map((c,i)=>`<button class="mk-chip" onclick="window._cc[${i}]()">${c.label} <span style="opacity:.6">×</span></button>`).join("");
  window._cc=chips.map(c=>c.fn);
  const rb=document.getElementById("mkResetBtn"); if(rb) rb.style.display=chips.length?"":"none";
  ["mfBauleiter","mfStadt","mfStatus","mfFaellig","mfManager","mfTechniker"].forEach(id=>{
    const el2=document.getElementById(id); if(!el2)return;
    const v={mfBauleiter:mfBauleiter,mfStadt:mfStadt,mfStatus:mfStatus,mfFaellig:mfFaellig,mfManager:mfManager,mfTechniker:mfTechniker}[id];
    el2.classList.toggle("mk-active",!!v);
  });
  const nl=document.querySelector(".mk-neu-label"); if(nl) nl.classList.toggle("mk-active",mfNeu);
}

function getBase(){ if(showTab==="leo")return ARCHIV_MAENGEL; if(showTab==="geprueft")return MAENGEL.filter(m=>m.mangel_status==="geprueft"); return MAENGEL.filter(m=>m.mangel_status!=="geprueft"); }
function applyFilters(list){
  return list.filter(m=>{
    if(mfSearch){ const q=mfSearch.toLowerCase(); if(!`${m.id||""} ${m.address||""} ${m.bauleiter||""} ${m.lage||""}`.toLowerCase().includes(q))return false; }
    if(mfBauleiter&&m.bauleiter!==mfBauleiter)return false;
    if(mfStadt&&cityOf(m)!==mfStadt)return false;
    if(mfStatus==="in_arbeit"){ const a=getAssignment(m.id); if(!a.sentAt||a.date_finished)return false; }
    else if(mfStatus==="fertig"){ if(!getAssignment(m.id).date_finished)return false; }
    else if(mfStatus){ if(mangelStatusGroup(m)!==mfStatus&&m.mangel_status!==mfStatus)return false; }
    if(mfManager){ const a=getAssignment(m.id); const mgr=(PEOPLE.managers||[]).find(p=>p.id===a.manager); if(!mgr||mgr.name!==mfManager)return false; }
    if(mfTechniker){ const a=getAssignment(m.id); const tech=(PEOPLE.technicians||[]).find(p=>p.id===a.technician); if(!tech||tech.name!==mfTechniker)return false; }
    if(mfNeu&&!isNewRecent(m))return false;
    if(mfFaellig){ const d=daysUntil(m.fertigstellung); const p=m.mangel_status==="geprueft";
      if(mfFaellig==="ueberfaellig"&&(d===null||d>=0||p))return false;
      if(mfFaellig==="le3"&&(d===null||d<0||d>3))return false;
      if(mfFaellig==="le7"&&(d===null||d<0||d>7))return false;
      if(mfFaellig==="le14"&&(d===null||d<0||d>14))return false;
      if(mfFaellig==="gt14"&&(d===null||d<=14))return false;
    }
    return true;
  });
}
function sortList(list){ const copy=[...list]; if(mfSort==="faellig")copy.sort((a,b)=>(daysUntil(a.fertigstellung)??9999)-(daysUntil(b.fertigstellung)??9999)); else if(mfSort==="newest")copy.sort((a,b)=>(b.first_seen||"").localeCompare(a.first_seen||"")); else if(mfSort==="oldest")copy.sort((a,b)=>(a.first_seen||"").localeCompare(b.first_seen||"")); else if(mfSort==="address")copy.sort((a,b)=>(a.address||"").localeCompare(b.address||"","de")); else if(mfSort==="deadline_desc")copy.sort((a,b)=>(daysUntil(b.fertigstellung)??-9999)-(daysUntil(a.fertigstellung)??-9999)); return copy; }

function renderListView(list){
  if(!list.length)return`<div class="mk-empty"><div class="mk-empty-icon">📋</div><div class="mk-empty-text">Keine Mängel gefunden</div></div>`;
  const rows=list.map(m=>{
    const isArch=m.is_archiv; const rowCls=isArch?"mk-row--gray":deadlineRowClass(m); const posCount=(m.positionen||[]).length; const exp=expandedRows.has(m.id);
    return`<tr class="mk-row ${rowCls}" onclick="toggleRow('${m.id}')">
      <td style="width:72px">${isArch?`<span class="mk-badge mk-badge--gray">Archiv</span>`:deadlinePill(m)}</td>
      <td><div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${m.address||"—"}</div><div style="font-size:11px;color:var(--muted)">${m.id||""} ${m.lage?"· "+m.lage:""}</div></td>
      <td style="font-size:12px;white-space:nowrap">${m.bauleiter||"—"}</td>
      <td style="white-space:nowrap">${statusBadge(m.mangel_status)} ${workflowBadge(m.id)}</td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${m.ausfuehrungsbeginn||"—"}<br>→ ${m.fertigstellung||"—"}</td>
      <td style="text-align:center">${posCount?`<span class="mk-badge mk-badge--pos">${posCount}P</span>`:""}</td>
      <td style="font-size:11px;color:var(--muted)">${m.first_seen||""}</td>
      <td><a href="${m.leo_url||"#"}" target="_blank" style="color:var(--accent);font-size:13px;font-weight:700;text-decoration:none" onclick="event.stopPropagation()">↗</a></td>
    </tr>
    <tr id="expandrow-${m.id}" style="${exp?"":"display:none"}"><td colspan="8" class="mk-expand-td"><div class="mk-expand-inner">${exp?renderExpandContent(m):""}</div></td></tr>`;
  }).join("");
  return`<div class="mk-table-wrap"><table class="mk-table"><thead><tr><th>Fällig</th><th>Adresse</th><th>Bauleiter</th><th>Status</th><th>Beginn / Ende</th><th>Pos.</th><th>Eingang</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderExpandContent(m){
  if(m.is_archiv)return`<div style="color:var(--muted);font-size:12px">Archiv · ${m.address||""}</div><div></div>`;
  const photoHtml = `<div id="photos-${m.id}" class="mk-photos-row"><span style="font-size:11px;color:var(--muted)">📸 Lade Fotos…</span></div>`;
  setTimeout(()=>loadPhotos(m.id), 50);
  return`<div><div style="font-weight:700;font-size:14px;margin-bottom:4px">${m.address||"—"}</div>${m.lage?`<div style="color:var(--muted);font-size:12px;margin-bottom:4px">${m.lage}</div>`:""}<div style="font-size:12px;color:var(--muted);line-height:1.8">Beginn: ${fmtDate(m.ausfuehrungsbeginn)} → Fällig: ${fmtDate(m.fertigstellung)}<br>Bauleiter: ${m.bauleiter||"—"} · Innendienst: ${m.innendienst||"—"}${m.first_seen?`<br>Eingangsdatum: <b>${m.first_seen}</b>`:""}</div>${renderProgress(m)}${photoHtml}${renderPositionen(m)}</div><div>${renderAssignPanel(m)}</div>`;
}

async function loadPhotos(mangel_id) {
  const box = document.getElementById("photos-"+mangel_id);
  if (!box) return;
  try {
    const r = await fetch(`https://api.github.com/repos/ChernenkoD/leo-dashboard/contents/photos/${mangel_id}?t=${Date.now()}`);
    if (!r.ok) { box.innerHTML = ""; return; }
    const files = await r.json();
    const imgs = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name));
    if (!imgs.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:6px">📸 Fotos (${imgs.length})</div>`
      + `<div class="mk-photo-grid">${imgs.map(f=>`<a href="${f.download_url}" target="_blank" title="${f.name}"><img src="${f.download_url}" class="mk-photo-thumb" loading="lazy"/></a>`).join("")}</div>`;
  } catch(e) { box.innerHTML = ""; }
}

function renderCardView(list){ if(!list.length)return`<div class="mk-empty"><div class="mk-empty-icon">📋</div><div class="mk-empty-text">Keine Mängel</div></div>`; return`<div class="mk-card-grid">${list.map(m=>m.is_archiv?renderArchivCard(m):renderCard(m)).join("")}</div>`; }
function renderCard(m){
  const d=daysUntil(m.fertigstellung); const isNew=isNewToday(m); const{done,total}=checkedCount(m); const pct=total?Math.round((done/total)*100):0; const bc=borderColor(m);
  const idLink = m.leo_url?`<a href="${m.leo_url}" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:700;font-size:11px">${m.id}</a>`:`<span style="font-weight:700;font-size:11px;color:var(--accent)">${m.id}</span>`;
  return`<div class="mk-card" id="card-${m.id}" style="border-left-color:${bc}"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div style="flex:1;min-width:0;padding-right:8px">${idLink}<div style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${m.address||"—"}</div>${m.lage?`<div style="font-size:11px;color:var(--muted)">${m.lage}</div>`:""}</div>${deadlinePill(m)}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${statusBadge(m.mangel_status)}${isNew?`<span class="mk-badge mk-badge--new">✨ Neu</span>`:""}${workflowBadge(m.id)}</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px;line-height:1.7"><div>${m.bauleiter||"—"} · ${m.innendienst||"—"}</div><div>${m.ausfuehrungsbeginn||"—"} → ${m.fertigstellung||"—"}</div>${m.first_seen?`<div>Eingang: ${m.first_seen}</div>`:""}</div>${total?`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-label">${done}/${total}</span></div>`:""}${renderPositionen(m)}${renderAssignPanel(m)}</div>`;
}
function renderArchivCard(m){ return`<div class="mk-card" style="opacity:.65;border-left-color:var(--border)"><div style="font-size:11px;color:var(--muted);margin-bottom:4px"><span class="mk-badge mk-badge--gray">Archiv</span></div><div style="font-weight:700">${m.address||"—"}</div><div style="font-size:12px;color:var(--muted);margin-top:4px">${m.id||""}<br>${m.ausfuehrungsbeginn||"—"} → ${m.fertigstellung||"—"}</div></div>`; }

function toggleRow(id){ const was=expandedRows.has(id); if(was){ expandedRows.delete(id); const r=document.getElementById("expandrow-"+id); if(r)r.style.display="none"; }else{ expandedRows.add(id); const r=document.getElementById("expandrow-"+id); if(r){ const m=MAENGEL.find(x=>x.id===id)||ARCHIV_MAENGEL.find(x=>x.id===id)||{id}; r.querySelector(".mk-expand-inner").innerHTML=renderExpandContent(m); r.style.display=""; }else render(); } }
function setView(v){ currentView=v; document.getElementById("btnViewList").classList.toggle("active",v==="list"); document.getElementById("btnViewCard").classList.toggle("active",v==="card"); render(); }
function resetFilters(){ mfSearch="";mfBauleiter="";mfStadt="";mfStatus="";mfFaellig="";mfManager="";mfTechniker="";mfNeu=false;mfSort="faellig"; ["mfSearch","mfBauleiter","mfStadt","mfStatus","mfFaellig","mfManager","mfTechniker"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";}); const s=document.getElementById("mfSort");if(s)s.value="faellig"; const n=document.getElementById("mfNeu");if(n)n.checked=false; render(); }

function render(){
  renderKPI(); renderChips();
  const active=MAENGEL.filter(m=>m.mangel_status!=="geprueft"); const geprueft=MAENGEL.filter(m=>m.mangel_status==="geprueft");
  document.getElementById("tabActive").textContent=`Aktiv (${active.length})`; document.getElementById("tabGeprueft").textContent=`Geprüft (${geprueft.length})`; document.getElementById("tabArchived").textContent=`Archiv (${ARCHIV_MAENGEL.length})`;
  ["tabActive","tabGeprueft","tabArchived"].forEach((id,i)=>document.getElementById(id).classList.toggle("active",showTab===["active","geprueft","leo"][i]));
  const neuH=active.filter(isNewToday);
  document.getElementById("neuHeuteBanner").innerHTML=(showTab==="active"&&neuH.length)?`<div class="neu-heute-bar">✨ Neu heute — ${neuH.length} neue Mängelauftrag${neuH.length>1?"träge":""}<span style="font-size:11px;opacity:.7">↓ Zuerst</span></div>`:"";
  let list=applyFilters(getBase()); list=sortList(list);
  if(showTab==="active"&&mfSort==="faellig"){ const neu=list.filter(isNewToday); const rest=list.filter(m=>!isNewToday(m)); list=[...neu,...rest]; }
  document.getElementById("mangelList").innerHTML=currentView==="list"?renderListView(list):renderCardView(list);
}

function populateSelects(){
  const bl=document.getElementById("mfBauleiter"); [...new Set(MAENGEL.map(m=>m.bauleiter).filter(Boolean))].sort().forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;bl.appendChild(o);});
  const st=document.getElementById("mfStadt"); [...new Set(MAENGEL.map(m=>cityOf(m)).filter(Boolean))].sort().forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;st.appendChild(o);});
  const mg=document.getElementById("mfManager"); (PEOPLE.managers||[]).map(p=>p.name).filter(Boolean).sort().forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;mg.appendChild(o);});
  const tk=document.getElementById("mfTechniker"); (PEOPLE.technicians||[]).map(p=>p.name).filter(Boolean).sort().forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;tk.appendChild(o);});
}

async function init(){
  await loadPeople();
  const res=await fetch("data.json?"+Date.now()); const data=await res.json();
  MAENGEL=data.maengel||[]; ARCHIV_MAENGEL=data.archiv_maengel||[];
  if(data.updatedAt) document.getElementById("pageSub").textContent="Stand: "+new Date(data.updatedAt).toLocaleString("de-DE");
  populateSelects(); setView("list");
  document.getElementById("tabActive").addEventListener("click",()=>{showTab="active";render();});
  document.getElementById("tabGeprueft").addEventListener("click",()=>{showTab="geprueft";render();});
  document.getElementById("tabArchived").addEventListener("click",()=>{showTab="leo";render();});
  document.getElementById("mfSearch").addEventListener("input",e=>{mfSearch=e.target.value.trim();render();});
  document.getElementById("mfBauleiter").addEventListener("change",e=>{mfBauleiter=e.target.value;render();});
  document.getElementById("mfStadt").addEventListener("change",e=>{mfStadt=e.target.value;render();});
  document.getElementById("mfStatus").addEventListener("change",e=>{mfStatus=e.target.value;render();});
  document.getElementById("mfFaellig").addEventListener("change",e=>{mfFaellig=e.target.value;render();});
  document.getElementById("mfManager").addEventListener("change",e=>{mfManager=e.target.value;render();});
  document.getElementById("mfTechniker").addEventListener("change",e=>{mfTechniker=e.target.value;render();});
  document.getElementById("mfSort").addEventListener("change",e=>{mfSort=e.target.value;render();});
  document.getElementById("mfNeu").addEventListener("change",e=>{mfNeu=e.target.checked;render();});
}
document.addEventListener("DOMContentLoaded",init);
