let MAENGEL = [];
let query = "";

function daysUntilLocal(iso) {
  if (!iso) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((new Date(iso) - today) / 86400000);
}
function fmtDateLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

function renderCard(m) {
  const days = daysUntilLocal(m.fertigstellung);
  const late = days !== null && days < 0;
  return `
    <div class="card">
      ${late ? `<span class="due-pill late">${t("due_late", { n: Math.abs(days) })}</span>` : ""}
      <div class="lws">${m.id}</div>
      <div class="address">${m.address}</div>
      <div class="lage">${m.lage || ""}</div>
      <div class="dates">
        <span>${t("field_start")}: <b>${fmtDateLocal(m.ausfuehrungsbeginn)}</b></span>
        <span>${t("field_deadline")}: <b>${fmtDateLocal(m.fertigstellung)}</b></span>
      </div>
      <span class="tag">${t("status_label")}: ${m.status} · ${t("positions_label")}: ${m.anzahl}</span>
      <div class="dates" style="margin-top:8px;">
        <span>${t("bauleiter_label")}: ${m.bauleiter}</span>
        <span>${t("innendienst_label")}: ${m.innendienst}</span>
      </div>
    </div>
  `;
}

function render() {
  const list = MAENGEL.filter(m => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [m.id, m.address, m.bauleiter].join(" ").toLowerCase().includes(q);
  });
  document.getElementById("mangelList").innerHTML = list.length
    ? list.map(renderCard).join("")
    : `<div class="empty-hint">${t("empty_results")}</div>`;
}

async function init() {
  document.getElementById("pageTitle").textContent = t("mangel_title");
  document.getElementById("pageSub").textContent = t("mangel_sub");
  document.getElementById("search").placeholder = t("search_placeholder");

  const res = await fetch("data.json");
  const data = await res.json();
  MAENGEL = data.maengel || [];
  render();
  document.getElementById("search").addEventListener("input", e => {
    query = e.target.value.trim();
    render();
  });
}

document.addEventListener("DOMContentLoaded", init);
