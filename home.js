let allProjects = [];
let query = "";
let monthQuery = "";
let horizonDays = 14;

function parseDE(str) {
  if (!str) return null;
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function fmtDE(str) {
  if (!str) return "—";
  const d = parseDE(str);
  return d ? d.toLocaleDateString("de-DE") : str;
}

function daysUntil(str) {
  const d = parseDE(str);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function monthKey(str) {
  const d = parseDE(str);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function urgencyTag(days) {
  if (days === null) return "";
  if (days < 0)  return `<span class="due-pill late">Überfällig ${Math.abs(days)} Tage</span>`;
  if (days === 0) return `<span class="due-pill today">Heute fällig</span>`;
  if (days <= 7)  return `<span class="due-pill soon">in ${days} Tagen</span>`;
  return `<span class="due-pill upcoming">in ${days} Tagen</span>`;
}

function activeProjects() {
  return allProjects.filter(p => p.fortschritt < 100 && !p.baustopp);
}

function visibleCards() {
  return activeProjects()
    .filter(p => {
      if (query) {
        const q = query.toLowerCase();
        if (![p.lws, p.address, p.lage, p.bauleiter].join(" ").toLowerCase().includes(q)) return false;
      }
      if (monthQuery) {
        return monthKey(p.ende) === monthQuery;
      }
      if (horizonDays !== null) {
        const d = daysUntil(p.ende);
        if (d === null || d > horizonDays) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = parseDE(a.ende), db = parseDE(b.ende);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
}

function getInAbrechnung() {
  try { return new Set(JSON.parse(localStorage.getItem("inAbrechnung") || "[]")); }
  catch { return new Set(); }
}

function markInAbrechnung(lws) {
  const set = getInAbrechnung();
  set.add(lws);
  localStorage.setItem("inAbrechnung", JSON.stringify([...set]));
  render();
}

function renderCard(p) {
  const days = daysUntil(p.ende);
  const inAbr = getInAbrechnung().has(p.lws);
  const leoLink = p.leo_url
    ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${p.lws}</a>`
    : `<span>${p.lws}</span>`;
  const mangelBadge = p.has_mangel
    ? `<span class="mangel-dot has" title="Hat Mängelauftrag">M</span>` : "";

  return `
    <div class="card${inAbr ? " card-inabr" : ""}">
      ${urgencyTag(days)}
      <div class="lws">${leoLink} ${mangelBadge}</div>
      <div class="address">${p.address || "—"}</div>
      ${p.lage ? `<div class="lage">${p.lage}</div>` : ""}
      <div class="dates">
        <span>Beginn: <b>${fmtDE(p.start)}</b></span>
        <span>Fertig: <b>${fmtDE(p.ende)}</b></span>
      </div>
      ${p.bauleiter ? `<div class="bauleiter-tag">BL: ${p.bauleiter}</div>` : ""}
      <div class="progress-wrap" style="margin-top:8px;">
        <div class="progress-bar" style="width:${p.fortschritt}%"></div>
      </div>
      <div class="card-actions">
        <span></span>
        ${inAbr
          ? `<span class="inabr-badge">✓ In Abrechnung</span>`
          : `<button class="primary" onclick="markInAbrechnung('${p.lws}')">Fertig → Abrechnung</button>`
        }
      </div>
    </div>
  `;
}

function fillMonthFilter() {
  const months = [...new Set(activeProjects().map(p => monthKey(p.ende)).filter(Boolean))].sort();
  const sel = document.getElementById("monthFilter");
  sel.innerHTML = `<option value="">Alle Monate</option>` +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join("");
}

function renderHorizonGroup() {
  const options = [
    { days: 7,  label: "1 Woche" },
    { days: 14, label: "2 Wochen" },
    { days: 21, label: "3 Wochen" },
    { days: null, label: "Alle" },
  ];
  document.getElementById("horizonFilter").innerHTML = options.map(o => `
    <button class="${horizonDays === o.days ? "active" : ""}" onclick="setHorizon(${o.days})">${o.label}</button>
  `).join("");
}

function setHorizon(days) {
  horizonDays = days;
  monthQuery = "";
  document.getElementById("monthFilter").value = "";
  renderHorizonGroup();
  render();
}

function renderRing(cards) {
  const overdue = cards.filter(p => { const d = daysUntil(p.ende); return d !== null && d < 0; });
  const week    = cards.filter(p => { const d = daysUntil(p.ende); return d !== null && d >= 0 && d <= 6; });
  const later   = cards.filter(p => { const d = daysUntil(p.ende); return d === null || d > 6; });

  const total = cards.length || 1;
  const pOverdue = (overdue.length / total) * 100;
  const pWeek    = (week.length / total) * 100;

  const gradient = cards.length
    ? `conic-gradient(#e5484d 0% ${pOverdue}%, #f3a73f ${pOverdue}% ${pOverdue + pWeek}%, #5b8cff ${pOverdue + pWeek}% 100%)`
    : `conic-gradient(var(--border) 0% 100%)`;

  document.getElementById("ringPanel").innerHTML = `
    <div class="donut" style="background:${gradient}">
      <div class="donut-hole">
        <div class="donut-num">${cards.length}</div>
        <div class="donut-label">Objekte</div>
      </div>
    </div>
    <div class="legend">
      <div class="legend-row"><span class="dot" style="background:#e5484d"></span>Überfällig<b>${overdue.length}</b></div>
      <div class="legend-row"><span class="dot" style="background:#f3a73f"></span>Diese Woche<b>${week.length}</b></div>
      <div class="legend-row"><span class="dot" style="background:#5b8cff"></span>Später<b>${later.length}</b></div>
    </div>
    <a class="open-stats-link" href="projects.html">Alle Projekte →</a>
  `;
}

function render() {
  const cards = visibleCards();
  renderRing(cards);
  document.getElementById("urgentZadel").innerHTML = cards.length
    ? cards.map(renderCard).join("")
    : `<div class="empty-hint">Keine Projekte im gewählten Zeitraum</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pageTitle").textContent = "Dashboard";
  document.getElementById("search").placeholder = "Suchen…";

  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects = data.projects || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";

      fillMonthFilter();
      renderHorizonGroup();
      render();
    })
    .catch(e => {
      document.getElementById("urgentZadel").innerHTML =
        `<div class="empty-hint">Fehler beim Laden: ${e.message}</div>`;
    });

  document.getElementById("search").addEventListener("input", e => {
    query = e.target.value.trim(); render();
  });
  document.getElementById("monthFilter").addEventListener("change", e => {
    monthQuery = e.target.value;
    if (monthQuery) horizonDays = null;
    renderHorizonGroup();
    render();
  });
});
