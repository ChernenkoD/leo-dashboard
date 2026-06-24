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
    const clickable = filterKey ? `onclick="setFilter('${filterKey}','${fv.replace(/'/g,"\\'")}') " style="cursor:pointer"` : "";
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

// ── Tab switching ─────────────────────────────────────────────────────────────
let currentTab = "archiv";
function switchTab(tab) {
  currentTab = tab;
  ["archiv","aktiv","woche"].forEach(t => {
    const btn = document.getElementById("tab" + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle("active", t === tab);
  });
  document.querySelector("main:not(#aktivSection):not(#wocheSection)").style.display = tab === "archiv" ? "flex" : "none";
  document.getElementById("aktivSection").style.display = tab === "aktiv" ? "flex" : "none";
  document.getElementById("wocheSection").style.display = tab === "woche" ? "flex" : "none";
  document.getElementById("yearFilter").style.display = tab === "archiv" ? "" : "none";
  if (tab === "aktiv") renderAktiv();
  if (tab === "woche") renderWoche();
}

// ── Active projects / Planung ─────────────────────────────────────────────────
const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
let planVon = null, planBis = null;

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
  document.getElementById("planVon").value = "";
  document.getElementById("planBis").value = "";
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
    const badge = isCurrent ? ` <span class="month-current-badge">aktuell</span>` : "";
    return `
      <div class="plan-month-row" onclick="filterTableByMonth('${key}')">
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

let tableMonthFilter = null;
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

  const now = new Date(); now.setHours(0,0,0,0);
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
          <td><b>${fmtMoney(p.amount)}</b></td>
        </tr>`;
      }).join("")}</tbody>
    </table>` : `<div class="empty-hint">Keine Projekte</div>`;
}

function renderAktiv() {
  const allActive = getActiveProjects();
  const filtered = (planVon || planBis) ? filterByPeriod(allActive) : allActive;
  const totalAmount = filtered.reduce((s,p) => s + (p.amount||0), 0);
  const now = new Date(); now.setHours(0,0,0,0);
  const overdue = filtered.filter(p => { const d = parseDE(p.ende); return d && d < now; });
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const thisMonth = filtered.filter(p => {
    const d = parseDE(p.ende);
    if (!d) return false;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === thisMonthKey;
  });

  // Filter info
  const infoEl = document.getElementById("planFilterInfo");
  if (infoEl) {
    infoEl.textContent = (planVon || planBis)
      ? `Gefiltert: ${filtered.length} von ${allActive.length} Projekten`
      : `Gesamt: ${allActive.length} aktive Projekte`;
  }

  // KPI
  document.getElementById("kpiAktiv").innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${filtered.length}</div><div class="kpi-label">Aktive Projekte</div></div>
    <div class="kpi-card"><div class="kpi-val">${fmtMoney(totalAmount)}</div><div class="kpi-label">Gesamtvolumen</div></div>
    <div class="kpi-card" style="${overdue.length ? 'border-left:3px solid #ef4444' : ''}"><div class="kpi-val" style="${overdue.length ? 'color:#ef4444' : ''}">${overdue.length}</div><div class="kpi-label">Überfällig</div></div>
    <div class="kpi-card" style="border-left:3px solid #f59e0b"><div class="kpi-val" style="color:#f59e0b">${thisMonth.length}</div><div class="kpi-label">Fällig diesen Monat · ${fmtMoney(thisMonth.reduce((s,p)=>s+(p.amount||0),0))}</div></div>
  `;

  renderEndeMonthChart(filtered);
  renderAktivTable(filtered);
}

// ── Wochenbericht ─────────────────────────────────────────────────────────────
// Неделя считается Вт–Ср (Dienstag–Mittwoch)
let wocheOffset = 0; // 0 = текущая неделя, -1 = прошлая и т.д.

function getWochePeriod(offset) {
  // Находим последнюю среду (конец недели)
  const now = new Date();
  const dow = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // Среда = 3. Сколько дней назад была последняя среда?
  const daysToLastWed = (dow - 3 + 7) % 7; // 0 если сегодня среда
  const lastWed = new Date(now);
  lastWed.setDate(now.getDate() - daysToLastWed + offset * 7);
  lastWed.setHours(23, 59, 59, 0);

  // Вторник = за 6 дней до среды
  const prevTue = new Date(lastWed);
  prevTue.setDate(lastWed.getDate() - 6);
  prevTue.setHours(0, 0, 0, 0);

  return { von: prevTue, bis: lastWed };
}

function fmtDE(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function wocheNavPrev() { wocheOffset--; renderWoche(); }
function wocheNavNext() { wocheOffset++; if (wocheOffset > 0) wocheOffset = 0; renderWoche(); }

function renderMangelTable(maengel, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!maengel.length) { el.innerHTML = `<div class="empty-hint">Keine Mängel</div>`; return; }
  el.innerHTML = `<table class="aktiv-table">
    <thead><tr><th>ID</th><th>Adresse</th><th>Bauleiter</th><th>Fällig</th><th>Status</th><th>Eingang</th></tr></thead>
    <tbody>${maengel.map(m => {
      const fs = m.fertigstellung || "—";
      const fsD = m.fertigstellung ? parseDE(m.fertigstellung) : null;
      const now = new Date(); now.setHours(0,0,0,0);
      const overdue = fsD && fsD < now && !["geprueft"].includes(m.mangel_status);
      const cls = overdue ? "row-late" : "";
      const statusLabel = { offen:"🔴 Offen", behoben:"🟡 Behoben", teilweise:"🟠 Teilw.", geprueft:"✅ Geprüft", unknown:"—" }[m.mangel_status] || m.mangel_status || "—";
      const badge = overdue ? `<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:4px">überfällig</span>` : "";
      return `<tr class="${cls}">
        <td><a href="${m.leo_url||'#'}" target="_blank" style="font-size:11px">${m.id||"—"}</a></td>
        <td style="max-width:180px;font-size:12px">${m.address||"—"}</td>
        <td style="font-size:12px">${m.bauleiter||"—"}</td>
        <td style="font-size:12px">${fs} ${badge}</td>
        <td style="font-size:12px">${statusLabel}</td>
        <td style="font-size:11px;color:var(--muted)">${m.first_seen||"—"}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

function renderWoche() {
  const { von, bis } = getWochePeriod(wocheOffset);
  const now = new Date(); now.setHours(0,0,0,0);

  // Период
  document.getElementById("wochePeriod").textContent =
    `KW: ${fmtDE(von)} – ${fmtDE(bis)}`;
  const nextBtn = document.getElementById("btnWocheNext");
  if (nextBtn) nextBtn.disabled = wocheOffset >= 0;

  // Новые Mängel за период (по first_seen)
  const neue = allMaengel.filter(m => {
    if (!m.first_seen) return false;
    const d = new Date(m.first_seen);
    return d >= von && d <= bis;
  });

  // Просроченные: first_seen > 7 дней назад И статус не geprueft
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const ueberfaellig = allMaengel.filter(m => {
    if (m.mangel_status === "geprueft") return false;
    if (!m.first_seen) return false;
    return new Date(m.first_seen) <= sevenDaysAgo;
  });

  // Обновляем счётчики в заголовке
  document.getElementById("neueCount").textContent = neue.length;
  document.getElementById("uebCount").textContent = ueberfaellig.length;

  // KPI
  const openAll = allMaengel.filter(m => m.mangel_status !== "geprueft");
  document.getElementById("kpiWoche").innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${allMaengel.length}</div><div class="kpi-label">Gesamt aktive Mängel</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:#3b82f6">${neue.length}</div><div class="kpi-label">Neu diese Woche</div></div>
    <div class="kpi-card" style="border-left:3px solid #ef4444"><div class="kpi-val" style="color:#ef4444">${ueberfaellig.length}</div><div class="kpi-label">Überfällig (&gt;7 Tage)</div></div>
    <div class="kpi-card"><div class="kpi-val">${openAll.filter(m=>m.mangel_status==="offen").length}</div><div class="kpi-label">Noch offen</div></div>
  `;

  renderMangelTable(neue, "wocheNeueList");
  renderMangelTable(ueberfaellig, "wocheUebList");
  renderMangelTable(allMaengel, "wocheAlleTable");
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

  document.getElementById("planVon").addEventListener("change", e => {
    planVon = e.target.value ? new Date(e.target.value) : null;
    tableMonthFilter = null;
    renderAktiv();
  });
  document.getElementById("planBis").addEventListener("change", e => {
    planBis = e.target.value ? new Date(e.target.value + "T23:59:59") : null;
    tableMonthFilter = null;
    renderAktiv();
  });
});
