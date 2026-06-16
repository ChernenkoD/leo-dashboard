let MAENGEL = [];
let query = "";
let showArchived = false;

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
function daysUntil(str) {
  const dt = parseDate(str);
  if (!dt) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((dt - today) / 86400000);
}

// --- localStorage helpers ---
function checkKey(mangelId, idx) { return `chk_${mangelId}_${idx}`; }
function archivedKey(mangelId) { return `arch_${mangelId}`; }

function isChecked(mangelId, idx) {
  return localStorage.getItem(checkKey(mangelId, idx)) === "1";
}
function setChecked(mangelId, idx, val) {
  if (val) localStorage.setItem(checkKey(mangelId, idx), "1");
  else localStorage.removeItem(checkKey(mangelId, idx));
}
function isArchived(mangelId) {
  return localStorage.getItem(archivedKey(mangelId)) === "1";
}
function setArchived(mangelId, val) {
  if (val) localStorage.setItem(archivedKey(mangelId), "1");
  else localStorage.removeItem(archivedKey(mangelId));
}

function checkedCount(m) {
  const positionen = m.positionen || [];
  if (!positionen.length) return { done: 0, total: m.anzahl || 0 };
  const done = positionen.filter((_, i) => isChecked(m.id, i)).length;
  return { done, total: positionen.length };
}

function statusClass(s) {
  if (!s) return "";
  const l = s.toLowerCase();
  if (l.includes("behoben") || l.includes("geprüft")) return "pos-done";
  if (l.includes("angenommen")) return "pos-open";
  if (l.includes("abgelehnt")) return "pos-rejected";
  return "";
}

function renderPositionen(m) {
  const positionen = m.positionen || [];
  if (!positionen.length) {
    const total = m.anzahl || 0;
    if (!total) return "";
    // Нет данных ещё — показываем заглушку-чекбоксы по количеству
    const items = Array.from({ length: total }, (_, i) => `
      <label class="pos-item" onclick="event.stopPropagation()">
        <input type="checkbox" ${isChecked(m.id, i) ? "checked" : ""}
          onchange="toggleCheck('${m.id}', ${i}, this.checked)">
        <span class="pos-label muted">Позиция ${i + 1}</span>
      </label>
    `).join("");
    return `<div class="pos-list">${items}</div>`;
  }

  const items = positionen.map((p, i) => {
    const checked = isChecked(m.id, i);
    return `
      <label class="pos-item ${checked ? "pos-item-done" : ""}" onclick="event.stopPropagation()">
        <input type="checkbox" ${checked ? "checked" : ""}
          onchange="toggleCheck('${m.id}', ${i}, this.checked)">
        <div class="pos-info">
          <span class="pos-code">${p.code || ""} · ${p.gewerk || ""}</span>
          ${p.mangel_beschreibung ? `<span class="pos-desc">${p.mangel_beschreibung}</span>` : ""}
          ${p.bereich ? `<span class="pos-gewerk">${p.bereich}</span>` : ""}
        </div>
        ${p.status ? `<span class="pos-badge ${statusClass(p.status)}">${p.status}</span>` : ""}
      </label>
    `;
  }).join("");
  return `<div class="pos-list">${items}</div>`;
}

function renderProgress(m) {
  const { done, total } = checkedCount(m);
  if (!total) return "";
  const pct = Math.round((done / total) * 100);
  return `
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${done} / ${total}</span>
    </div>
  `;
}

function renderCard(m) {
  const days = daysUntil(m.fertigstellung);
  const late = days !== null && days < 0;
  const { done, total } = checkedCount(m);
  const allDone = total > 0 && done === total;
  const archived = isArchived(m.id);

  return `
    <div class="card ${archived ? "card-archived" : ""}" id="card-${m.id}">
      <div class="card-head">
        ${late ? `<span class="due-pill late">${Math.abs(days)} д. просрочен</span>` : ""}
        <div class="lws">${m.id}</div>
        <div class="address">${m.address || "—"}</div>
        ${m.lage ? `<div class="lage">${m.lage}</div>` : ""}
        <div class="dates">
          <span>Начало: <b>${fmtDate(m.ausfuehrungsbeginn)}</b></span>
          <span>Срок: <b>${fmtDate(m.fertigstellung)}</b></span>
        </div>
        <div class="dates" style="margin-top:4px;">
          <span>Bauleiter: ${m.bauleiter || "—"}</span>
          <span>Innendienst: ${m.innendienst || "—"}</span>
        </div>
      </div>
      ${renderProgress(m)}
      ${renderPositionen(m)}
      <div class="card-foot" onclick="event.stopPropagation()">
        ${allDone && !archived ? `
          <button class="btn-archive" onclick="archiveMangel('${m.id}')">✓ В архив</button>
        ` : ""}
        ${archived ? `
          <button class="btn-unarchive" onclick="unarchiveMangel('${m.id}')">↩ Из архива</button>
        ` : ""}
      </div>
    </div>
  `;
}

function toggleCheck(mangelId, idx, val) {
  setChecked(mangelId, idx, val);
  const m = MAENGEL.find(x => x.id === mangelId);
  if (!m) return;
  document.getElementById(`card-${mangelId}`).outerHTML = renderCard(m);
}

function archiveMangel(mangelId) {
  setArchived(mangelId, true);
  render();
}
function unarchiveMangel(mangelId) {
  setArchived(mangelId, false);
  render();
}

function render() {
  const active = MAENGEL.filter(m => !isArchived(m.id));
  const archived = MAENGEL.filter(m => isArchived(m.id));
  const list = (showArchived ? archived : active).filter(m => {
    if (!query) return true;
    return [m.id, m.address, m.bauleiter].join(" ").toLowerCase().includes(query.toLowerCase());
  });

  document.getElementById("mangelList").innerHTML = list.length
    ? list.map(renderCard).join("")
    : `<div class="empty-hint">${showArchived ? "Архив пуст" : "Нет активных Mängel"}</div>`;

  document.getElementById("tabActive").classList.toggle("active", !showArchived);
  document.getElementById("tabArchived").classList.toggle("active", showArchived);
  document.getElementById("tabActive").textContent = `Активные (${active.length})`;
  document.getElementById("tabArchived").textContent = `Архив (${archived.length})`;
}

async function init() {
  document.getElementById("pageTitle").textContent = "Mängelaufträge";
  document.getElementById("search").placeholder = "Поиск по адресу, ID, Bauleiter…";

  const res = await fetch("data.json");
  const data = await res.json();
  MAENGEL = data.maengel || [];

  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    document.getElementById("pageSub").textContent = "Обновлено: " + d.toLocaleString("ru-RU");
  }

  render();

  document.getElementById("search").addEventListener("input", e => {
    query = e.target.value.trim();
    render();
  });
  document.getElementById("tabActive").addEventListener("click", () => { showArchived = false; render(); });
  document.getElementById("tabArchived").addEventListener("click", () => { showArchived = true; render(); });
}

document.addEventListener("DOMContentLoaded", init);
