let allProjects = [];
let allMaengel = [];
let selectedYear = null;

function fmtMoney(n) {
  if (!n) return "—";
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

function isAbgeschlossen(p) {
  return p.abgeschlossen === true || p.fortschritt >= 100;
}

// Abrechnung localStorage
function getAbrList() {
  try { return new Set(JSON.parse(localStorage.getItem("inAbrechnung") || "[]")); }
  catch { return new Set(); }
}
function getAbrStatus(lws) {
  return localStorage.getItem(`inAbrStatus_${lws}`) || "collecting";
}

// ── Рендер ──────────────────────────────────────────────────────────────────

function renderKPI(projects) {
  const active   = projects.filter(p => !isAbgeschlossen(p) && !p.baustopp);
  const closed   = projects.filter(p => isAbgeschlossen(p));
  const baustopp = projects.filter(p => p.baustopp);
  const volTotal = projects.reduce((s, p) => s + (p.amount || 0), 0);
  const volActive = active.reduce((s, p) => s + (p.amount || 0), 0);
  const withMangel = projects.filter(p => p.has_mangel).length;

  document.getElementById("kpiRow").innerHTML = [
    { label: "Aktive Projekte",    value: active.length,         sub: fmtMoney(volActive) },
    { label: "Abgeschlossen",      value: closed.length,         sub: fmtMoney(closed.reduce((s,p)=>s+(p.amount||0),0)) },
    { label: "Gesamtvolumen",      value: fmtMoney(volTotal),    sub: `${projects.length} Projekte` },
    { label: "Mit Mängelauftrag",  value: withMangel,            sub: `${Math.round(withMangel/projects.length*100)||0}% aller Projekte` },
    { label: "BAUSTOP",            value: baustopp.length,       sub: "aktuell eingefroren" },
    { label: "Ø Volumen/Projekt",  value: fmtMoney(volTotal / (projects.length || 1)), sub: "über alle Projekte" },
  ].map(k => `
    <div class="kpi-card">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join("");
}

function barChart(container, items, { valueKey = "amount", labelKey = "label", color = "var(--accent)", moneyFormat = true } = {}) {
  const max = Math.max(...items.map(i => i[valueKey] || 0), 1);
  container.innerHTML = items.map(item => {
    const val = item[valueKey] || 0;
    const pct = Math.round((val / max) * 100);
    const label = moneyFormat ? fmtMoney(val) : val;
    return `
      <div class="bar-row">
        <div class="bar-label">${item[labelKey]}</div>
        <div class="bar-wrap">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
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
    new Date(+y, +m-1, 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" })
  ); });
  barChart(document.getElementById("chartMonth"), items, { valueKey: "amount", color: "var(--accent)" });
}

function renderCityCharts(projects) {
  const byCity = {};
  projects.forEach(p => {
    const c = cityOf(p);
    if (!byCity[c]) byCity[c] = { label: c, count: 0, amount: 0 };
    byCity[c].count++;
    byCity[c].amount += p.amount || 0;
  });
  const items = Object.values(byCity).sort((a,b) => b.count - a.count).slice(0, 15);

  barChart(document.getElementById("chartCity"), items,
    { valueKey: "count", color: "#6366f1", moneyFormat: false });
  barChart(document.getElementById("chartCityVol"), [...items].sort((a,b)=>b.amount-a.amount),
    { valueKey: "amount", color: "#8b5cf6" });
}

function renderBauleiterChart(projects) {
  const byBL = {};
  projects.forEach(p => {
    const bl = p.bauleiter || "Unbekannt";
    if (!byBL[bl]) byBL[bl] = { label: bl, count: 0, amount: 0 };
    byBL[bl].count++;
    byBL[bl].amount += p.amount || 0;
  });
  const items = Object.values(byBL).sort((a,b) => b.amount - a.amount).slice(0, 15);
  const max = Math.max(...items.map(i => i.amount), 1);
  document.getElementById("chartBauleiter").innerHTML = items.map(i => `
    <div class="bar-row">
      <div class="bar-label">${i.label} <span class="bar-count">(${i.count})</span></div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(i.amount/max*100)}%;background:#10b981"></div>
        <span class="bar-val">${fmtMoney(i.amount)}</span>
      </div>
    </div>`).join("");
}

function renderMangelChart(projects) {
  const mit    = projects.filter(p => p.has_mangel).length;
  const ohne   = projects.filter(p => !p.has_mangel).length;
  const total  = mit + ohne || 1;
  document.getElementById("chartMangel").innerHTML = `
    <div class="pie-row">
      <div class="pie-seg" style="background:#f59e0b;width:${Math.round(mit/total*100)}%">${mit} mit</div>
      <div class="pie-seg" style="background:#e5e7eb;width:${Math.round(ohne/total*100)}%">${ohne} ohne</div>
    </div>
    <div class="pie-legend">
      <span><b style="color:#f59e0b">■</b> Mit Mängelauftrag: ${mit} (${Math.round(mit/total*100)}%)</span>
      <span><b style="color:#9ca3af">■</b> Ohne: ${ohne} (${Math.round(ohne/total*100)}%)</span>
    </div>
    <div style="margin-top:16px;font-size:13px;color:var(--muted)">
      Mängelaufträge gesamt: <b>${allMaengel.length}</b>
    </div>`;
}

function renderAbrChart(projects) {
  const abrSet = getAbrList();
  const abrProjects = projects.filter(p => abrSet.has(p.lws));
  const stages = [
    { key: "collecting", label: "Dokumente sammeln", color: "#f59e0b" },
    { key: "ready",      label: "Bereit",            color: "#3b82f6" },
    { key: "submitted",  label: "Eingereicht",       color: "#8b5cf6" },
    { key: "approved",   label: "Genehmigt",         color: "#10b981" },
    { key: "invoiced",   label: "Rechnung gestellt", color: "#059669" },
  ];
  const counts = {};
  abrProjects.forEach(p => {
    const st = getAbrStatus(p.lws);
    counts[st] = (counts[st] || 0) + 1;
  });
  const total = abrProjects.length || 1;
  document.getElementById("chartAbr").innerHTML = `
    <div style="font-size:13px;color:var(--muted);margin-bottom:12px">In Abrechnung gesamt: <b>${abrProjects.length}</b></div>
    ${stages.map(s => {
      const n = counts[s.key] || 0;
      return `<div class="bar-row">
        <div class="bar-label">${s.label}</div>
        <div class="bar-wrap">
          <div class="bar-fill" style="width:${Math.round(n/total*100)}%;background:${s.color}"></div>
          <span class="bar-val">${n}</span>
        </div>
      </div>`;
    }).join("")}`;
}

function renderStatusChart(projects) {
  const active = projects.filter(p => !isAbgeschlossen(p) && !p.baustopp);
  const byStatus = {};
  active.forEach(p => {
    const s = p.status || "Unbekannt";
    if (!byStatus[s]) byStatus[s] = { label: s, count: 0, amount: 0 };
    byStatus[s].count++;
    byStatus[s].amount += p.amount || 0;
  });
  const items = Object.values(byStatus).sort((a,b) => b.count - a.count);
  const colors = ["#3b6df0","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];
  const max = Math.max(...items.map(i=>i.count), 1);
  document.getElementById("chartStatus").innerHTML = items.map((i, idx) => `
    <div class="bar-row">
      <div class="bar-label">${i.label}</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.round(i.count/max*100)}%;background:${colors[idx%colors.length]}"></div>
        <span class="bar-val">${i.count} (${fmtMoney(i.amount)})</span>
      </div>
    </div>`).join("");
}

function fillYearFilter(projects) {
  const years = [...new Set(projects.map(p => {
    const d = parseDE(p.ende);
    return d ? d.getFullYear() : null;
  }).filter(Boolean))].sort((a,b) => b - a);

  const sel = document.getElementById("yearFilter");
  sel.innerHTML = `<option value="">Alle Jahre</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function filteredByYear() {
  if (!selectedYear) return allProjects;
  return allProjects.filter(p => {
    const d = parseDE(p.ende);
    return d && d.getFullYear() === +selectedYear;
  });
}

function render() {
  const projects = filteredByYear();
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
      allProjects = data.projects || [];
      allMaengel  = data.maengel  || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";
      fillYearFilter(allProjects);
      render();
    });

  document.getElementById("yearFilter").addEventListener("change", e => {
    selectedYear = e.target.value;
    render();
  });
});
