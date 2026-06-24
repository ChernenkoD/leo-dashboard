// mangel.js v9 — объединённая страница: KPI + список/карточки + перевод + назначение

let MAENGEL = [];
let ARCHIV_MAENGEL = [];
let PEOPLE = { managers: [], technicians: [] };

// Filters
let mfSearch = "";
let mfBauleiter = "";
let mfStatus = "";
let mfFaellig = "";
let mfSort = "faellig";
let mfNeu = false;
let currentView = "list"; // "list" | "card"
let showTab = "active"; // "active" | "geprueft" | "leo"
let expandedRows = new Set();

const REPO = "ChernenkoD/leo-dashboard";
const ASSIGNMENTS_FILE = "assignments.json";

// ── CSS ───────────────────────────────────────────────────────────────────────
(function injectCSS() {
  const s = document.createElement("style");
  s.textContent = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }

    /* KPI grid */
    .stat-grid-5 { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
    .kpi-card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px 14px 12px;
      border-top:3px solid transparent; }
    .kpi-card-red    { border-top-color:#ef4444; }
    .kpi-card-orange { border-top-color:#f97316; }
    .kpi-card-blue   { border-top-color:#3b82f6; }
    .kpi-card-green  { border-top-color:#22c55e; }
    .kpi-val   { font-size:28px; font-weight:800; color:var(--text); line-height:1; }
    .kpi-label { font-size:11px; color:var(--muted); margin:4px 0 2px; text-transform:uppercase; letter-spacing:.04em; }
    .kpi-sub   { font-size:11px; color:var(--accent); }

    /* view toggle */
    .view-toggle-btn { padding:5px 10px; border:1px solid var(--border); border-radius:6px;
      background:none; color:var(--muted); cursor:pointer; font-size:12px; }
    .view-toggle-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }

    /* List table */
    .mangel-list-table { width:100%; border-collapse:collapse; font-size:13px; }
    .mangel-list-table thead th {
      padding:8px 12px; font-size:10px; font-weight:700;
      text-transform:uppercase; letter-spacing:.06em; color:var(--muted);
      border-bottom:2px solid var(--border); background:var(--bg); position:sticky; top:0; z-index:1;
    }
    .ml-row { border-left:3px solid transparent; cursor:pointer; transition:background .12s; }
    .ml-row:hover { background:color-mix(in srgb,var(--accent) 5%,transparent); }
    .ml-row td { padding:9px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
    .ml-row--red    { border-left-color:#ef4444; }
    .ml-row--orange { border-left-color:#f97316; }
    .ml-row--yellow { border-left-color:#eab308; }
    .ml-row--green  { border-left-color:#22c55e; }
    .ml-deadline-pill { display:inline-block; padding:2px 8px; border-radius:20px;
      font-size:11px; font-weight:800; white-space:nowrap; }

    /* Expanded row */
    .ml-expanded-row td { background:var(--bg); padding:0; }
    .ml-expand-content { padding:16px; display:flex; flex-direction:column; gap:12px; }

    /* Card grid */
    .mangel-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; margin-top:4px; }

    /* Existing card styles enhanced */
    .card { background:var(--panel); border:1px solid var(--border); border-radius:14px;
      padding:18px 18px 14px; transition:box-shadow .15s; animation:fadeIn .2s ease; }
    .card:hover { box-shadow:0 4px 16px rgba(0,0,0,.1); }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

    /* status badge */
    .mbadge { display:inline-block; border-radius:6px; padding:2px 8px; font-size:11px; font-weight:700; }
    .mbadge-offen    { background:#fee2e2; color:#b91c1c; }
    .mbadge-behoben  { background:#fef9c3; color:#854d0e; }
    .mbadge-geprueft { background:#dcfce7; color:#166534; }
    .mbadge-assign   { background:#f3f4f6; color:#374151; }
    .mbadge-pos      { background:#eef2ff; color:#3730a3; }

    /* empty */
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:48px; color:var(--muted); gap:12px; }
    .empty-state-icon { font-size:48px; opacity:.3; }
    .empty-state-text { font-size:14px; }

    /* print */
    @media print {
      .toolbar, #sidebar-mount, .topbar { display:none!important; }
      body { font-size:12px; }
    }
  `;
  document.head.appendChild(s);
})();

// ── GitHub sync ───────────────────────────────────────────────────────────────
async function saveAssignmentToGitHub(mangelId) {
  const token = localStorage.getItem("github_pat");
  if (!token) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });
    const curr = await r.json();
    const allAssignments = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("assign_")) {
        const id = key.slice(7);
        try {
          const asgn = JSON.parse(localStorage.getItem(key));
          const mgr  = (PEOPLE.managers    || []).find(p => p.id === asgn.manager);
          const tech = (PEOPLE.technicians || []).find(p => p.id === asgn.technician);
          if (mgr)  asgn.manager_name    = mgr.name;
          if (tech) asgn.technician_name = tech.name;
          allAssignments[id] = asgn;
        } catch {}
      }
    }
    const content = btoa(unescape(encodeURIComponent(JSON.stringify({ assignments: allAssignments }, null, 2))));
    await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({ message: `Update assignment ${mangelId}`, content, sha: curr.sha })
    });
  } catch(e) { console.error("GitHub sync error:", e); }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}
function fmtDate(str) {
  const dt = parseDate(str);
  return dt ? dt.toLocaleDateString("ru-RU") : "—";
}
function today0() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function daysUntil(str) {
  const dt = parseDate(str);
  if (!dt) return null;
  return Math.round((dt - today0()) / 86400000);
}
function isNewRecent(m) {
  if (!m.first_seen) return false;
  const d = new Date(m.first_seen);
  const sevenAgo = new Date(today0()); sevenAgo.setDate(sevenAgo.getDate() - 7);
  return d >= sevenAgo;
}
function isNewToday(m) {
  if (!m.first_seen) return false;
  const d = new Date(m.first_seen);
  const t = today0();
  return d >= t;
}

// ── People / assignments ──────────────────────────────────────────────────────
async function loadPeople() {
  const local = localStorage.getItem("people_config");
  if (local) { try { PEOPLE = JSON.parse(local); return; } catch {} }
  try { const r = await fetch("people.json?" + Date.now()); PEOPLE = await r.json(); } catch {}
}
function getAssignment(mangelId) {
  try {
    const raw = localStorage.getItem("assign_" + mangelId);
    return raw ? JSON.parse(raw) : { manager: "", technician: "", sentAt: null, date_started: null, date_finished: null };
  } catch { return { manager: "", technician: "", sentAt: null, date_started: null, date_finished: null }; }
}
function saveAssignment(mangelId, obj) {
  localStorage.setItem("assign_" + mangelId, JSON.stringify(obj));
}

// ── Position checkbox helpers ─────────────────────────────────────────────────
function checkKey(id, idx) { return `chk_${id}_${idx}`; }
function isAutoChecked(status) { return status && status.toLowerCase().includes("geprüft"); }
function isChecked(id, idx, status) {
  if (isAutoChecked(status)) return true;
  return localStorage.getItem(checkKey(id, idx)) === "1";
}
function setChecked(id, idx, val) {
  if (val) localStorage.setItem(checkKey(id, idx), "1");
  else localStorage.removeItem(checkKey(id, idx));
}
function checkedCount(m) {
  const pos = m.positionen || [];
  if (!pos.length) return { done: 0, total: m.anzahl || 0 };
  return { done: pos.filter((p, i) => isChecked(m.id, i, p.status)).length, total: pos.length };
}
function mangelStatusGroup(m) {
  const pos = m.positionen || [];
  if (!pos.length) return "offen";
  const statuses = pos.map(p => (p.status || "").toLowerCase());
  if (statuses.every(s => s.includes("geprüft"))) return "geprueft";
  if (statuses.some(s => s.includes("behoben"))) return "behoben";
  return "offen";
}

// ── Status/deadline badge helpers ─────────────────────────────────────────────
function statusBadge(ms) {
  const map = {
    offen:    ["mbadge-offen",    "🔴 Offen"],
    behoben:  ["mbadge-behoben",  "🟡 Behoben"],
    geprueft: ["mbadge-geprueft", "✅ Geprüft"],
  };
  const [cls, label] = map[ms] || ["mbadge", ms || "—"];
  return `<span class="mbadge ${cls}">${label}</span>`;
}
function workflowBadge(id) {
  const a = getAssignment(id);
  if (a.date_finished) return `<span class="mbadge" style="background:#dcfce7;color:#166534">✓ Fertig ${a.date_finished}</span>`;
  if (a.sentAt) {
    const tech = (PEOPLE.technicians || []).find(p => p.id === a.technician);
    return `<span class="mbadge" style="background:#dbeafe;color:#1d4ed8">🔵 In Arbeit · ${tech ? tech.name.split(" ")[0] : "—"}</span>`;
  }
  if (a.manager || a.technician) return `<span class="mbadge mbadge-assign">👤 Zugewiesen</span>`;
  return "";
}
function deadlineRowClass(m) {
  const days = daysUntil(m.fertigstellung);
  if (days === null) return "";
  if (days < 0 || days <= 3) return "ml-row--red";
  if (days <= 7)  return "ml-row--orange";
  if (days <= 14) return "ml-row--yellow";
  return "ml-row--green";
}
function deadlinePill(m) {
  const days = daysUntil(m.fertigstellung);
  if (days === null) return `<span class="ml-deadline-pill" style="background:var(--bg);color:var(--muted)">—</span>`;
  if (days < 0) return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">${Math.abs(days)}d !</span>`;
  if (days === 0) return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">Heute</span>`;
  if (days <= 3)  return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">${days}d</span>`;
  if (days <= 7)  return `<span class="ml-deadline-pill" style="background:#ffedd5;color:#c2410c">${days}d</span>`;
  if (days <= 14) return `<span class="ml-deadline-pill" style="background:#fef9c3;color:#854d0e">${days}d</span>`;
  return `<span class="ml-deadline-pill" style="background:#dcfce7;color:#166534">${days}d</span>`;
}

// ── Translation ───────────────────────────────────────────────────────────────
async function translatePos(mangelId, posIdx, text, targetLang) {
  const box = document.getElementById(`trans-${mangelId}-${posIdx}`);
  if (!box) return;
  if (box.style.display !== "none" && box.dataset.lang === targetLang) {
    box.style.display = "none"; box.dataset.lang = ""; return;
  }
  box.innerHTML = `<span style="color:var(--muted);font-size:12px">⏳ Übersetze…</span>`;
  box.style.display = "block"; box.dataset.lang = targetLang;
  const srcLang = targetLang === "ru" ? "de" : "ru";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${srcLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    const translated = data[0].map(s => s[0]).join("");
    const flag = targetLang === "ru" ? "🇷🇺" : "🇩🇪";
    const esc = translated.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    box.innerHTML = `
      <div style="font-size:13px;color:var(--text);margin-bottom:4px">${flag} ${translated}</div>
      <button class="btn-copy-trans" onclick="navigator.clipboard.writeText('${esc}').then(()=>{this.textContent='✓ Kopiert!';setTimeout(()=>this.textContent='📋 Kopieren',2000)})">📋 Kopieren</button>
    `;
  } catch(e) { box.innerHTML = `<span style="color:#dc2626;font-size:12px">Fehler: ${e.message}</span>`; }
}

// ── Positionen render (shared) ────────────────────────────────────────────────
function renderPositionen(m) {
  const pos = m.positionen || [];
  if (!pos.length) {
    const total = m.anzahl || 0;
    if (!total) return "";
    return `<div class="pos-list">${Array.from({length:total},(_,i)=>`
      <label class="pos-item" onclick="event.stopPropagation()">
        <input type="checkbox" ${isChecked(m.id,i)?"checked":""} onchange="toggleCheck('${m.id}',${i},this.checked)">
        <span class="pos-label muted">Position ${i+1}</span>
      </label>`).join("")}</div>`;
  }
  return `<div class="pos-list">${pos.map((p,i)=>{
    const auto = isAutoChecked(p.status);
    const chk = isChecked(m.id, i, p.status);
    const descText = (p.mangel_beschreibung||p.leistung||"").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    const hasDesc = !!(p.mangel_beschreibung||p.leistung);
    return `<label class="pos-item ${chk?"pos-item-done":""}" onclick="event.stopPropagation()">
      <input type="checkbox" ${chk?"checked":""} ${auto?"disabled title='Закрыто заказчиком'":""}
        onchange="toggleCheck('${m.id}',${i},this.checked)">
      <div class="pos-info">
        <span class="pos-code">${p.code||""} · ${p.gewerk||""}</span>
        ${p.leistung?`<span class="pos-leistung">${p.leistung}</span>`:""}
        ${p.mangel_beschreibung?`<div class="pos-desc-row">
          <b class="pos-desc">${p.mangel_beschreibung}</b>
          ${hasDesc?`<span class="trans-btns">
            <button class="btn-translate" onclick="event.stopPropagation();translatePos('${m.id}',${i},'${descText}','ru')">🇩🇪→🇷🇺</button>
            <button class="btn-translate" onclick="event.stopPropagation();translatePos('${m.id}',${i},'${descText}','de')">🇷🇺→🇩🇪</button>
          </span>`:""}
        </div>`:""}
        ${p.bereich?`<span class="pos-gewerk">${p.bereich}</span>`:""}
        <div id="trans-${m.id}-${i}" class="trans-box" style="display:none"></div>
      </div>
      ${p.status?`<span class="pos-badge ${statusClass(p.status)}">${p.status}</span>`:""}
    </label>`;
  }).join("")}</div>`;
}
function statusClass(s) {
  if (!s) return "";
  const l = s.toLowerCase();
  if (l.includes("geprüft")) return "pos-done";
  if (l.includes("behoben")) return "pos-behoben";
  if (l.includes("angenommen")) return "pos-open";
  if (l.includes("abgelehnt")) return "pos-rejected";
  return "";
}
function renderProgress(m) {
  const {done, total} = checkedCount(m);
  if (!total) return "";
  const pct = Math.round((done/total)*100);
  return `<div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <span class="progress-label">${done} / ${total}</span>
  </div>`;
}

// ── Assignment panel ──────────────────────────────────────────────────────────
function renderAssignPanel(m) {
  const asgn = getAssignment(m.id);
  const mgrs = PEOPLE.managers || [];
  const techs = PEOPLE.technicians || [];
  const mgrOpts = `<option value="">— Manager —</option>` +
    mgrs.map(p=>`<option value="${p.id}" ${asgn.manager===p.id?"selected":""}>${p.name}</option>`).join("");
  const techOpts = `<option value="">— Techniker —</option>` +
    techs.map(p=>`<option value="${p.id}" ${asgn.technician===p.id?"selected":""}>${p.name}</option>`).join("");
  let statusRow = "";
  if (asgn.date_finished) {
    statusRow = `<span class="assign-sent assign-fertig">✓ Fertig: ${asgn.date_finished}</span>`;
  } else if (asgn.sentAt) {
    const sentStr = new Date(asgn.sentAt).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    statusRow = `<span class="assign-sent">✓ In Arbeit ${sentStr}</span>
      <button class="btn-fertig" onclick="markFertig('${m.id}')">✓ Fertig markieren</button>`;
  }
  return `<div class="assign-panel" onclick="event.stopPropagation()">
    <select class="assign-select" onchange="onAssignChange('${m.id}','manager',this.value)">${mgrOpts}</select>
    <select class="assign-select" onchange="onAssignChange('${m.id}','technician',this.value)">${techOpts}</select>
    <button class="btn-senden" onclick="sendInArbeit('${m.id}')" ${asgn.technician?"":"disabled"}>✈ In Arbeit senden</button>
    ${statusRow}
  </div>`;
}

function onAssignChange(id, field, val) {
  const asgn = getAssignment(id); asgn[field] = val; saveAssignment(id, asgn);
  render();
}
function markFertig(id) {
  const today = new Date().toISOString().slice(0,10);
  const input = prompt("Datum Fertigstellung (JJJJ-MM-TT):", today);
  if (!input) return;
  const asgn = getAssignment(id); asgn.date_finished = input;
  saveAssignment(id, asgn); saveAssignmentToGitHub(id); render();
}
function sendInArbeit(id) {
  const m = MAENGEL.find(x => x.id === id); if (!m) return;
  const asgn = getAssignment(id);
  const tech = (PEOPLE.technicians||[]).find(p => p.id === asgn.technician);
  const mgr  = (PEOPLE.managers  ||[]).find(p => p.id === asgn.manager);
  const positions = (m.positionen||[]).map((p,i)=>
    `${i+1}. ${p.code||""} ${p.gewerk||""}: ${p.mangel_beschreibung||p.leistung||"—"}`).join("\n");
  const msg = [`⚠️ Neuer Mängelauftrag`,`📋 ${m.id}`,`📍 ${m.address||"—"}`,
    m.lage?`🏠 ${m.lage}`:null,`📅 Termin: ${fmtDate(m.fertigstellung)}`,
    `👔 Manager: ${mgr?mgr.name:"—"}`,`🔧 Techniker: ${tech?tech.name:"—"}`,
    ``,positions||"Keine Positionen",``,m.leo_url?`🔗 ${m.leo_url}`:null
  ].filter(x=>x!==null).join("\n");
  if (tech && tech.telegram_id) {
    window.open(`https://t.me/${tech.telegram_id}?text=${encodeURIComponent(msg)}`,"_blank");
  } else {
    navigator.clipboard.writeText(msg).then(()=>alert("Текст скопирован!\n\n"+(tech?tech.name:"?"))).catch(()=>prompt("Скопируй:",msg));
  }
  asgn.sentAt = new Date().toISOString(); asgn.date_started = new Date().toISOString().slice(0,10);
  saveAssignment(id, asgn); saveAssignmentToGitHub(id); render();
}
function toggleCheck(id, idx, val) {
  setChecked(id, idx, val); render();
}

// ── KPI render ────────────────────────────────────────────────────────────────
function renderKPI() {
  const now = today0();
  const all = MAENGEL;
  const ueberfaellig = all.filter(m => {
    const d = parseDate(m.fertigstellung);
    return d && d < now && m.mangel_status !== "geprueft";
  }).length;
  const le7 = all.filter(m => {
    const days = daysUntil(m.fertigstellung);
    return days !== null && days >= 0 && days <= 7 && m.mangel_status !== "geprueft";
  }).length;
  const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate()-7);
  const neuWoche = all.filter(m => m.first_seen && new Date(m.first_seen) >= sevenAgo).length;
  const geprueft = all.filter(m => m.mangel_status === "geprueft").length;

  document.getElementById("mangelKPI").innerHTML = [
    { label:"Gesamt aktive Mängel", val:all.length,       sub:"in Bearbeitung",       cls:"",              valClr:"" },
    { label:"Überfällig",           val:ueberfaellig,      sub:"Deadline überschritten",cls:"kpi-card-red",   valClr:"color:#b91c1c" },
    { label:"Fällig ≤7 Tage",       val:le7,               sub:"dringend",             cls:"kpi-card-orange",valClr:"color:#d97706" },
    { label:"Neu diese Woche",      val:neuWoche,          sub:"first_seen <7d",       cls:"kpi-card-blue",  valClr:"color:#2563eb" },
    { label:"Geprüft ✅",            val:geprueft,          sub:"abgeschlossen",        cls:"kpi-card-green", valClr:"color:#16a34a" },
  ].map(k=>`<div class="kpi-card ${k.cls}" style="cursor:default">
    <div class="kpi-val" style="${k.valClr}">${k.val}</div>
    <div class="kpi-label">${k.label}</div>
    <div class="kpi-sub">${k.sub}</div>
  </div>`).join("");
}

// ── Filters & sort ────────────────────────────────────────────────────────────
function getBase() {
  if (showTab === "leo") return ARCHIV_MAENGEL;
  if (showTab === "geprueft") return MAENGEL.filter(m => m.mangel_status === "geprueft");
  return MAENGEL.filter(m => m.mangel_status !== "geprueft");
}

function applyFilters(list) {
  return list.filter(m => {
    if (mfSearch) {
      const q = mfSearch.toLowerCase();
      if (!`${m.id||""} ${m.address||""} ${m.bauleiter||""}`.toLowerCase().includes(q)) return false;
    }
    if (mfBauleiter && m.bauleiter !== mfBauleiter) return false;

    // Status filter combines LEO status + workflow status
    if (mfStatus === "in_arbeit") {
      const a = getAssignment(m.id); if (!a.sentAt || a.date_finished) return false;
    } else if (mfStatus === "fertig") {
      if (!getAssignment(m.id).date_finished) return false;
    } else if (mfStatus) {
      if (mangelStatusGroup(m) !== mfStatus && m.mangel_status !== mfStatus) return false;
    }

    if (mfNeu && !isNewRecent(m)) return false;

    if (mfFaellig) {
      const days = daysUntil(m.fertigstellung);
      const isPrueft = m.mangel_status === "geprueft";
      if (mfFaellig === "ueberfaellig" && (days===null||days>=0||isPrueft)) return false;
      if (mfFaellig === "le3"  && (days===null||days<0||days>3))  return false;
      if (mfFaellig === "le7"  && (days===null||days<0||days>7))  return false;
      if (mfFaellig === "le14" && (days===null||days<0||days>14)) return false;
      if (mfFaellig === "gt14" && (days===null||days<=14))        return false;
    }
    return true;
  });
}

function sortList(list) {
  const copy = [...list];
  if (mfSort === "faellig") {
    copy.sort((a,b)=>(daysUntil(a.fertigstellung)??9999)-(daysUntil(b.fertigstellung)??9999));
  } else if (mfSort === "newest") {
    copy.sort((a,b)=>(b.first_seen||"").localeCompare(a.first_seen||""));
  } else if (mfSort === "oldest") {
    copy.sort((a,b)=>(a.first_seen||"").localeCompare(b.first_seen||""));
  } else if (mfSort === "address") {
    copy.sort((a,b)=>(a.address||"").localeCompare(b.address||"","de"));
  } else if (mfSort === "deadline_desc") {
    copy.sort((a,b)=>(daysUntil(b.fertigstellung)??-9999)-(daysUntil(a.fertigstellung)??-9999));
  }
  return copy;
}

// ── List view ─────────────────────────────────────────────────────────────────
function renderListView(list) {
  if (!list.length) return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Keine Mängel gefunden</div></div>`;

  const rows = list.map(m => {
    const isArchiv = m.is_archiv;
    const rowCls = isArchiv ? "" : deadlineRowClass(m);
    const posCount = (m.positionen||[]).length;
    const expanded = expandedRows.has(m.id);
    const expandContent = expanded ? renderExpandContent(m) : "";
    return `
      <tr class="ml-row ${rowCls}" onclick="toggleRow('${m.id}')">
        <td>${isArchiv ? `<span class="mbadge" style="background:var(--bg);color:var(--muted)">Archiv</span>` : deadlinePill(m)}</td>
        <td>
          <div style="font-weight:700;font-size:13px">${m.address||"—"}</div>
          <div style="font-size:11px;color:var(--muted)">${m.id||""} ${m.lage?"· "+m.lage:""}</div>
        </td>
        <td style="font-size:12px">${m.bauleiter||"—"}</td>
        <td>${statusBadge(m.mangel_status)} ${workflowBadge(m.id)}</td>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap">${m.ausfuehrungsbeginn||"—"}<br>→ ${m.fertigstellung||"—"}</td>
        <td style="font-size:11px">${posCount>0?`<span class="mbadge mbadge-pos">${posCount}P</span>`:""}</td>
        <td><a href="${m.leo_url||'#'}" target="_blank" class="btn-leo" onclick="event.stopPropagation()" style="color:var(--accent);font-size:12px;text-decoration:none;font-weight:600">→</a></td>
      </tr>
      <tr id="expandrow-${m.id}" style="${expanded?'':'display:none'}">
        <td colspan="7" class="ml-expanded-row">
          <div class="ml-expand-content">${expanded?expandContent:""}</div>
        </td>
      </tr>`;
  }).join("");

  return `<table class="mangel-list-table">
    <thead><tr>
      <th style="width:80px">Fällig</th>
      <th>Adresse / ID</th>
      <th style="width:130px">Bauleiter</th>
      <th style="width:170px">Status</th>
      <th style="width:120px">Beginn / Ende</th>
      <th style="width:50px">Pos.</th>
      <th style="width:36px"></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderExpandContent(m) {
  if (m.is_archiv) return `<div style="font-size:12px;color:var(--muted)">Archiv-Eintrag</div>`;
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;padding-bottom:8px">
      <div>
        <div style="font-weight:700;margin-bottom:2px">${m.address||"—"}</div>
        ${m.lage?`<div style="color:var(--muted);font-size:12px">${m.lage}</div>`:""}
        <div style="color:var(--muted);font-size:12px;margin-top:4px">
          Beginn: ${fmtDate(m.ausfuehrungsbeginn)} → Fällig: ${fmtDate(m.fertigstellung)}<br>
          Bauleiter: ${m.bauleiter||"—"} · Innendienst: ${m.innendienst||"—"}
          ${m.first_seen?`<br>Eingangsdatum: <b>${m.first_seen}</b>`:""}
        </div>
      </div>
      <div>${renderAssignPanel(m)}</div>
    </div>
    ${renderProgress(m)}
    ${renderPositionen(m)}
  `;
}

// ── Card view ─────────────────────────────────────────────────────────────────
function renderCardView(list) {
  if (!list.length) return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Keine Mängel gefunden</div></div>`;
  return `<div class="mangel-card-grid">${list.map(m=>m.is_archiv?renderArchivCard(m):renderCard(m)).join("")}</div>`;
}

function renderCard(m) {
  const days = daysUntil(m.fertigstellung);
  const late = days!==null && days<0;
  const soon = days!==null && days>=0 && days<=7;
  const newToday = isNewToday(m);
  const {done,total} = checkedCount(m);
  const pct = total ? Math.round((done/total)*100) : 0;
  const ms = m.mangel_status || "offen";
  const borderColor = ms==="geprueft" ? "#22c55e" : late ? "#ef4444" : soon ? "#f97316" : "#6b7280";

  return `<div class="card" id="card-${m.id}" style="border-left:4px solid ${borderColor}">
    <div class="card-head">
      <div class="card-badges" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">
        ${statusBadge(ms)}
        ${newToday?`<span class="mbadge" style="background:#fef9c3;color:#854d0e">✨ Neu heute</span>`:""}
        ${late?`<span class="mbadge mbadge-offen">⚠ ${Math.abs(days)} Tage überfällig</span>`:""}
        ${soon&&!late?`<span class="mbadge" style="background:#ffedd5;color:#c2410c">⏰ ${days} T.</span>`:""}
        ${workflowBadge(m.id)}
      </div>
      <div style="font-weight:800;font-size:14px;margin-bottom:2px">
        ${m.leo_url?`<a href="${m.leo_url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent)">${m.id}</a>`:m.id}
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:2px">${m.address||"—"}</div>
      ${m.lage?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">${m.lage}</div>`:""}
      <div style="font-size:12px;color:var(--muted)">
        Beginn: <b>${fmtDate(m.ausfuehrungsbeginn)}</b> &nbsp; Fällig: <b>${fmtDate(m.fertigstellung)}</b>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">
        Bauleiter: ${m.bauleiter||"—"} · Innendienst: ${m.innendienst||"—"}
      </div>
    </div>
    ${renderProgress(m)}
    ${renderPositionen(m)}
    ${renderAssignPanel(m)}
  </div>`;
}

function renderArchivCard(m) {
  return `<div class="card" style="opacity:.75">
    <div class="lws">${m.id||"—"} <span style="font-size:11px;background:var(--bg);color:var(--muted);padding:1px 6px;border-radius:4px">Archiv</span></div>
    <div style="font-size:14px;font-weight:600">${m.address||"—"}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">
      ${m.ausfuehrungsbeginn||"—"} → ${m.fertigstellung||"—"}<br>
      ${m.bauleiter||"—"}
    </div>
  </div>`;
}

// ── Toggle row expansion ──────────────────────────────────────────────────────
function toggleRow(id) {
  const wasOpen = expandedRows.has(id);
  if (wasOpen) {
    expandedRows.delete(id);
    const r = document.getElementById("expandrow-"+id);
    if (r) r.style.display = "none";
  } else {
    expandedRows.add(id);
    const r = document.getElementById("expandrow-"+id);
    if (r) {
      r.querySelector(".ml-expand-content").innerHTML = renderExpandContent(MAENGEL.find(x=>x.id===id)||ARCHIV_MAENGEL.find(x=>x.id===id)||{id});
      r.style.display = "";
    } else { render(); }
  }
}

// ── View toggle ───────────────────────────────────────────────────────────────
function setView(v) {
  currentView = v;
  document.getElementById("btnViewList").classList.toggle("active", v==="list");
  document.getElementById("btnViewCard").classList.toggle("active", v==="card");
  render();
}

// ── Reset filters ─────────────────────────────────────────────────────────────
function resetFilters() {
  mfSearch=""; mfBauleiter=""; mfStatus=""; mfFaellig=""; mfSort="faellig"; mfNeu=false;
  document.getElementById("mfSearch").value="";
  document.getElementById("mfBauleiter").value="";
  document.getElementById("mfStatus").value="";
  document.getElementById("mfFaellig").value="";
  document.getElementById("mfSort").value="faellig";
  document.getElementById("mfNeu").checked=false;
  render();
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  renderKPI();

  const active   = MAENGEL.filter(m => m.mangel_status !== "geprueft");
  const geprueft = MAENGEL.filter(m => m.mangel_status === "geprueft");

  // Tab labels
  document.getElementById("tabActive").textContent   = `Aktiv (${active.length})`;
  document.getElementById("tabGeprueft").textContent = `Geprüft ✓ (${geprueft.length})`;
  document.getElementById("tabArchived").textContent = `Archiv LEO (${ARCHIV_MAENGEL.length})`;
  document.getElementById("tabActive").classList.toggle("active",   showTab==="active");
  document.getElementById("tabGeprueft").classList.toggle("active", showTab==="geprueft");
  document.getElementById("tabArchived").classList.toggle("active", showTab==="leo");

  // Neu heute banner
  const neuHeute = active.filter(isNewToday);
  const banner = document.getElementById("neuHeuteBanner");
  if (banner) banner.innerHTML = (showTab==="active" && neuHeute.length)
    ? `<div class="neu-heute-bar"><span>✨ Neu heute — ${neuHeute.length} neue Mängelauftrag${neuHeute.length>1?"träge":""}</span><span class="neu-hint">↓ In der Liste zuerst</span></div>` : "";

  let list = applyFilters(getBase());
  list = sortList(list);

  // Neue oben wenn активная вкладка без фильтров
  if (showTab==="active" && !mfSort.startsWith("deadline_") && mfSort==="faellig") {
    const neu = list.filter(isNewToday);
    const rest = list.filter(m=>!isNewToday(m));
    list = [...neu, ...rest];
  }

  const el = document.getElementById("mangelList");
  el.innerHTML = currentView==="list" ? renderListView(list) : renderCardView(list);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function populateBauleiter() {
  const sel = document.getElementById("mfBauleiter");
  const names = [...new Set(MAENGEL.map(m=>m.bauleiter).filter(Boolean))].sort();
  names.forEach(n => { const o=document.createElement("option"); o.value=n; o.textContent=n; sel.appendChild(o); });
}

async function init() {
  await loadPeople();
  const res = await fetch("data.json?"+Date.now());
  const data = await res.json();
  MAENGEL = data.maengel || [];
  ARCHIV_MAENGEL = data.archiv_maengel || [];
  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    document.getElementById("pageSub").textContent = "Stand: " + d.toLocaleString("de-DE");
  }

  populateBauleiter();

  // Initial view: list mode active
  setView("list");

  // Tab buttons
  document.getElementById("tabActive").addEventListener("click",   ()=>{ showTab="active";   render(); });
  document.getElementById("tabGeprueft").addEventListener("click", ()=>{ showTab="geprueft"; render(); });
  document.getElementById("tabArchived").addEventListener("click", ()=>{ showTab="leo";      render(); });

  // Filters
  document.getElementById("mfSearch").addEventListener("input",    e=>{mfSearch=e.target.value.trim(); render();});
  document.getElementById("mfBauleiter").addEventListener("change",e=>{mfBauleiter=e.target.value; render();});
  document.getElementById("mfStatus").addEventListener("change",   e=>{mfStatus=e.target.value; render();});
  document.getElementById("mfFaellig").addEventListener("change",  e=>{mfFaellig=e.target.value; render();});
  document.getElementById("mfSort").addEventListener("change",     e=>{mfSort=e.target.value; render();});
  document.getElementById("mfNeu").addEventListener("change",      e=>{mfNeu=e.target.checked; render();});
}

document.addEventListener("DOMContentLoaded", init);
