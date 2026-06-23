let MAENGEL = [];
let ARCHIV_MAENGEL = [];
let PEOPLE = { managers: [], technicians: [] };
let query = "";
let showArchived = false; // false | "geprueft" | "leo"
let filterBauleiter = "";
let filterStatus = "";
let sortBy = "deadline";

const REPO = "ChernenkoD/leo-dashboard";
const ASSIGNMENTS_FILE = "assignments.json";

async function saveAssignmentToGitHub(mangelId) {
  const token = localStorage.getItem("github_pat");
  if (!token) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });
    const curr = await r.json();

    // Собираем все assignments из localStorage
    const allAssignments = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("assign_")) {
        const id = key.slice(7);
        try {
          const asgn = JSON.parse(localStorage.getItem(key));
          // Добавляем имена людей
          const mgr  = (PEOPLE.managers    || []).find(p => p.id === asgn.manager);
          const tech = (PEOPLE.technicians || []).find(p => p.id === asgn.technician);
          if (mgr)  asgn.manager_name    = mgr.name;
          if (tech) asgn.technician_name = tech.name;
          allAssignments[id] = asgn;
        } catch {}
      }
    }

    const content = btoa(unescape(encodeURIComponent(JSON.stringify({ assignments: allAssignments }, null, 2))));
    await fetch(`https://api.github.com/repos/${REPO}/contents/${ASSIGNMENTS_FILE}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({ message: `Update assignment ${mangelId}`, content, sha: curr.sha })
    });
  } catch(e) {
    console.error("GitHub sync error:", e);
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────
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
function isNewToday(m) {
  // Считаем "новым сегодня" если Ausführungsbeginn = сегодня или вчера
  // (scraper тянет дату начала из LEO)
  const dt = parseDate(m.ausfuehrungsbeginn);
  if (!dt) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - dt) / 86400000);
  return diff <= 1;
}

// ── People / assignments ──────────────────────────────────────────────────────
async function loadPeople() {
  const local = localStorage.getItem("people_config");
  if (local) { try { PEOPLE = JSON.parse(local); return; } catch {} }
  try {
    const r = await fetch("people.json?" + Date.now());
    PEOPLE = await r.json();
  } catch {}
}

function getAssignment(mangelId) {
  try {
    const raw = localStorage.getItem("assign_" + mangelId);
    return raw ? JSON.parse(raw) : { manager: "", technician: "", sentAt: null, date_started: null, date_finished: null };
  } catch { return { manager: "", technician: "", sentAt: null, date_started: null, date_finished: null }; }
}
function saveAssignment(mangelId, obj) {
  localStorage.setItem("assign_" + mangelId, JSON.stringify(obj));
}

// ── localStorage position helpers ────────────────────────────────────────────
function checkKey(mangelId, idx) { return `chk_${mangelId}_${idx}`; }
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

// ── Status helpers ────────────────────────────────────────────────────────────
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

const MANGEL_STATUS_LABELS = {
  offen:     { label: "Offen",                      color: "#ef4444", bg: "#fef2f2" },
  behoben:   { label: "Behoben – wartet auf Prüfung", color: "#f59e0b", bg: "#fffbeb" },
  teilweise: { label: "Teilweise geprüft",           color: "#8b5cf6", bg: "#f5f3ff" },
  geprueft:  { label: "Geprüft ✓",                  color: "#10b981", bg: "#f0fdf4" },
  unknown:   { label: "Unbekannt",                   color: "#9ca3af", bg: "#f9fafb" },
};

// ── Translation via Claude API ────────────────────────────────────────────────
async function translatePos(mangelId, posIdx, text) {
  const box = document.getElementById(`trans-${mangelId}-${posIdx}`);
  if (!box) return;
  const apiKey = localStorage.getItem("claude_api_key");
  if (!apiKey) {
    box.innerHTML = `<span style="color:#dc2626;font-size:12px">⚠ Claude API Key in Einstellungen eintragen!</span>`;
    box.style.display = "block";
    return;
  }
  box.innerHTML = `<span class="trans-loading">⏳ Übersetze...</span>`;
  box.style.display = "block";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: `Переведи на русский язык описание строительного дефекта. Только перевод, без пояснений:\n"${text}"` }]
      })
    });
    const data = await r.json();
    const translated = data.content?.[0]?.text || "Fehler";
    const safe = translated.replace(/'/g, "\\'").replace(/\n/g, "\\n");
    box.innerHTML = `
      <div class="trans-text">🇷🇺 ${translated}</div>
      <button class="btn-copy-trans" onclick="navigator.clipboard.writeText('${safe}').then(()=>{this.textContent='✓ Kopiert!';setTimeout(()=>this.textContent='📋 Kopieren',2000)})">📋 Kopieren</button>
    `;
  } catch(e) {
    box.innerHTML = `<span style="color:#dc2626;font-size:12px">Fehler: ${e.message}</span>`;
  }
}

// ── Render positions ──────────────────────────────────────────────────────────
function renderPositionen(m) {
  const positionen = m.positionen || [];
  if (!positionen.length) {
    const total = m.anzahl || 0;
    if (!total) return "";
    const items = Array.from({ length: total }, (_, i) => `
      <label class="pos-item" onclick="event.stopPropagation()">
        <input type="checkbox" ${isChecked(m.id, i) ? "checked" : ""}
          onchange="toggleCheck('${m.id}', ${i}, this.checked)">
        <span class="pos-label muted">Position ${i + 1}</span>
      </label>
    `).join("");
    return `<div class="pos-list">${items}</div>`;
  }
  const items = positionen.map((p, i) => {
    const auto = isAutoChecked(p.status);
    const checked = isChecked(m.id, i, p.status);
    const descText = (p.mangel_beschreibung || p.leistung || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const hasDesc = !!(p.mangel_beschreibung || p.leistung);
    return `
      <label class="pos-item ${checked ? "pos-item-done" : ""}" onclick="event.stopPropagation()">
        <input type="checkbox" ${checked ? "checked" : ""} ${auto ? "disabled title='Закрыто заказчиком'" : ""}
          onchange="toggleCheck('${m.id}', ${i}, this.checked)">
        <div class="pos-info">
          <span class="pos-code">${p.code || ""} · ${p.gewerk || ""}</span>
          ${p.leistung ? `<span class="pos-leistung">${p.leistung}</span>` : ""}
          ${p.mangel_beschreibung ? `<div class="pos-desc-row"><b class="pos-desc">${p.mangel_beschreibung}</b>${hasDesc ? `<button class="btn-translate" onclick="event.stopPropagation();translatePos('${m.id}',${i},'${descText}')" title="Auf Russisch übersetzen">🇷🇺</button>` : ""}</div>` : ""}
          ${p.bereich ? `<span class="pos-gewerk">${p.bereich}</span>` : ""}
          <div id="trans-${m.id}-${i}" class="trans-box" style="display:none"></div>
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

// ── Assignment panel ──────────────────────────────────────────────────────────
function renderAssignPanel(m) {
  const asgn = getAssignment(m.id);
  const mgrs = PEOPLE.managers || [];
  const techs = PEOPLE.technicians || [];

  const mgrOpts = `<option value="">— Manager —</option>` +
    mgrs.map(p => `<option value="${p.id}" ${asgn.manager === p.id ? "selected" : ""}>${p.name}</option>`).join("");
  const techOpts = `<option value="">— Techniker —</option>` +
    techs.map(p => `<option value="${p.id}" ${asgn.technician === p.id ? "selected" : ""}>${p.name}</option>`).join("");

  let statusRow = "";
  if (asgn.date_finished) {
    statusRow = `<span class="assign-sent assign-fertig">✓ Fertig: ${asgn.date_finished}</span>`;
  } else if (asgn.sentAt) {
    const sentStr = new Date(asgn.sentAt).toLocaleString("de-DE", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    statusRow = `
      <span class="assign-sent">✓ In Arbeit ${sentStr}</span>
      <button class="btn-fertig" onclick="markFertig('${m.id}')">✓ Fertig markieren</button>
    `;
  }

  return `
    <div class="assign-panel" onclick="event.stopPropagation()">
      <select class="assign-select" onchange="onAssignChange('${m.id}','manager',this.value)">${mgrOpts}</select>
      <select class="assign-select" onchange="onAssignChange('${m.id}','technician',this.value)">${techOpts}</select>
      <button class="btn-senden" onclick="sendInArbeit('${m.id}')" ${asgn.technician ? "" : "disabled"}>
        ✈ In Arbeit senden
      </button>
      ${statusRow}
    </div>
  `;
}

function onAssignChange(mangelId, field, val) {
  const asgn = getAssignment(mangelId);
  asgn[field] = val;
  saveAssignment(mangelId, asgn);
  // Re-render just the assign panel
  const card = document.getElementById("card-" + mangelId);
  if (card) {
    const m = MAENGEL.find(x => x.id === mangelId);
    if (m) card.outerHTML = renderCard(m);
  }
}

function markFertig(mangelId) {
  const today = new Date().toISOString().slice(0, 10);
  const input = prompt("Datum Fertigstellung (JJJJ-MM-TT):", today);
  if (!input) return;

  const asgn = getAssignment(mangelId);
  asgn.date_finished = input;
  saveAssignment(mangelId, asgn);
  saveAssignmentToGitHub(mangelId);

  const m = MAENGEL.find(x => x.id === mangelId);
  if (m) document.getElementById(`card-${mangelId}`).outerHTML = renderCard(m);
}

function sendInArbeit(mangelId) {
  const m = MAENGEL.find(x => x.id === mangelId);
  if (!m) return;
  const asgn = getAssignment(mangelId);
  const tech = (PEOPLE.technicians || []).find(p => p.id === asgn.technician);
  const mgr  = (PEOPLE.managers   || []).find(p => p.id === asgn.manager);

  // Строим текст сообщения
  const positions = (m.positionen || []).map((p, i) =>
    `${i+1}. ${p.code || ""} ${p.gewerk || ""}: ${p.mangel_beschreibung || p.leistung || "—"}`
  ).join("\n");

  const msg = [
    `⚠️ Neuer Mängelauftrag`,
    `📋 ${m.id}`,
    `📍 ${m.address || "—"}`,
    m.lage ? `🏠 ${m.lage}` : null,
    `📅 Termin: ${fmtDate(m.fertigstellung)}`,
    `👔 Manager: ${mgr ? mgr.name : "—"}`,
    `🔧 Techniker: ${tech ? tech.name : "—"}`,
    ``,
    positions || "Keine Positionen",
    ``,
    m.leo_url ? `🔗 ${m.leo_url}` : null,
  ].filter(x => x !== null).join("\n");

  if (tech && tech.telegram_id) {
    // Если есть telegram_id техника — открываем глубокую ссылку
    const encoded = encodeURIComponent(msg);
    window.open(`https://t.me/${tech.telegram_id}?text=${encoded}`, "_blank");
  } else {
    // Иначе — копируем текст в буфер
    navigator.clipboard.writeText(msg).then(() => {
      alert("Текст скопирован! Отправь вручную технику:\n\n" + (tech ? tech.name : "?"));
    }).catch(() => {
      prompt("Скопируй текст:", msg);
    });
  }

  // Отмечаем как отправленный + дата взятия в работу
  asgn.sentAt = new Date().toISOString();
  asgn.date_started = new Date().toISOString().slice(0, 10);
  saveAssignment(mangelId, asgn);

  // Сохраняем в GitHub (для синхронизации с Google Sheets)
  saveAssignmentToGitHub(mangelId);

  // Обновляем карточку
  const card = document.getElementById("card-" + mangelId);
  if (card) card.outerHTML = renderCard(m);
}

// ── Card render ───────────────────────────────────────────────────────────────
function getWorkflowBadge(mangelId) {
  const asgn = getAssignment(mangelId);
  if (asgn.date_finished) {
    return `<span class="workflow-badge wf-fertig">✓ Fertig ${asgn.date_finished}</span>`;
  }
  if (asgn.sentAt) {
    const mgr  = (PEOPLE.managers    || []).find(p => p.id === asgn.manager);
    const tech = (PEOPLE.technicians || []).find(p => p.id === asgn.technician);
    return `<span class="workflow-badge wf-arbeit">🔵 In Arbeit · ${tech ? tech.name.split(" ")[0] : "—"}</span>`;
  }
  if (asgn.manager || asgn.technician) {
    return `<span class="workflow-badge wf-assigned">👤 Zugewiesen</span>`;
  }
  return "";
}

function renderCard(m) {
  const days = daysUntil(m.fertigstellung);
  const late = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 7;
  const ms = MANGEL_STATUS_LABELS[m.mangel_status] || MANGEL_STATUS_LABELS.unknown;
  const newToday = isNewToday(m);
  const wfBadge = getWorkflowBadge(m.id);

  return `
    <div class="card${newToday ? " card-neu" : ""}" id="card-${m.id}" style="border-left: 4px solid ${ms.color}">
      <div class="card-head">
        <div class="card-badges">
          <span class="mangel-status-badge" style="background:${ms.bg};color:${ms.color}">${ms.label}</span>
          ${newToday ? `<span class="due-pill neu-badge">✨ Neu heute</span>` : ""}
          ${late ? `<span class="due-pill late">⚠ ${Math.abs(days)} Tage überfällig</span>` : ""}
          ${soon && !late ? `<span class="due-pill soon">⏰ Fällig in ${days} T.</span>` : ""}
          ${wfBadge}
        </div>
        <div class="lws">${m.leo_url
          ? `<a href="${m.leo_url}" target="_blank" onclick="event.stopPropagation()">${m.id}</a>`
          : m.id}</div>
        <div class="address">${m.address || "—"}</div>
        ${m.lage ? `<div class="lage">${m.lage}</div>` : ""}
        <div class="dates">
          <span>Beginn: <b>${fmtDate(m.ausfuehrungsbeginn)}</b></span>
          <span>Fällig: <b>${fmtDate(m.fertigstellung)}</b></span>
        </div>
        <div class="dates" style="margin-top:4px">
          <span>Bauleiter: ${m.bauleiter || "—"}</span>
          <span>Innendienst: ${m.innendienst || "—"}</span>
        </div>
      </div>
      ${renderProgress(m)}
      ${renderPositionen(m)}
      ${renderAssignPanel(m)}
    </div>
  `;
}

function toggleCheck(mangelId, idx, val) {
  setChecked(mangelId, idx, val);
  const m = MAENGEL.find(x => x.id === mangelId);
  if (!m) return;
  document.getElementById(`card-${mangelId}`).outerHTML = renderCard(m);
}

// ── Archive card ──────────────────────────────────────────────────────────────
function renderArchivCard(m) {
  return `
    <div class="card card-archiv-leo">
      <div class="card-head">
        <div class="lws">${m.id || "—"} <span class="archiv-badge">Archiv</span></div>
        <div class="address">${m.address || "—"}</div>
        <div class="dates">
          <span>Beginn: <b>${fmtDate(m.ausfuehrungsbeginn)}</b></span>
          <span>Fällig: <b>${fmtDate(m.fertigstellung)}</b></span>
        </div>
        <div class="dates" style="margin-top:4px">
          <span>Bauleiter: ${m.bauleiter || "—"}</span>
          <span>Innendienst: ${m.innendienst || "—"}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Filters & sort ────────────────────────────────────────────────────────────
function applyFiltersAndSort(list) {
  let result = list;
  if (query) {
    const q = query.toLowerCase();
    result = result.filter(m =>
      [m.id, m.address, m.bauleiter, m.innendienst, m.lage].join(" ").toLowerCase().includes(q)
    );
  }
  if (filterBauleiter) result = result.filter(m => m.bauleiter === filterBauleiter);
  if (filterStatus === "in_arbeit") {
    result = result.filter(m => { const a = getAssignment(m.id); return a.sentAt && !a.date_finished; });
  } else if (filterStatus === "fertig") {
    result = result.filter(m => !!getAssignment(m.id).date_finished);
  } else if (filterStatus) {
    result = result.filter(m => mangelStatusGroup(m) === filterStatus);
  }

  return [...result].sort((a, b) => {
    switch (sortBy) {
      case "deadline": {
        const da = parseDate(a.fertigstellung), db = parseDate(b.fertigstellung);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
        return da - db;
      }
      case "deadline_desc": {
        const da = parseDate(a.fertigstellung), db = parseDate(b.fertigstellung);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
        return db - da;
      }
      case "address": return (a.address || "").localeCompare(b.address || "", "de");
      case "progress": {
        const ca = checkedCount(a), cb = checkedCount(b);
        return (ca.total ? ca.done/ca.total : 0) - (cb.total ? cb.done/cb.total : 0);
      }
      case "start": {
        const da = parseDate(a.ausfuehrungsbeginn), db = parseDate(b.ausfuehrungsbeginn);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
        return da - db;
      }
      default: return 0;
    }
  });
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  const active   = MAENGEL.filter(m => m.mangel_status !== "geprueft");
  const geprueft = MAENGEL.filter(m => m.mangel_status === "geprueft");
  const neuHeute = active.filter(isNewToday);

  let base, emptyMsg;
  if (showArchived === "leo") {
    base = ARCHIV_MAENGEL; emptyMsg = "LEO-Archiv leer";
  } else if (showArchived === "geprueft") {
    base = geprueft; emptyMsg = "Keine geprüften Mängel";
  } else {
    base = active; emptyMsg = "Keine aktiven Mängel";
  }

  // Neu heute сначала, потом остальные по deadline
  let list = applyFiltersAndSort(base);
  if (!showArchived) {
    const neu = list.filter(isNewToday);
    const rest = list.filter(m => !isNewToday(m));
    list = [...neu, ...rest];
  }

  // "Neu heute" banner — отдельный блок над сеткой
  const neuSection = document.getElementById("neuHeuteBanner");
  if (neuSection) {
    neuSection.innerHTML = (!showArchived && neuHeute.length)
      ? `<div class="neu-heute-bar">
           <span>✨ Neu heute — ${neuHeute.length} neue Mängelauftrag${neuHeute.length > 1 ? "träge" : ""}</span>
           <span class="neu-hint">Oben angezeigt</span>
         </div>`
      : "";
  }

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

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  document.getElementById("pageTitle").textContent = "Mängelaufträge";

  await loadPeople();

  const res = await fetch("data.json?" + Date.now());
  const data = await res.json();
  MAENGEL = data.maengel || [];
  ARCHIV_MAENGEL = data.archiv_maengel || [];

  if (data.updatedAt) {
    const d = new Date(data.updatedAt);
    document.getElementById("pageSub").textContent = "Stand: " + d.toLocaleString("de-DE");
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
