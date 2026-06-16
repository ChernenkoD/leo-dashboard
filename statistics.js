let state = loadState();
let monthQuery = "";

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
    .filter(c => !monthQuery || monthKey(effectiveDate(c)) === monthQuery);
}

function renderStats(cards) {
  const weekCards = cards.filter(c => isThisWeek(effectiveDate(c)));
  const weekSum = weekCards.reduce((s, c) => s + (c.amount || 0), 0);
  const monthSum = cards.reduce((s, c) => s + (c.amount || 0), 0);

  document.getElementById("stats").innerHTML = `
    <div class="stat-card accent">
      <div class="num">${weekCards.length}</div>
      <div class="label">${t("stat_this_week")}</div>
      <div class="money">${fmtMoney(weekSum)}</div>
    </div>
    <div class="stat-card">
      <div class="num">${cards.length}</div>
      <div class="label">${t("stat_this_month")}</div>
      <div class="money">${fmtMoney(monthSum)}</div>
    </div>
  `;
}

function renderWeekChart(cards) {
  const buckets = {};
  cards.forEach(c => {
    const planned = effectiveDate(c);
    if (!planned || planned === "—") return;
    const ws = weekStart(planned).getTime();
    if (!buckets[ws]) buckets[ws] = { start: new Date(ws), count: 0, sum: 0 };
    buckets[ws].count += 1;
    buckets[ws].sum += c.amount || 0;
  });
  const weeks = Object.values(buckets).sort((a, b) => a.start - b.start);
  const maxSum = Math.max(1, ...weeks.map(w => w.sum));

  document.getElementById("weekChart").innerHTML = weeks.length ? `
    <div class="week-chart-title">${t("week_chart_title")}</div>
    ${weeks.map(w => `
      <div class="week-row">
        <div class="week-label">${t("week_label", { range: weekRangeLabel(w.start) })}</div>
        <div class="week-bar-track">
          <div class="week-bar" style="width:${Math.max(4, (w.sum / maxSum) * 100)}%"></div>
        </div>
        <div class="week-figures">${t("stat_apartments", { n: w.count })} · ${fmtMoney(w.sum)}</div>
      </div>
    `).join("")}
  ` : `<div class="empty-hint">${t("home_empty_zadel")}</div>`;
}

function render() {
  document.getElementById("pageTitle").textContent = t("stats_title");
  document.getElementById("pageSub").textContent = t("stats_sub");

  const cards = visibleCards();
  renderStats(cards);
  renderWeekChart(cards);
}

document.addEventListener("DOMContentLoaded", () => {
  fillMonthFilter();
  render();
  document.getElementById("monthFilter").addEventListener("change", e => { monthQuery = e.target.value; render(); });
});
