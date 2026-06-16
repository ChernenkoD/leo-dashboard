let state = loadState();
let query = "";
let monthQuery = "";
let horizonDays = 7; // null = без ограничения (например при выборе конкретного месяца)

function moveCard(cardId, toColumn) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  if (toColumn === "done" && !card.docs) {
    card.docs = JSON.parse(JSON.stringify(DEFAULT_DOCS));
    card.reviewStatus = null;
  }
  card.column = toColumn;
  saveState(state);
  render();
}

function urgencyTag(days) {
  if (days === null) return "";
  if (days < 0) return `<span class="due-pill late">${t("due_late", { n: Math.abs(days) })}</span>`;
  if (days === 0) return `<span class="due-pill today">${t("due_today")}</span>`;
  return `<span class="due-pill soon">${t("due_soon", { n: days })}</span>`;
}

function renderZadelCard(card) {
  const planned = effectiveDate(card);
  const days = daysUntil(planned);
  const edited = isPlannedEdited(card);
  return `
    <div class="card">
      ${urgencyTag(days)}
      <div class="lws">${card.id}</div>
      <div class="address">${card.address}</div>
      <div class="lage">${card.lage}</div>
      <div class="dates">
        <span>${t("field_start")}: <b>${fmtDate(card.start)}</b></span>
        <span>${t("field_due")}: <b>${fmtDate(planned)}</b>${edited ? ` <span class="planned-badge">план</span>` : ""}</span>
      </div>
      <span class="tag">${card.tag} · ${fmtMoney(card.amount || 0)}</span>
      <div class="card-actions">
        <span></span>
        <button class="primary" onclick="moveCard('${card.id}', 'done')">${t("btn_ready_to_docs")}</button>
      </div>
    </div>
  `;
}

function fillMonthFilter() {
  const months = [...new Set(
    state.cards.filter(c => c.column === "zadel").map(c => monthKey(effectiveDate(c))).filter(Boolean)
  )].sort();
  const sel = document.getElementById("monthFilter");
  sel.innerHTML = `<option value="">${t("month_all")}</option>` +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join("");
}

function visibleCards() {
  return state.cards
    .filter(c => c.column === "zadel")
    .filter(c => !monthQuery || monthKey(effectiveDate(c)) === monthQuery)
    .filter(c => monthQuery || horizonDays === null || daysUntil(effectiveDate(c)) <= horizonDays)
    .filter(c => !query || [c.id, c.address].join(" ").toLowerCase().includes(query.toLowerCase()));
}

function renderHorizonGroup() {
  const options = [
    { days: 7, key: "horizon_1w" },
    { days: 14, key: "horizon_2w" },
    { days: 21, key: "horizon_3w" },
    { days: null, key: "horizon_all" }
  ];
  document.getElementById("horizonFilter").innerHTML = options.map(o => `
    <button class="${horizonDays === o.days ? "active" : ""}" onclick="setHorizon(${o.days})">${t(o.key)}</button>
  `).join("");
}

function setHorizon(days) {
  horizonDays = days;
  renderHorizonGroup();
  render();
}

function renderRing(cards) {
  const overdue = cards.filter(c => daysUntil(effectiveDate(c)) < 0);
  const week = cards.filter(c => { const d = daysUntil(effectiveDate(c)); return d >= 0 && d <= 6; });
  const later = cards.filter(c => daysUntil(effectiveDate(c)) > 6);

  const total = cards.length || 1;
  const pOverdue = (overdue.length / total) * 100;
  const pWeek = (week.length / total) * 100;
  const totalSum = cards.reduce((s, c) => s + (c.amount || 0), 0);

  const gradient = cards.length
    ? `conic-gradient(#e5484d 0% ${pOverdue}%, #f3a73f ${pOverdue}% ${pOverdue + pWeek}%, #5b8cff ${pOverdue + pWeek}% 100%)`
    : `conic-gradient(var(--border) 0% 100%)`;

  document.getElementById("ringPanel").innerHTML = `
    <a class="donut-link" href="statistics.html">
      <div class="donut" style="background:${gradient}">
        <div class="donut-hole">
          <div class="donut-num">${cards.length}</div>
          <div class="donut-label">${t("ring_total_label")}</div>
        </div>
      </div>
    </a>
    <div class="donut-sum">${fmtMoney(totalSum)}</div>
    <div class="legend">
      <div class="legend-row"><span class="dot" style="background:#e5484d"></span>${t("ring_overdue")}<b>${overdue.length}</b></div>
      <div class="legend-row"><span class="dot" style="background:#f3a73f"></span>${t("ring_week")}<b>${week.length}</b></div>
      <div class="legend-row"><span class="dot" style="background:#5b8cff"></span>${t("ring_later")}<b>${later.length}</b></div>
    </div>
    <a class="open-stats-link" href="statistics.html">${t("ring_open_stats")}</a>
  `;
}

function render() {
  document.getElementById("pageTitle").textContent = t("home_title");
  document.getElementById("pageSub").textContent = t("home_sub");
  document.getElementById("search").placeholder = t("search_placeholder");

  const cards = visibleCards().sort((a, b) => new Date(effectiveDate(a)) - new Date(effectiveDate(b)));

  renderRing(cards);

  document.getElementById("urgentZadel").innerHTML = cards.length
    ? cards.map(renderZadelCard).join("")
    : `<div class="empty-hint">${t("home_empty_zadel")}</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  fillMonthFilter();
  renderHorizonGroup();
  render();
  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
  document.getElementById("monthFilter").addEventListener("change", e => { monthQuery = e.target.value; render(); });
});
