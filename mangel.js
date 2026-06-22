let MAENGEL = [];
let ARCHIV_MAENGEL = [];
let query = "";
let showArchived = false; // false | "geprueft" | "leo"
let filterBauleiter = "";
let filterStatus = "";
let sortBy = "deadline";

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

function isAutoChecked(status) {
  return status && status.toLowerCase().includes("geprüft");
}
function isChecked(mangelId, idx, status) {
  if (isAutoChecked(status)) return true;
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
  const done = positionen.filter((p, i) => isChecked(m.id, i, p.status)).length;
  return { done, total: positionen.length };
}

function mangelStatusGroup(m) {
  const positionen = m.positionen || [];
  if (!positionen.length) return "angenommen";
  const statuses = positionen.map(p => (p.status || "").toLowerCase());
  if (statuses.every(s => s.includes("geprüft"))) return "geprueft";
  if (statuses.some(s => s.includes("behoben"))) return "behoben";
  return "angenommen";
}

function statusClass(s) {
  if (!s) return "";
  const l = s.toLowerCase();
  if (l.includes("geprüft")) return "pos-done";
  if (l.includes("behoben")) return "pos-behoben";
  if (l.includes("angenommen")) return "pos-open";
  if (l.includes("abgelehnt")) return "pos-rejected";
  return "";
}

function renderPositionen(m) {
  const positionen = m.positionen || [];
  if (!positionen.length) {
    const total = m.anzahl || 0;
    if (!total) return "";
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
    const auto = isAutoChecked(p.status);
    const checked = isChecked(m.id, i, p.status);
    return `
      <label class="pos-item ${checked ? "pos-item-done" : ""}" onclick="event.stopPropagation()">
        <input type="checkbox" ${checked ? "checked" : ""} ${auto ? "disabled title='Закрыто заказчиком'" : ""}
          onchange="toggleCheck('${m.id}', ${i}, this.checked)">
        <div class="pos-info">
          <span class="pos-code">${p.code || ""} · ${p.gewerk || ""}</span>
          ${p.leistung ? `<span class="pos-leistung">${p.leistung}</span>` : ""}
          ${p.mangel_beschreibung ? `<span class="pos-desc"><b>${p.mangel_beschreibung}</b></span>` : ""}
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

const MANGEL_STATUS_LABELS = {
  offen:     { label: "Offen",           color: "#ef4444", bg: "#fef2f2" },
  behoben:   { label: "Behoben – wartet auf Prüfung", color: "#f59e0b", bg: "#fffbeb" },
  teilweise: { label: "Teilweise geprüft", color: "#8b5cf6", bg: "#f5f3ff" },
  geprueft:  { label: "Geprüft ✓",       color: "#10b981", bg: "#f0fdf4" },
  unknown:   { label: "Unbekannt",        color: "#9ca3af", bg: "#f9fafb" },
};

function renderCard(m) {
  const days = daysUntil(m.fertigstellung);
  const late = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 3;
  const { done, total } = checkedCount(m);
  const archived = isArchived(m.id);
  const ms = MANGEL_STATUS_LABELS[m.mangel_status] || MANGEL_STATUS_LABELS.unknown;

  return `
    <div class="card ${archived ? "card-archived" : ""}" id="card-${m.id}"
         style="border-left: 4px solid ${ms.color}">
      <div class="card-head">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="mangel-status-badge" style="background:${ms.bg};color:${ms.color}">${ms.label}</span>
          ${late ? `<span class="due-pill late">${Math.abs(days)} д. просрочен</span>` : ""}
          ${soon && !late ? `<span class="due-pill soon">Срок через ${days} д.</span>` : ""}
        </div>
        <div class="lws">${m.leo_url ? `<a href="${m.leo_url}" target="_blank" onclick="event.stopPropagation()">${m.id}</a>` : m.id}</div>
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
    </div>
  `;
}

function toggleCheck(mangelId, idx, val) {
  setChecked(mangelId, idx, val);
  const m = MAENGEL.find(x => x.id === mangelId);
  if (!m) return;
  document.getElementById(`card-${mangelId}`).outerHTML = renderCard(m);
}

function archiveMangel(mangelId) { setArchived(mangelId, true); render(); }
function unarchiveMangel(mangelId) { setArchived(mangelId, false); render(); }

function applyFiltersAndSort(list) {
  let result = list;

  // Поиск
  if (query) {
    const q = query.toLowerCase();
    result = result.filter(m =>
      [m.id, m.address, m.bauleiter, m.innendienst, m.lage].join(" ").toLowerCase().includes(q)
    );
  }

  // Фильтр по Bauleiter
  if (filterBauleiter) {
    result = result.filter(m => m.bauleiter === filterBauleiter);
  }

  // Фильтр по статусу
  if (filterStatus) {
    result = result.filter(m => mangelStatusGroup(m) === filterStatus);
  }

  // Сортировка
  result = [...result].sort((a, b) => {
    switch (sortBy) {
      case "deadline": {
        const da = parseDate(a.fertigstellung), db = parseDate(b.fertigstellung);
        if (!da && !db) return 0;
        if (!da) return 1; if (!db) return -1;
        return da - db;
      }
      case "deadline_desc": {
        const da = parseDate(a.fertigstellung), db = parseDate(b.fertigstellung);
        if (!da && !db) return 0;
        if (!da) return 1; if (!db) return -1;
        return db - da;
      }
      case "address":
        return (a.address || "").localeCompare(b.address || "", "de");
      case "progress": {
        const ca = checkedCount(a), cb = checkedCount(b);
        const pa = ca.total ? ca.done / ca.total : 0;
        const pb = cb.total ? cb.done / cb.total : 0;
        return pa - pb;
      }
      case "start": {
        const da = parseDate(a.ausfuehrungsbeginn), db = parseDate(b.ausfuehrungsbeginn);
        if (!da && !db) return 0;
        if (!da) return 1; if (!db) return -1;
        return da - db;
      }
      default: return 0;
    }
  });

  return result;
}

function renderArchivCard(m) {
  return `
    <div class="card card-archiv-leo">
      <div class="card-head">
        <div class="lws">${m.id || "—"} <span class="archiv-badge">Archiv</span></div>
        <div class="address">${m.address || "—"}</div>
        <div class="dates">
          <span>Начало: <b>${fmtDate(m.ausfuehrungsbeginn)}</b></span>
          <span>Срок: <b>${fmtDate(m.fertigstellung)}</b></span>
        </div>
        <div class="dates" style="margin-top:4px;">
          <span>Bauleiter: ${m.bauleiter || "—"}</span>
          <span>Innendienst: ${m.innendienst || "—"}</span>
        </div>
      </div>
    </div>
  `;
}

function render() {
  // Активные = не geprueft (offen, behoben, teilweise, unknown)
  const active   = MAENGEL.filter(m => m.mangel_status !== "geprueft");
  // Закрытые = geprueft (закрыты заказчиком)
  const geprueft = MAENGEL.filter(m => m.mangel_status === "geprueft");

  let base, emptyMsg;
  if (showArchived === "leo") {
    base = ARCHIV_MAENGEL;
    emptyMsg = "LEO-Archiv leer";
  } else if (showArchived === "geprueft") {
    base = geprueft;
    emptyMsg = "Keine geprüften Mängel";
  } else {
    base = active;
    emptyMsg = "Ничего не найдено";
  }

  const list = applyFiltersAndSort(base);

  document.getElementById("mangelList").innerHTML = list.length
    ? list.map(m => m.is_archiv ? renderArchivCard(m) : renderCard(m)).join("")
    : `<div class="empty-hint">${emptyMsg}</div>`;

  document.getElementById("tabActive").classList.toggle("active", showArchived === false);
  document.getElementById("tabGeprueft").classList.toggle("active", showArchived === "geprueft");
  document.getElementById("tabArchived").classList.toggle("active", showArchived === "leo");
  document.getElementById("tabActive").textContent = `Aktiv (${active.length})`;
  document.getElementById("tabGeprueft").textContent = `Geprüft ✓ (${geprueft.length})`;
  document.getElementById("tabArchived").textContent = `Archiv LEO (${ARCHIV_MAENGEL.length})`;
}

function populateBauleiterFilter() {
  const sel = document.getElementById("filterBauleiter");
  const names = [...new Set(MAENGEL.map(m => m.bauleiter).filter(Boolean))].sort();
  names.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
}

async function init() {
  document.getElementById("pageTitle").textContent = "Mängelaufträge";
  document.getElementById("search").placeholder = "Поиск по адресу, ID, Bauleiter…";

  const res = await fetch("data.json");
  const data = await res.json();
  MAENGEL = data.maengel || [];
  ARCHIV_MAENGEL = data.archiv_maengel || [];

  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    document.getElementById("pageSub").textContent = "Обновлено: " + d.toLocaleString("ru-RU");
  }

  populateBauleiterFilter();
  render();

  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
  document.getElementById("filterBauleiter").addEventListener("change", e => { filterBauleiter = e.target.value; render(); });
  document.getElementById("filterStatus").addEventListener("change", e => { filterStatus = e.target.value; render(); });
  document.getElementById("sortBy").addEventListener("change", e => { sortBy = e.target.value; render(); });
  document.getElementById("tabActive").addEventListener("click", () => { showArchived = false; render(); });
  document.getElementById("tabGeprueft").addEventListener("click", () => { showArchived = "geprueft"; render(); });
  document.getElementById("tabArchived").addEventListener("click", () => { showArchived = "leo"; render(); });
}

document.addEventListener("DOMContentLoaded", init);
