let allProjects = [];
let allMaengel = [];
let archivMangelStats = {};
let archivMaengelList = [];

// Активные фильтры
let filters = {
  year:      null,
  city:      null,
  bauleiter: null,
  status:    null,
  mangel:    null, // "aktiv" | "archiv" | "beide" | "ohne"
};

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

// ── Применяем фильтры ────────────────────────────────────────────────────────
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

// ── Чипы активных фильтров ───────────────────────────────────────────────────
function renderFilterChips() {
  const labels = {
    year: v => `Jahr: ${v}`,
    city: v => `Stadt: ${v}`,
    bauleiter: v => `Bauleiter: ${v}`,
    status: v => `Status: ${v}`,
    mangel: v => ({ aktiv:"Mängel: aktiv", archiv:"Mängel: Archiv", beide:"Mängel: beide", ohne:"Ohne Mängel" }[v]),
  };
  const chips = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="filter-chip">${labels[k](v)}
      <button onclick="setFilter('${k}',null)" title="Entfernen">×</button>
    </span>`).join("");
  const bar = document.getElementById("filterChips");
  bar.innerHTML = chips
    ? `${chips}<button class="chip-reset" onclick="clearAllFilters()">Alle zurücksetzen</button>`
    : "";
}

function clearAllFilters() {
  Object.keys(filters).forEach(k => filters[k] = null);
  document.getElementById("yearFilter").value = "";
  render();
}

// ── KPI ──────────────────────────────────────────────────────────────────────
function renderKPI(projects) {
  const active   = projects.filter(p => !isAbgeschlossen(p) && !p.baustopp);
  const closed   = projects.filter(p => isAbgeschlossen(p));
  const baustopp = projects.filter(p => p.baustopp);
  const volTotal  = projects.reduce((s, p) => s + (p.amount || 0), 0);
  const volActive = active.reduce((s, p) => s + (p.amount || 0), 0);
  const archivTotal = Object.values(archivMangelStats).reduce((s, n) => s + n, 0);

  document.getElementById("kpiRow").innerHTML = [
    { label: "Aktive Projekte",   value: active.length,      sub: fmtMoney(volActive) },
    { label: "Abgeschlossen",     value: closed.length,      sub: fmtMoney(closed.reduce((s,p)=>s+(p.amount||0),0)) },
    { label: "Gesamtvolumen",     value: fmtMoney(volTotal), sub: `${projects.length} Projekte` },
    { label: "Mängel",            value: allMaengel.length,  sub: `Archiv: ${archivTotal}` },
    { label: "BAUSTOP",           value: baustopp.length,    sub: "eingefroren" },
    { label: "Ø Volumen",         value: fmtMoney(volTotal / (projects.length || 1)), sub: "je Projekt" },
  ].map(k => `<div class="kpi-card"><div class="kpi-value">${k.value}</div>
    <div class="kpi-label">${k.label}</div><div class="kpi-sub">${k.sub}</div></div>`).join("");
}

// ── Бар-чарт с кликом ────────────────────────────────────────────────────────
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
    const clickable = filterKey ? `onclick="setFilter('${filterKey}','${fv.replace(/'/g,"\\'")}'')" style="cursor:pointer"` : "";
    return `<div class="bar-row ${isActive ? 'bar-row-active' : ''}" ${clickable}>
      <div class="bar-label">${item[labelKey]}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${pct}%;background:${isActive ? 'var(--accent)' : color};transition:width .3s"></div>
        <span class="bar-val">${label}</span>
      </div>
    </div>`;
  }).join("");
}

// ── Графики ───────────────────────────────────────────────────────────────────
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
      onclick="setFilter('bauleiter','${i.label.replace(/'/g,"\\'")}'')" style="cursor:pointer">
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
      onclick="setFilter('status','${i.label.replace(/'/g,"\\'")}'')" style="cursor:pointer">
      <div class="bar-label">${i.label}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(i.count/max*100)}%;background:${filters.status===i.label?'var(--accent)':colors[idx%colors.length]};transition:width .3s"></div>
        <span class="bar-val">${i.count}</span>
      </div></div>`).join("");
}

function fillYearFilter() {
  const years = [...new Set(allProjects.map(p=>{const d=parseDE(p.ende);return d?d.getFullYear():null}).filter(Boolean))].sort((a,b)=>b-a);
  const sel = document.getElementById("yearFilter");
  sel.innerHTML = `<option value="">Alle Jahre</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");
}

// ── Главный рендер ────────────────────────────────────────────────────────────
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

document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects       = data.projects || [];
      allMaengel        = data.maengel  || [];
      archivMangelStats = data.archiv_mangel_stats || {};
      archivMaengelList = data.archiv_maengel || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";
      fillYearFilter();
      render();
    });

  document.getElementById("yearFilter").addEventListener("change", e => {
    filters.year = e.target.value || null;
    render();
  });
});
