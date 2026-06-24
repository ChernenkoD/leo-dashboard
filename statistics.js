// ============================================================
// statistics.js — LK Bauservice GmbH Dashboard v11
// Tabs: Alle Projekte | Aktive Projekte | Mängel | Wochenbericht
// ============================================================

// ── State ─────────────────────────────────────────────────────────────────────
let allProjects = [];
let allMaengel = [];
let archivMangelStats = {};
let archivMaengelList = [];

// Tab 1 filters
let filters = {
  year: null,
  city: null,
  bauleiter: null,
  status: null,
  mangel: null,
};

// Tab 2 (Aktiv) state
const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
let planVon = null, planBis = null;
let tableMonthFilter = null;

// Tab 3 (Mängel) filters
let mangelFilters = {
  search: "",
  bauleiter: "",
  status: "",
  faelligkeit: "",
  sort: "faellig",
  neu: false,
};

let mangelView = "list"; // "list" | "card"
let mangelExpanded = new Set(); // expanded row IDs

// Tab 4 (Woche) state
let wocheOffset = 0;

let currentTab = "archiv";

// ── Inject extra CSS ───────────────────────────────────────────────────────────
(function injectCSS() {
  const style = document.createElement("style");
  style.textContent = `
    .kpi-val { font-size: 26px; font-weight: 800; color: var(--text); }
    .kpi-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px 16px 14px; }
    .kpi-label { font-size: 11px; color: var(--muted); margin: 4px 0 2px; text-transform: uppercase; letter-spacing: .04em; }
    .kpi-sub { font-size: 12px; color: var(--accent); }

    /* Mängel grid cards */
    .mangel-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 18px 14px;
      position: relative;
      transition: box-shadow .15s;
    }
    .mangel-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }
    .mangel-card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .mangel-deadline-badge {
      display: flex; flex-direction: column; align-items: flex-end;
      min-width: 90px; flex-shrink: 0;
    }
    .deadline-pill {
      font-size: 13px; font-weight: 800;
      padding: 4px 11px; border-radius: 20px;
      white-space: nowrap; margin-bottom: 3px;
    }
    .deadline-pill.red    { background: #fee2e2; color: #b91c1c; }
    .deadline-pill.orange { background: #ffedd5; color: #c2410c; }
    .deadline-pill.yellow { background: #fef9c3; color: #854d0e; }
    .deadline-pill.green  { background: #dcfce7; color: #166534; }
    .deadline-pill.none   { background: var(--bg); color: var(--muted); }
    .deadline-date { font-size: 10px; color: var(--muted); text-align: right; }

    .mangel-address { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
    .mangel-lage    { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
    .mangel-meta    { display: flex; gap: 16px; font-size: 12px; color: var(--muted); margin-bottom: 8px; flex-wrap: wrap; }
    .mangel-meta b  { color: var(--text); }
    .mangel-dates   { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
    .mangel-dates span { color: var(--text); font-weight: 600; }
    .mangel-badges  { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }

    .mbadge { display: inline-block; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
    .mbadge-offen     { background: #fee2e2; color: #b91c1c; }
    .mbadge-behoben   { background: #fef9c3; color: #854d0e; }
    .mbadge-teilweise { background: #ffedd5; color: #c2410c; }
    .mbadge-geprueft  { background: #dcfce7; color: #166534; }
    .mbadge-unknown   { background: var(--bg); color: var(--muted); }
    .mbadge-pos       { background: #eef2ff; color: #3730a3; }
    .mbadge-assign    { background: #f3f4f6; color: #374151; }

    .mangel-progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .mangel-progress-bar { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .mangel-progress-fill { height: 100%; background: #10b981; border-radius: 3px; }
    .mangel-progress-pct { font-size: 11px; color: var(--muted); white-space: nowrap; }

    .mangel-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
    .btn-leo { color: var(--accent); text-decoration: none; font-size: 12px; font-weight: 600; }
    .btn-leo:hover { text-decoration: underline; }

    /* Mängel filter bar overrides */
    #mangelFilterBar select,
    #mangelFilterBar input[type=text] {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      color: var(--text);
      background: var(--bg);
    }
    #mangelFilterBar select:focus,
    #mangelFilterBar input[type=text]:focus { outline: none; border-color: var(--accent); }
    #mangelFilterBar .plan-filter-group label { font-size: 11px; }

    /* Wochenbericht summary box */
    .woche-summary-box {
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 18px 22px;
      background: var(--panel);
      font-size: 14px;
      line-height: 2;
    }
    .woche-summary-box table { border-collapse: collapse; width: 100%; }
    .woche-summary-box td { padding: 2px 12px 2px 0; }
    .woche-summary-box td:first-child { color: var(--muted); font-size: 13px; }
    .woche-summary-box td:nth-child(2) { font-weight: 800; font-size: 18px; color: var(--text); }
    .woche-summary-box td:nth-child(3) { font-size: 12px; color: var(--accent); }

    .woche-list-col { display: flex; flex-direction: column; gap: 8px; }
    .woche-list-item { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; }
    .woche-list-id { font-weight: 700; color: var(--accent); font-size: 11px; }
    .woche-list-addr { font-size: 12px; color: var(--text); }
    .woche-list-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .woche-list-red { color: #b91c1c; font-weight: 700; }

    .bar-row-active { background: color-mix(in srgb, var(--accent) 10%, transparent); }

    /* System font stack */
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }

    /* Tab fade */
    main { animation: fadeIn .2s ease; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

    /* KPI top border variant */
    .kpi-card { border-top: 3px solid transparent; }
    .kpi-card-red    { border-top-color: #ef4444; }
    .kpi-card-orange { border-top-color: #f97316; }
    .kpi-card-blue   { border-top-color: #3b82f6; }
    .kpi-card-green  { border-top-color: #22c55e; }

    /* Loading skeleton */
    .skeleton { background: linear-gradient(90deg, var(--border) 25%, var(--panel) 50%, var(--border) 75%);
      background-size:200% 100%; animation: shimmer 1.5s infinite; border-radius:6px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* Better empty state */
    .empty-state {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:48px; color:var(--muted); gap:12px;
    }
    .empty-state-icon { font-size:48px; opacity:.3; }
    .empty-state-text { font-size:14px; }

    /* View toggle */
    .view-toggle { display:flex; gap:4px; }
    .view-toggle-btn {
      padding:5px 10px; border:1px solid var(--border); border-radius:6px;
      background:none; color:var(--muted); cursor:pointer; font-size:12px;
    }
    .view-toggle-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }

    /* Mangel list table */
    .mangel-list-table { width:100%; border-collapse:collapse; font-size:13px; }
    .mangel-list-table thead th {
      padding:8px 12px; font-size:10px; font-weight:700;
      text-transform:uppercase; letter-spacing:.06em; color:var(--muted);
      border-bottom:2px solid var(--border); background:var(--bg); position:sticky; top:0; z-index:1;
    }
    .ml-row { border-left:3px solid transparent; cursor:pointer; transition:background .12s; }
    .ml-row:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
    .ml-row td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
    .ml-row--red    { border-left-color: #ef4444; }
    .ml-row--orange { border-left-color: #f97316; }
    .ml-row--yellow { border-left-color: #eab308; }
    .ml-row--green  { border-left-color: #22c55e; }
    .ml-deadline-pill {
      display:inline-block; padding:2px 8px; border-radius:20px;
      font-size:11px; font-weight:800; white-space:nowrap;
    }
    .ml-expanded-row td { background:var(--bg); padding:12px 16px; }
    .ml-positionen { display:flex; flex-direction:column; gap:6px; }
    .ml-pos-item { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:8px 12px; font-size:12px; }

    /* Compact card grid */
    .mangel-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; margin-top:4px; }

    /* Print */
    @media print {
      .toolbar, #sidebar-mount, .topbar, .plan-filter-bar, #kpiWoche, .stat-grid-2 .stat-card:last-child { display:none!important; }
      .woche-summary-box { border:1px solid #ccc; }
      body { font-size:12px; }
    }
  `;
  document.head.appendChild(style);
})();

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function parseDE(str) {
  if (!str) return null;
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}
function fmtDE(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDEshort(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}
function cityOf(p) {
  const last = (p.address || "").split(",").pop()?.trim() || "";
  return last.replace(/^\d{4,5}\s*/, "").trim() || "Unbekannt";
}
function isAbgeschlossen(p) { return p.abgeschlossen === true || p.fortschritt >= 100; }
function getAbrList() {
  try { return new Set(JSON.parse(localStorage.getItem("inAbrechnung") || "[]")); }
  catch { return new Set(); }
}
function getAbrStatus(lws) { return localStorage.getItem(`inAbrStatus_${lws}`) || "collecting"; }
function today0() { const d = new Date(); d.setHours(0,0,0,0); return d; }

// ── Tab switching ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  const tabs = ["archiv","aktiv","mangel","woche"];
  tabs.forEach(t => {
    const id = "tab" + t.charAt(0).toUpperCase() + t.slice(1);
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("active", t === tab);
  });

  const archivMain  = document.querySelector("main:not(#aktivSection):not(#wocheSection):not(#mangelSection)");
  if (archivMain) archivMain.style.display = tab === "archiv" ? "flex" : "none";
  const aktivSection  = document.getElementById("aktivSection");
  const wocheSection  = document.getElementById("wocheSection");
  const mangelSection = document.getElementById("mangelSection");
  if (aktivSection)  aktivSection.style.display  = tab === "aktiv"  ? "flex" : "none";
  if (wocheSection)  wocheSection.style.display   = tab === "woche"  ? "flex" : "none";
  if (mangelSection) mangelSection.style.display  = tab === "mangel" ? "block" : "none";

  const yf = document.getElementById("yearFilter");
  if (yf) yf.style.display = tab === "archiv" ? "" : "none";

  if (tab === "aktiv")  renderAktiv();
  if (tab === "woche")  renderWoche();
  if (tab === "mangel") renderMangel();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — ALLE PROJEKTE
// ═══════════════════════════════════════════════════════════════════════════════

function applyFilters(projects) {
  return projects.filter(p => {
    if (filters.year) {
      const d = parseDE(p.ende);
      if (!d || d.getFullYear() !== +filters.year) return false;
    }
    if (filters.city && cityOf(p) !== filters.city) return false;
    if (filters.bauleiter && (p.bauleiter || "Unbekannt") !== filters.bauleiter) return false;
    if (filters.status && (p.status || "Unbekannt") !== filters.status) return false;
    if (filters.mangel) {
      const hasA = p.has_mangel;
      const hasR = (p.archiv_mangel_count || 0) > 0;
      if (filters.mangel === "aktiv"  && !(hasA && !hasR)) return false;
      if (filters.mangel === "archiv" && !(!hasA && hasR)) return false;
      if (filters.mangel === "beide"  && !(hasA && hasR))  return false;
      if (filters.mangel === "ohne"   && (hasA || hasR))   return false;
    }
    return true;
  });
}

function setFilter(key, val) {
  filters[key] = filters[key] === val ? null : val;
  render();
}

function renderFilterChips() {
  const labels = {
    year:      v => `Jahr: ${v}`,
    city:      v => `Stadt: ${v}`,
    bauleiter: v => `Bauleiter: ${v}`,
    status:    v => `Status: ${v}`,
    mangel:    v => ({ aktiv:"Mängel: aktiv", archiv:"Mängel: Archiv", beide:"Mängel: beide", ohne:"Ohne Mängel" }[v]),
  };
  const chips = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="filter-chip">${labels[k](v)}
      <button onclick="setFilter('${k}',null)" title="Entfernen">×</button>
    </span>`).join("");
  const bar = document.getElementById("filterChips");
  if (!bar) return;
  bar.innerHTML = chips
    ? `${chips}<button class="chip-reset" onclick="clearAllFilters()">Alle zurücksetzen</button>`
    : "";
}

function clearAllFilters() {
  Object.keys(filters).forEach(k => filters[k] = null);
  const yf = document.getElementById("yearFilter");
  if (yf) yf.value = "";
  render();
}

function renderKPI(projects) {
  const active    = projects.filter(p => !isAbgeschlossen(p) && !p.baustopp);
  const closed    = projects.filter(p => isAbgeschlossen(p));
  const baustopp  = projects.filter(p => p.baustopp);
  const volTotal  = projects.reduce((s, p) => s + (p.amount || 0), 0);
  const volActive = active.reduce((s, p) => s + (p.amount || 0), 0);
  const archivTotal = Object.values(archivMangelStats).reduce((s, n) => s + n, 0);
  document.getElementById("kpiRow").innerHTML = [
    { label: "Aktive Projekte",  value: active.length,      sub: fmtMoney(volActive) },
    { label: "Abgeschlossen",    value: closed.length,      sub: fmtMoney(closed.reduce((s,p)=>s+(p.amount||0),0)) },
    { label: "Gesamtvolumen",    value: fmtMoney(volTotal), sub: `${projects.length} Projekte` },
    { label: "Mängel",           value: allMaengel.length,  sub: `Archiv: ${archivTotal}` },
    { label: "BAUSTOPP",         value: baustopp.length,    sub: "eingefroren" },
    { label: "Ø Volumen",        value: fmtMoney(volTotal / (projects.length || 1)), sub: "je Projekt" },
  ].map(k => `<div class="kpi-card">
    <div class="kpi-val">${k.value}</div>
    <div class="kpi-label">${k.label}</div>
    <div class="kpi-sub">${k.sub}</div>
  </div>`).join("");
}

function barChart(containerId, items, { valueKey="amount", labelKey="label", color="var(--accent)",
    moneyFormat=true, filterKey=null, filterVal=null, activeVal=null } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...items.map(i => i[valueKey] || 0), 1);
  el.innerHTML = items.map(item => {
    const val = item[valueKey] || 0;
    const pct = Math.round((val / max) * 100);
    const label = moneyFormat ? fmtMoney(val) : val;
    const fv = filterVal ? item[filterVal] : item[labelKey];
    const isActive = activeVal === fv;
    const clickable = filterKey ? `onclick="setFilter('${filterKey}','${String(fv).replace(/'/g,"\\'")}') " style="cursor:pointer"` : "";
    return `<div class="bar-row ${isActive ? 'bar-row-active' : ''}" ${clickable}>
      <div class="bar-label">${item[labelKey]}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${pct}%;background:${isActive ? 'var(--accent)' : color};transition:width .3s"></div>
        <span class="bar-val">${label}</span>
      </div>
    </div>`;
  }).join("");
}

function renderMonthChart(projects) {
  const byMonth = {};
  projects.forEach(p => {
    const d = parseDE(p.ende);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!byMonth[key]) byMonth[key] = { label: key, amount: 0, count: 0 };
    byMonth[key].amount += p.amount || 0;
    byMonth[key].count++;
  });
  const items = Object.values(byMonth).sort((a,b) => a.label.localeCompare(b.label)).slice(-18);
  items.forEach(i => { i.label = i.label.replace(/(\d{4})-(\d{2})/, (_, y, m) =>
    new Date(+y, +m-1, 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" })); });
  barChart("chartMonth", items, { color: "#3b82f6" });
}

function renderCityCharts(projects) {
  const byCity = {};
  projects.forEach(p => {
    const c = cityOf(p);
    if (!byCity[c]) byCity[c] = { label: c, count: 0, amount: 0 };
    byCity[c].count++;
    byCity[c].amount += p.amount || 0;
  });
  const items = Object.values(byCity).sort((a,b) => b.count - a.count).slice(0,15);
  barChart("chartCity", items, { valueKey:"count", color:"#6366f1", moneyFormat:false,
    filterKey:"city", filterVal:"label", activeVal: filters.city });
  barChart("chartCityVol", [...items].sort((a,b)=>b.amount-a.amount), { color:"#8b5cf6",
    filterKey:"city", filterVal:"label", activeVal: filters.city });
}

function renderBauleiterChart(projects) {
  const byBL = {};
  projects.forEach(p => {
    const bl = p.bauleiter || "Unbekannt";
    if (!byBL[bl]) byBL[bl] = { label: bl, count: 0, amount: 0 };
    byBL[bl].count++;
    byBL[bl].amount += p.amount || 0;
  });
  const items = Object.values(byBL).sort((a,b)=>b.amount-a.amount).slice(0,15);
  const max = Math.max(...items.map(i=>i.amount),1);
  document.getElementById("chartBauleiter").innerHTML = items.map(i => {
    const isActive = filters.bauleiter === i.label;
    return `<div class="bar-row ${isActive?'bar-row-active':''}"
      onclick="setFilter('bauleiter','${i.label.replace(/'/g,"\\'")}') " style="cursor:pointer">
      <div class="bar-label">${i.label} <span class="bar-count">(${i.count})</span></div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(i.amount/max*100)}%;background:${isActive?'var(--accent)':'#10b981'};transition:width .3s"></div>
        <span class="bar-val">${fmtMoney(i.amount)}</span>
      </div>
    </div>`;
  }).join("");
}

function renderMangelChart(projects) {
  const mitAktiv  = projects.filter(p => p.has_mangel && !(p.archiv_mangel_count>0));
  const mitBeide  = projects.filter(p => p.has_mangel && p.archiv_mangel_count>0);
  const mitArchiv = projects.filter(p => !p.has_mangel && p.archiv_mangel_count>0);
  const ohne      = projects.filter(p => !p.has_mangel && !(p.archiv_mangel_count>0));
  const total = projects.length || 1;
  const archivAnzahl = projects.reduce((s,p)=>s+(p.archiv_mangel_count||0),0);
  const segs = [
    { key:"aktiv",  label:`Nur aktiv (${mitAktiv.length})`,   n:mitAktiv.length,  color:"#f59e0b" },
    { key:"beide",  label:`Aktiv+Archiv (${mitBeide.length})`, n:mitBeide.length,  color:"#8b5cf6" },
    { key:"archiv", label:`Nur Archiv (${mitArchiv.length})`,  n:mitArchiv.length, color:"#c4b5fd" },
    { key:"ohne",   label:`Ohne (${ohne.length})`,             n:ohne.length,      color:"#e5e7eb" },
  ];
  document.getElementById("chartMangel").innerHTML = `
    <div class="pie-row" style="cursor:pointer">
      ${segs.map(s=>`<div class="pie-seg ${filters.mangel===s.key?'pie-seg-active':''}"
        style="background:${s.color};width:${Math.round(s.n/total*100)}%;color:${s.key==='ohne'?'#666':'#333'}"
        onclick="setFilter('mangel','${s.key}')" title="${s.label}">${s.n>0?s.n:''}</div>`).join("")}
    </div>
    <div class="pie-legend">
      ${segs.map(s=>`<span class="${filters.mangel===s.key?'pie-legend-active':''}"
        onclick="setFilter('mangel','${s.key}')" style="cursor:pointer">
        <b style="color:${s.color}">■</b> ${s.label}</span>`).join("")}
    </div>
    <div style="margin-top:12px;font-size:13px;color:var(--muted)">
      Aktive: <b>${allMaengel.length}</b> &nbsp;|&nbsp; Archiv: <b>${archivAnzahl}</b>
    </div>`;
}

function renderAbrChart(projects) {
  const abrSet = getAbrList();
  const abrProjects = projects.filter(p => abrSet.has(p.lws));
  const stages = [
    { key:"collecting", label:"Dokumente sammeln", color:"#f59e0b" },
    { key:"ready",      label:"Bereit",            color:"#3b82f6" },
    { key:"submitted",  label:"Eingereicht",       color:"#8b5cf6" },
    { key:"approved",   label:"Genehmigt",         color:"#10b981" },
    { key:"invoiced",   label:"Rechnung gestellt", color:"#059669" },
  ];
  const counts = {};
  abrProjects.forEach(p => { const st=getAbrStatus(p.lws); counts[st]=(counts[st]||0)+1; });
  const total = abrProjects.length || 1;
  document.getElementById("chartAbr").innerHTML = `
    <div style="font-size:13px;color:var(--muted);margin-bottom:12px">In Abrechnung: <b>${abrProjects.length}</b></div>
    ${stages.map(s=>{const n=counts[s.key]||0; return `<div class="bar-row">
      <div class="bar-label">${s.label}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(n/total*100)}%;background:${s.color}"></div>
        <span class="bar-val">${n}</span>
      </div></div>`;}).join("")}`;
}

function renderStatusChart(projects) {
  const byStatus = {};
  projects.filter(p=>!isAbgeschlossen(p)&&!p.baustopp).forEach(p=>{
    const s=p.status||"Unbekannt";
    if (!byStatus[s]) byStatus[s]={label:s,count:0};
    byStatus[s].count++;
  });
  const items = Object.values(byStatus).sort((a,b)=>b.count-a.count);
  const colors = ["#3b6df0","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];
  const max = Math.max(...items.map(i=>i.count),1);
  document.getElementById("chartStatus").innerHTML = items.map((i,idx)=>`
    <div class="bar-row ${filters.status===i.label?'bar-row-active':''}"
      onclick="setFilter('status','${i.label.replace(/'/g,"\\'")}') " style="cursor:pointer">
      <div class="bar-label">${i.label}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(i.count/max*100)}%;background:${filters.status===i.label?'var(--accent)':colors[idx%colors.length]};transition:width .3s"></div>
        <span class="bar-val">${i.count}</span>
      </div></div>`).join("");
}

function fillYearFilter() {
  const years = [...new Set(allProjects.map(p=>{const d=parseDE(p.ende);return d?d.getFullYear():null}).filter(Boolean))].sort((a,b)=>b-a);
  const sel = document.getElementById("yearFilter");
  if (!sel) return;
  sel.innerHTML = `<option value="">Alle Jahre</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");
}

function render() {
  const projects = applyFilters(allProjects);
  renderFilterChips();
  renderKPI(projects);
  renderMonthChart(projects);
  renderCityCharts(projects);
  renderBauleiterChart(projects);
  renderMangelChart(projects);
  renderAbrChart(projects);
  renderStatusChart(projects);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — AKTIVE PROJEKTE
// ═══════════════════════════════════════════════════════════════════════════════

function getActiveProjects() {
  return allProjects.filter(p => !p.abgeschlossen && (p.fortschritt||0) < 100 &&
    !["Beendet","Abgeschlossen"].includes(p.status || ""));
}

function filterByPeriod(projects) {
  return projects.filter(p => {
    const d = parseDE(p.ende);
    if (!d) return false;
    if (planVon && d < planVon) return false;
    if (planBis && d > planBis) return false;
    return true;
  });
}

function resetPlanFilter() {
  planVon = planBis = null;
  const pv = document.getElementById("planVon");
  const pb = document.getElementById("planBis");
  if (pv) pv.value = "";
  if (pb) pb.value = "";
  renderAktiv();
}

function groupByMonth(projects) {
  const map = {};
  projects.forEach(p => {
    const d = parseDE(p.ende);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!map[key]) map[key] = { count: 0, amount: 0, projects: [] };
    map[key].count++;
    map[key].amount += p.amount || 0;
    map[key].projects.push(p);
  });
  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
}

function renderEndeMonthChart(projects) {
  const el = document.getElementById("chartEndeMonth");
  if (!el) return;
  const entries = groupByMonth(projects);
  if (!entries.length) { el.innerHTML = `<div class="empty-hint">Keine Projekte im gewählten Zeitraum</div>`; return; }
  const maxAmt = Math.max(...entries.map(([,v]) => v.amount));
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  el.innerHTML = entries.map(([key, val]) => {
    const [yr, mo] = key.split("-");
    const label = `${MONTHS_DE[+mo-1]} ${yr}`;
    const pct = maxAmt > 0 ? Math.max(4, Math.round((val.amount / maxAmt) * 100)) : 4;
    const isPast = key < thisMonth;
    const isCurrent = key === thisMonth;
    const color = isPast ? "#9ca3af" : isCurrent ? "#f59e0b" : "#10b981";
    const isActive = tableMonthFilter === key;
    const badge = isCurrent ? ` <span class="month-current-badge">aktuell</span>` : "";
    return `<div class="plan-month-row${isActive?' bar-row-active':''}" onclick="filterTableByMonth('${key}')">
      <div class="plan-month-label">${label}${badge}</div>
      <div class="plan-bar-wrap">
        <div class="plan-bar-fill" style="width:${pct}%;background:${color}">
          <span class="plan-bar-inner">${val.count} Proj.</span>
        </div>
      </div>
      <div class="plan-month-amount">${fmtMoney(val.amount)}</div>
    </div>`;
  }).join("");
}

function filterTableByMonth(key) {
  tableMonthFilter = tableMonthFilter === key ? null : key;
  renderAktiv();
}

function renderAktivTable(projects) {
  const el = document.getElementById("aktivTable");
  const titleEl = document.getElementById("aktivTableTitle");
  if (!el) return;
  let filtered = tableMonthFilter
    ? projects.filter(p => {
        const d = parseDE(p.ende);
        if (!d) return false;
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        return k === tableMonthFilter;
      })
    : projects;
  const [yr, mo] = tableMonthFilter ? tableMonthFilter.split("-") : [];
  if (titleEl) titleEl.textContent = tableMonthFilter
    ? `Projekte: ${MONTHS_DE[+mo-1]} ${yr} (${filtered.length})`
    : `Alle Projekte (${filtered.length})`;
  const sorted = [...filtered].sort((a,b) => {
    const da = parseDE(a.ende), db = parseDE(b.ende);
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return da - db;
  });
  const now = today0();
  el.innerHTML = sorted.length ? `
    <table class="aktiv-table">
      <thead><tr>
        <th>LWS</th><th>Adresse</th><th>Bauleiter</th>
        <th>Beginn</th><th>Fertig</th><th>Fortschritt</th><th>Summe</th>
      </tr></thead>
      <tbody>${sorted.map(p => {
        const d = parseDE(p.ende);
        const late = d && d < now;
        const soon = d && !late && (d - now) / 86400000 <= 14;
        const cls = late ? "row-late" : soon ? "row-soon" : "";
        return `<tr class="${cls}">
          <td><a href="${p.leo_url||'#'}" target="_blank">${p.lws||"—"}</a></td>
          <td style="max-width:220px">${p.address||"—"}</td>
          <td>${p.bauleiter||"—"}</td>
          <td>${p.start||"—"}</td>
          <td><b>${p.ende||"—"}</b></td>
          <td><div class="mini-progress"><div style="width:${p.fortschritt||0}%"></div></div>${p.fortschritt||0}%</td>
          <td><b>${fmtMoney(p.amount||0)}</b></td>
        </tr>`;
      }).join("")}</tbody>
    </table>` : `<div class="empty-hint">Keine Projekte</div>`;
}

function renderAktiv() {
  const allActive = getActiveProjects();
  const filtered = (planVon || planBis) ? filterByPeriod(allActive) : allActive;
  const totalAmount = filtered.reduce((s,p) => s + (p.amount||0), 0);
  const now = today0();
  const overdue = filtered.filter(p => { const d = parseDE(p.ende); return d && d < now; });
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const thisMonth = filtered.filter(p => {
    const d = parseDE(p.ende);
    if (!d) return false;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === thisMonthKey;
  });
  const infoEl = document.getElementById("planFilterInfo");
  if (infoEl) infoEl.textContent = (planVon || planBis)
    ? `Gefiltert: ${filtered.length} von ${allActive.length} Projekten`
    : `Gesamt: ${allActive.length} aktive Projekte`;
  document.getElementById("kpiAktiv").innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${filtered.length}</div><div class="kpi-label">Aktive Projekte</div></div>
    <div class="kpi-card"><div class="kpi-val">${fmtMoney(totalAmount)}</div><div class="kpi-label">Gesamtvolumen</div></div>
    <div class="kpi-card" style="${overdue.length ? 'border-left:3px solid #ef4444' : ''}">
      <div class="kpi-val" style="${overdue.length ? 'color:#ef4444' : ''}">${overdue.length}</div>
      <div class="kpi-label">Überfällig</div>
    </div>
    <div class="kpi-card" style="border-left:3px solid #f59e0b">
      <div class="kpi-val" style="color:#f59e0b">${thisMonth.length}</div>
      <div class="kpi-label">Fällig diesen Monat · ${fmtMoney(thisMonth.reduce((s,p)=>s+(p.amount||0),0))}</div>
    </div>
  `;
  renderEndeMonthChart(filtered);
  renderAktivTable(filtered);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — MÄNGEL (main feature)
// ═══════════════════════════════════════════════════════════════════════════════

function daysUntil(dateDE) {
  if (!dateDE) return null;
  const d = parseDE(dateDE);
  if (!d) return null;
  const now = today0();
  return Math.round((d - now) / 86400000);
}

function deadlineBadgeHTML(m) {
  const days = daysUntil(m.fertigstellung);
  const isPrueft = m.mangel_status === "geprueft";
  if (days === null) return `<div class="mangel-deadline-badge"><span class="deadline-pill none">Kein Datum</span></div>`;
  let pillClass, text;
  if (isPrueft) {
    pillClass = "green";
    text = "✅ Geprüft";
  } else if (days < 0) {
    pillClass = "red";
    text = `${Math.abs(days)} Tage überfällig`;
  } else if (days <= 7) {
    pillClass = days === 0 ? "orange" : "orange";
    text = days === 0 ? "Heute fällig" : `${days} Tage`;
  } else if (days <= 14) {
    pillClass = "yellow";
    text = `${days} Tage`;
  } else {
    pillClass = "green";
    text = `${days} Tage`;
  }
  const dateLine = m.fertigstellung ? `<div class="deadline-date">Fällig: ${m.fertigstellung}</div>` : "";
  return `<div class="mangel-deadline-badge">
    <span class="deadline-pill ${pillClass}">${text}</span>
    ${dateLine}
  </div>`;
}

function statusBadge(ms) {
  const map = {
    offen:     ["mbadge-offen",     "🔴 Offen"],
    behoben:   ["mbadge-behoben",   "🟡 Behoben"],
    teilweise: ["mbadge-teilweise", "🟠 Teilweise"],
    geprueft:  ["mbadge-geprueft",  "✅ Geprüft"],
    unknown:   ["mbadge-unknown",   "—"],
  };
  const [cls, label] = map[ms] || ["mbadge-unknown", ms || "—"];
  return `<span class="mbadge ${cls}">${label}</span>`;
}

function getAssignmentBadge(id) {
  try {
    const raw = localStorage.getItem("assign_" + id);
    if (!raw) return "";
    const a = JSON.parse(raw);
    const parts = [];
    if (a.manager)   parts.push(`<span class="mbadge mbadge-assign">👤 ${a.manager}</span>`);
    if (a.techniker) parts.push(`<span class="mbadge mbadge-assign">🔧 ${a.techniker}</span>`);
    if (a.sentAt && !a.date_finished) parts.push(`<span class="mbadge" style="background:#dbeafe;color:#1d4ed8">🔵 In Arbeit</span>`);
    if (a.date_finished) parts.push(`<span class="mbadge" style="background:#dcfce7;color:#166534">✓ Fertig ${a.date_finished}</span>`);
    return parts.join("");
  } catch { return ""; }
}

function buildMangelFilterBar() {
  const bar = document.getElementById("mangelFilterBar");
  if (!bar) return;

  // Collect unique Bauleiter
  const bls = [...new Set(allMaengel.map(m => m.bauleiter).filter(Boolean))].sort();

  bar.innerHTML = `
    <div class="plan-filter-group">
      <label>Suche</label>
      <input type="text" id="mfSearch" placeholder="Adresse, ID, Bauleiter…" style="width:200px"
        value="${mangelFilters.search}" oninput="mangelFilters.search=this.value; renderMangel()">
    </div>
    <div class="plan-filter-group">
      <label>Bauleiter</label>
      <select id="mfBauleiter" onchange="mangelFilters.bauleiter=this.value; renderMangel()">
        <option value="">Alle</option>
        ${bls.map(b=>`<option value="${b}" ${mangelFilters.bauleiter===b?'selected':''}>${b}</option>`).join("")}
      </select>
    </div>
    <div class="plan-filter-group">
      <label>Status</label>
      <select id="mfStatus" onchange="mangelFilters.status=this.value; renderMangel()">
        <option value="">Alle</option>
        <option value="offen" ${mangelFilters.status==='offen'?'selected':''}>Offen</option>
        <option value="behoben" ${mangelFilters.status==='behoben'?'selected':''}>Behoben</option>
        <option value="teilweise" ${mangelFilters.status==='teilweise'?'selected':''}>Teilweise</option>
        <option value="geprueft" ${mangelFilters.status==='geprueft'?'selected':''}>Geprüft</option>
      </select>
    </div>
    <div class="plan-filter-group">
      <label>Fälligkeit</label>
      <select id="mfFaellig" onchange="mangelFilters.faelligkeit=this.value; renderMangel()">
        <option value="">Alle</option>
        <option value="ueberfaellig" ${mangelFilters.faelligkeit==='ueberfaellig'?'selected':''}>Überfällig</option>
        <option value="heute" ${mangelFilters.faelligkeit==='heute'?'selected':''}>Heute fällig</option>
        <option value="le3" ${mangelFilters.faelligkeit==='le3'?'selected':''}>≤3 Tage</option>
        <option value="le7" ${mangelFilters.faelligkeit==='le7'?'selected':''}>≤7 Tage</option>
        <option value="le14" ${mangelFilters.faelligkeit==='le14'?'selected':''}>≤14 Tage</option>
        <option value="gt14" ${mangelFilters.faelligkeit==='gt14'?'selected':''}>＞14 Tage</option>
      </select>
    </div>
    <div class="plan-filter-group">
      <label>Sortierung</label>
      <select id="mfSort" onchange="mangelFilters.sort=this.value; renderMangel()">
        <option value="faellig" ${mangelFilters.sort==='faellig'?'selected':''}>Fälligste zuerst</option>
        <option value="newest" ${mangelFilters.sort==='newest'?'selected':''}>Neueste zuerst</option>
        <option value="oldest" ${mangelFilters.sort==='oldest'?'selected':''}>Älteste zuerst</option>
        <option value="address" ${mangelFilters.sort==='address'?'selected':''}>Nach Adresse</option>
      </select>
    </div>
    <div class="plan-filter-group" style="align-self:flex-end">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="mfNeu" ${mangelFilters.neu?'checked':''}
          onchange="mangelFilters.neu=this.checked; renderMangel()">
        Neu (≤7d)
      </label>
    </div>
    <div class="plan-filter-group" style="align-self:flex-end">
      <div class="view-toggle">
        <button class="view-toggle-btn ${mangelView==='list'?'active':''}" onclick="setMangelView('list')">☰ Liste</button>
        <button class="view-toggle-btn ${mangelView==='card'?'active':''}" onclick="setMangelView('card')">🃏 Karten</button>
      </div>
    </div>
    <button class="plan-btn-reset" onclick="resetMangelFilters()">× Filter zurücksetzen</button>
  `;
}

function setMangelView(v) {
  mangelView = v;
  buildMangelFilterBar();
  renderMangel();
}

function resetMangelFilters() {
  mangelFilters = { search:"", bauleiter:"", status:"", faelligkeit:"", sort:"faellig", neu: false };
  buildMangelFilterBar();
  renderMangel();
}

function applyMangelFilters(maengel) {
  return maengel.filter(m => {
    const q = mangelFilters.search.toLowerCase();
    if (q) {
      const hay = `${m.address||""} ${m.id||""} ${m.bauleiter||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (mangelFilters.bauleiter && m.bauleiter !== mangelFilters.bauleiter) return false;
    if (mangelFilters.status && m.mangel_status !== mangelFilters.status) return false;
    if (mangelFilters.neu) {
      const sevenAgo = new Date(today0()); sevenAgo.setDate(sevenAgo.getDate() - 7);
      if (!m.first_seen || new Date(m.first_seen) < sevenAgo) return false;
    }
    if (mangelFilters.faelligkeit) {
      const days = daysUntil(m.fertigstellung);
      const isPrueft = m.mangel_status === "geprueft";
      const f = mangelFilters.faelligkeit;
      if (f === "ueberfaellig" && (days === null || days >= 0 || isPrueft)) return false;
      if (f === "heute"        && (days === null || days !== 0)) return false;
      if (f === "le3"          && (days === null || days < 0 || days > 3)) return false;
      if (f === "le7"          && (days === null || days < 0 || days > 7)) return false;
      if (f === "le14"         && (days === null || days < 0 || days > 14)) return false;
      if (f === "gt14"         && (days === null || days <= 14)) return false;
    }
    return true;
  });
}

function sortMaengel(maengel) {
  const copy = [...maengel];
  if (mangelFilters.sort === "faellig") {
    copy.sort((a,b) => {
      const da = daysUntil(a.fertigstellung) ?? 9999;
      const db = daysUntil(b.fertigstellung) ?? 9999;
      return da - db;
    });
  } else if (mangelFilters.sort === "newest") {
    copy.sort((a,b) => (b.first_seen||"").localeCompare(a.first_seen||""));
  } else if (mangelFilters.sort === "oldest") {
    copy.sort((a,b) => (a.first_seen||"").localeCompare(b.first_seen||""));
  } else if (mangelFilters.sort === "address") {
    copy.sort((a,b) => (a.address||"").localeCompare(b.address||""));
  }
  return copy;
}

function renderMangelKPI() {
  const now = today0();
  const total = allMaengel.length;
  const ueberfaellig = allMaengel.filter(m => {
    const d = parseDE(m.fertigstellung);
    return d && d < now && m.mangel_status !== "geprueft";
  }).length;
  const le7 = allMaengel.filter(m => {
    const days = daysUntil(m.fertigstellung);
    return days !== null && days >= 0 && days <= 7 && m.mangel_status !== "geprueft";
  }).length;
  const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 7);
  const neuWoche = allMaengel.filter(m => {
    if (!m.first_seen) return false;
    const d = new Date(m.first_seen);
    return d >= sevenAgo && d <= now;
  }).length;
  const geprueft = allMaengel.filter(m => m.mangel_status === "geprueft").length;

  document.getElementById("kpiMangel").innerHTML = [
    { label:"Gesamt aktive Mängel", value: total,       sub: "in Bearbeitung",        cls: "" },
    { label:"Überfällig",           value: ueberfaellig, sub: "Deadline überschritten", cls: "kpi-card-red",    valColor:"color:#b91c1c" },
    { label:"Fällig in ≤7 Tagen",   value: le7,          sub: "dringend",              cls: "kpi-card-orange", valColor:"color:#d97706" },
    { label:"Neu diese Woche",      value: neuWoche,     sub: "first_seen <7d",        cls: "kpi-card-blue",   valColor:"color:#2563eb" },
    { label:"Geprüft ✅",            value: geprueft,     sub: "abgeschlossen",         cls: "kpi-card-green",  valColor:"color:#16a34a" },
  ].map(k => `<div class="kpi-card ${k.cls}">
    <div class="kpi-val" style="${k.valColor||''}">${k.value}</div>
    <div class="kpi-label">${k.label}</div>
    <div class="kpi-sub">${k.sub}</div>
  </div>`).join("");
}

function renderMangelCard(m) {
  const posCount = (m.positionen || []).length;
  const assignBadge = getAssignmentBadge(m.id);
  const fortschritt = m.fortschritt || 0;
  const progressRow = fortschritt > 0 ? `
    <div class="mangel-progress-row">
      <div class="mangel-progress-bar"><div class="mangel-progress-fill" style="width:${fortschritt}%"></div></div>
      <div class="mangel-progress-pct">${fortschritt}%</div>
    </div>` : "";

  return `<div class="mangel-card">
    <div class="mangel-card-head">
      <div style="flex:1;min-width:0">
        <div class="mangel-address">${m.address || "—"}</div>
        <div class="mangel-lage">${m.lage || ""}</div>
      </div>
      ${deadlineBadgeHTML(m)}
    </div>
    <div class="mangel-meta">
      <span>Bauleiter: <b>${m.bauleiter || "—"}</b></span>
      ${m.innendienst ? `<span>Innendienst: <b>${m.innendienst}</b></span>` : ""}
    </div>
    <div class="mangel-dates">
      Beginn: <span>${m.ausfuehrungsbeginn || "—"}</span>
      &nbsp;→&nbsp;
      Fällig: <span>${m.fertigstellung || "—"}</span>
    </div>
    <div class="mangel-badges">
      ${statusBadge(m.mangel_status)}
      ${posCount > 0 ? `<span class="mbadge mbadge-pos">${posCount} Position${posCount>1?'en':''}</span>` : ""}
      ${assignBadge}
    </div>
    ${progressRow}
    <div class="mangel-footer">
      <span style="font-size:11px;color:var(--muted)">${m.id || ""}</span>
      <a href="${m.leo_url || '#'}" target="_blank" class="btn-leo">Zur LEO →</a>
    </div>
  </div>`;
}

function deadlineRowClass(m) {
  const days = daysUntil(m.fertigstellung);
  if (days === null) return "";
  if (days < 0) return "ml-row--red";
  if (days <= 3) return "ml-row--red";
  if (days <= 7) return "ml-row--orange";
  if (days <= 14) return "ml-row--yellow";
  return "ml-row--green";
}

function deadlinePillHTML(m) {
  const days = daysUntil(m.fertigstellung);
  if (days === null) return `<span class="ml-deadline-pill" style="background:var(--bg);color:var(--muted)">—</span>`;
  if (days < 0) return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">${Math.abs(days)}d !</span>`;
  if (days === 0) return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">Heute</span>`;
  if (days <= 3) return `<span class="ml-deadline-pill" style="background:#fee2e2;color:#b91c1c">${days}d</span>`;
  if (days <= 7) return `<span class="ml-deadline-pill" style="background:#ffedd5;color:#c2410c">${days}d</span>`;
  if (days <= 14) return `<span class="ml-deadline-pill" style="background:#fef9c3;color:#854d0e">${days}d</span>`;
  return `<span class="ml-deadline-pill" style="background:#dcfce7;color:#166534">${days}d</span>`;
}

function toggleMangelRow(id) {
  if (mangelExpanded.has(id)) {
    mangelExpanded.delete(id);
  } else {
    mangelExpanded.add(id);
  }
  const expRow = document.getElementById("expand-" + id);
  if (expRow) {
    expRow.style.display = mangelExpanded.has(id) ? "" : "none";
    return;
  }
  // Re-render if row not found
  renderMangel();
}

function renderMangelListView(filtered) {
  if (!filtered.length) {
    return `<div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-text">Keine Mängel gefunden</div>
    </div>`;
  }
  const rows = filtered.map(m => {
    const rowCls = deadlineRowClass(m);
    const posCount = (m.positionen || []).length;
    const assignBadge = getAssignmentBadge(m.id);
    const expanded = mangelExpanded.has(m.id);
    const pos = m.positionen || [];
    const expandedRow = expanded ? `<tr class="ml-expanded-row" id="expand-${m.id}">
      <td colspan="7">
        <div class="ml-positionen">
          ${pos.length
            ? pos.map(p => `<div class="ml-pos-item">
                <b>${p.gewerk || "—"}</b> · ${p.status || "—"} · <span style="color:var(--muted)">${p.mangel_beschreibung || ""}</span>
              </div>`).join("")
            : `<div style="color:var(--muted);font-size:12px">Keine Positionen</div>`}
        </div>
      </td>
    </tr>` : `<tr class="ml-expanded-row" id="expand-${m.id}" style="display:none">
      <td colspan="7">
        <div class="ml-positionen">
          ${pos.length
            ? pos.map(p => `<div class="ml-pos-item">
                <b>${p.gewerk || "—"}</b> · ${p.status || "—"} · <span style="color:var(--muted)">${p.mangel_beschreibung || ""}</span>
              </div>`).join("")
            : `<div style="color:var(--muted);font-size:12px">Keine Positionen</div>`}
        </div>
      </td>
    </tr>`;
    return `<tr class="ml-row ${rowCls}" onclick="toggleMangelRow('${m.id}')">
      <td>${deadlinePillHTML(m)}</td>
      <td>
        <div style="font-weight:700;font-size:13px">${m.address || "—"}</div>
        <div style="font-size:11px;color:var(--muted)">${m.id || ""} ${m.lage ? "· " + m.lage : ""}</div>
      </td>
      <td style="font-size:12px">${m.bauleiter || "—"}</td>
      <td>${statusBadge(m.mangel_status)}</td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">
        ${m.ausfuehrungsbeginn || "—"}<br>→ ${m.fertigstellung || "—"}
      </td>
      <td style="font-size:11px">${assignBadge || `<span style="color:var(--muted)">—</span>`}</td>
      <td><a href="${m.leo_url || '#'}" target="_blank" class="btn-leo" onclick="event.stopPropagation()">→</a></td>
    </tr>${expandedRow}`;
  }).join("");

  return `<table class="mangel-list-table">
    <thead><tr>
      <th style="width:80px">Fällig</th>
      <th>Adresse</th>
      <th style="width:130px">Bauleiter</th>
      <th style="width:90px">Status</th>
      <th style="width:120px">Beginn/Ende</th>
      <th style="width:120px">Beauftragt</th>
      <th style="width:40px"></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderMangel() {
  renderMangelKPI();

  let filtered = applyMangelFilters(allMaengel);
  filtered = sortMaengel(filtered);

  const grid = document.getElementById("mangelGrid");
  if (!grid) return;

  if (mangelView === "list") {
    grid.style.display = "block";
    grid.style.gridTemplateColumns = "";
    grid.style.gap = "";
    grid.innerHTML = renderMangelListView(filtered);
    return;
  }

  // Card view
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill,minmax(300px,1fr))";
  grid.style.gap = "16px";

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-text">Keine Mängel gefunden</div>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderMangelCard).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — WOCHENBERICHT
// ═══════════════════════════════════════════════════════════════════════════════

function getWochePeriod(offset) {
  const now = new Date();
  const dow = now.getDay();
  const daysToLastWed = (dow - 3 + 7) % 7;
  const lastWed = new Date(now);
  lastWed.setDate(now.getDate() - daysToLastWed + offset * 7);
  lastWed.setHours(23, 59, 59, 0);
  const prevTue = new Date(lastWed);
  prevTue.setDate(lastWed.getDate() - 6);
  prevTue.setHours(0, 0, 0, 0);
  return { von: prevTue, bis: lastWed };
}

function getKW(d) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d - startOfWeek1;
  return Math.ceil((diff / 86400000 + 1) / 7);
}

function wocheNavPrev() { wocheOffset--; renderWoche(); }
function wocheNavNext() { if (wocheOffset < 0) { wocheOffset++; renderWoche(); } }

function renderWocheList(items, containerId, redMode) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty-hint">Keine Einträge</div>`; return; }
  el.innerHTML = `<div class="woche-list-col">${items.map(m => {
    const days = daysUntil(m.fertigstellung);
    let sub = "";
    if (redMode) {
      sub = days !== null ? `<span class="woche-list-red">${Math.abs(days)} Tage überfällig</span>` : "";
    } else {
      sub = days !== null
        ? (days < 0 ? `<span class="woche-list-red">${Math.abs(days)} Tage überfällig</span>`
           : `Fällig in ${days} Tage${days!==1?'n':''}`)
        : "";
    }
    return `<div class="woche-list-item">
      <div class="woche-list-id">${m.id||"—"}</div>
      <div class="woche-list-addr">${m.address||"—"}</div>
      <div class="woche-list-sub">${sub}${m.bauleiter ? ` · ${m.bauleiter}` : ""}</div>
    </div>`;
  }).join("")}</div>`;
}

function renderWoche() {
  const { von, bis } = getWochePeriod(wocheOffset);
  const now = today0();
  const kw = getKW(bis);

  document.getElementById("wochePeriod").textContent =
    `KW ${kw}: ${fmtDEshort(von)} – ${fmtDE(bis)}`;
  const nextBtn = document.getElementById("btnWocheNext");
  if (nextBtn) nextBtn.disabled = wocheOffset >= 0;

  // Neue Mängel in period (by first_seen)
  const neue = allMaengel.filter(m => {
    if (!m.first_seen) return false;
    const d = new Date(m.first_seen);
    return d >= von && d <= bis;
  });

  // Überfällig: fertigstellung < today AND not geprueft
  const ueberfaellig = allMaengel.filter(m => {
    if (m.mangel_status === "geprueft") return false;
    const d = parseDE(m.fertigstellung);
    return d && d < now;
  });

  // New projects this period (by start date)
  const neueProjekte = allProjects.filter(p => {
    const d = parseDE(p.start);
    return d && d >= von && d <= bis;
  });
  const fertigProjekte = allProjects.filter(p => {
    const d = parseDE(p.ende);
    return d && d >= von && d <= bis && isAbgeschlossen(p);
  });

  document.getElementById("neueCount").textContent = neue.length;
  document.getElementById("uebCount").textContent  = ueberfaellig.length;

  // KPI
  const openAll = allMaengel.filter(m => m.mangel_status !== "geprueft");
  document.getElementById("kpiWoche").innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${allMaengel.length}</div><div class="kpi-label">Gesamt aktive Mängel</div></div>
    <div class="kpi-card" style="border-left:3px solid #3b82f6"><div class="kpi-val" style="color:#2563eb">${neue.length}</div><div class="kpi-label">Neu diese Woche</div></div>
    <div class="kpi-card" style="border-left:3px solid #ef4444"><div class="kpi-val" style="color:#ef4444">${ueberfaellig.length}</div><div class="kpi-label">Überfällig</div></div>
    <div class="kpi-card"><div class="kpi-val">${openAll.filter(m=>m.mangel_status==="offen").length}</div><div class="kpi-label">Noch offen</div></div>
  `;

  // Summary box
  const summaryEl = document.getElementById("wocheSummary");
  if (summaryEl) {
    const neuVol = neueProjekte.reduce((s,p)=>s+(p.amount||0),0);
    const fertigVol = fertigProjekte.reduce((s,p)=>s+(p.amount||0),0);
    summaryEl.innerHTML = `
      <div class="woche-summary-box">
        <div style="font-size:13px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
          Wochenbericht KW ${kw} &nbsp;—&nbsp; ${fmtDEshort(von)} bis ${fmtDE(bis)}
        </div>
        <table>
          <tr><td>Neue Mängel diese Woche</td><td>${neue.length}</td><td></td></tr>
          <tr><td>Neue Projekte</td><td>${neueProjekte.length}</td><td>${neuVol>0?fmtMoney(neuVol):''}</td></tr>
          <tr><td>Überfällig</td><td style="color:#b91c1c">${ueberfaellig.length}</td><td style="color:#b91c1c;font-size:12px">Mängel</td></tr>
          <tr><td>Fertig diese Woche</td><td>${fertigProjekte.length}</td><td>${fertigVol>0?fmtMoney(fertigVol):''}</td></tr>
        </table>
      </div>`;
  }

  renderWocheList(neue,         "wocheNeueList", false);
  renderWocheList(ueberfaellig, "wocheUebList",  true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects       = data.projects || [];
      allMaengel        = data.maengel  || [];
      archivMangelStats = data.archiv_mangel_stats || {};
      archivMaengelList = data.archiv_maengel || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      const sub = document.getElementById("pageSub");
      if (sub) sub.textContent = upd ? `Stand: ${upd}` : "";
      fillYearFilter();
      buildMangelFilterBar();
      render();
    })
    .catch(err => console.error("data.json load error:", err));

  const yf = document.getElementById("yearFilter");
  if (yf) yf.addEventListener("change", e => {
    filters.year = e.target.value || null;
    render();
  });

  const pv = document.getElementById("planVon");
  if (pv) pv.addEventListener("change", e => {
    planVon = e.target.value ? new Date(e.target.value) : null;
    tableMonthFilter = null;
    renderAktiv();
  });

  const pb = document.getElementById("planBis");
  if (pb) pb.addEventListener("change", e => {
    planBis = e.target.value ? new Date(e.target.value + "T23:59:59") : null;
    tableMonthFilter = null;
    renderAktiv();
  });
});
