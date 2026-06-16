let state = loadState();
let query = "";
let cityQuery = "";
let startFrom = "";
let statusQuery = "";
let mangelQuery = "";

function rows() {
  return state.cards.filter(c => {
    if (query) {
      const q = query.toLowerCase();
      if (![c.id, c.address].join(" ").toLowerCase().includes(q)) return false;
    }
    if (cityQuery && c.city !== cityQuery) return false;
    if (startFrom && c.start && c.start !== "—") {
      if (new Date(c.start) < new Date(startFrom)) return false;
    }
    if (statusQuery && statusInfo(c).key !== statusQuery) return false;
    if (mangelQuery === "yes" && !c.hadMangel) return false;
    if (mangelQuery === "no" && c.hadMangel) return false;
    return true;
  });
}

function statusPillHtml(card) {
  const s = statusInfo(card);
  return `<span class="status-pill ${s.key}">${s.label}</span>`;
}

function updatePlanned(cardId, value) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.plannedDate = value || card.ende;
  saveState(state);
  renderTable();
}

function renderTable() {
  const body = document.getElementById("projTableBody");
  const list = rows().sort((a, b) => a.address.localeCompare(b.address));
  body.innerHTML = list.length ? list.map(c => `
    <tr>
      <td>${c.address}${c.lage ? `<div class="sub-cell">${c.lage}</div>` : ""}</td>
      <td>${c.city || "—"}</td>
      <td class="lws-cell">${c.id}</td>
      <td>${fmtDate(c.start)}</td>
      <td>${fmtDate(c.ende)}</td>
      <td>
        <input type="date" class="planned-input ${isPlannedEdited(c) ? "edited" : ""}" value="${c.plannedDate || c.ende}" onchange="updatePlanned('${c.id}', this.value)">
      </td>
      <td>${statusPillHtml(c)}</td>
      <td>${c.hadMangel ? t("mangel_had") : "—"}</td>
    </tr>
  `).join("") : `<tr><td colspan="8" class="empty-hint">${t("empty_results")}</td></tr>`;
}

function fillCityFilter() {
  const cities = [...new Set(state.cards.map(c => c.city).filter(Boolean))].sort();
  const sel = document.getElementById("cityFilter");
  sel.innerHTML = `<option value="">${t("all_cities")}</option>` +
    cities.map(c => `<option value="${c}">${c}</option>`).join("");
}

function fillStaticSelects() {
  document.getElementById("pageTitle").textContent = t("projects_title");
  document.getElementById("pageSub").textContent = t("projects_sub");
  document.getElementById("search").placeholder = t("search_placeholder");
  document.getElementById("startFrom").title = t("start_from_title");

  document.getElementById("statusFilter").innerHTML = `
    <option value="">${t("all_statuses")}</option>
    <option value="active">${t("status_active")}</option>
    <option value="waiting">${t("status_waiting")}</option>
    <option value="documents">${t("status_documents")}</option>
    <option value="archived">${t("status_archived")}</option>
  `;
  document.getElementById("mangelFilter").innerHTML = `
    <option value="">${t("mangel_all")}</option>
    <option value="yes">${t("mangel_yes")}</option>
    <option value="no">${t("mangel_no")}</option>
  `;
  document.getElementById("tableHead").innerHTML = `
    <th>${t("th_address")}</th>
    <th>${t("th_city")}</th>
    <th>${t("th_order")}</th>
    <th>${t("th_start")}</th>
    <th>${t("th_end")}</th>
    <th>${t("th_planned")}</th>
    <th>${t("th_status")}</th>
    <th>${t("th_mangel")}</th>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  fillStaticSelects();
  fillCityFilter();
  renderTable();
  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); renderTable(); });
  document.getElementById("cityFilter").addEventListener("change", e => { cityQuery = e.target.value; renderTable(); });
  document.getElementById("startFrom").addEventListener("change", e => { startFrom = e.target.value; renderTable(); });
  document.getElementById("statusFilter").addEventListener("change", e => { statusQuery = e.target.value; renderTable(); });
  document.getElementById("mangelFilter").addEventListener("change", e => { mangelQuery = e.target.value; renderTable(); });
});
