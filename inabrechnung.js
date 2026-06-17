let allProjects = [];
let filterStatus = "";

const STAGES = [
  { key: "collecting", label: "Dokumente sammeln", color: "#f59e0b", icon: "📋" },
  { key: "ready",      label: "Bereit zur Einreichung", color: "#3b82f6", icon: "✅" },
  { key: "submitted",  label: "Eingereicht",       color: "#8b5cf6", icon: "📤" },
  { key: "approved",   label: "Genehmigt",         color: "#10b981", icon: "👍" },
  { key: "invoiced",   label: "Rechnung gestellt", color: "#059669", icon: "🧾" },
];

const DOCS = [
  "Abnahmeprotokoll",
  "Schlussrechnung",
  "Aufmaß",
  "Mängelprotokoll",
  "Sonstiges",
];

function fmtMoney(n) {
  if (!n) return "—";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtDE(str) {
  if (!str) return "—";
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return str;
  return new Date(+y, +m-1, +d).toLocaleDateString("de-DE");
}

function getList() {
  try { return JSON.parse(localStorage.getItem("inAbrechnung") || "[]"); }
  catch { return []; }
}

function removeFromList(lws) {
  const list = getList().filter(l => l !== lws);
  localStorage.setItem("inAbrechnung", JSON.stringify(list));
  // Очищаем данные
  localStorage.removeItem(`inAbrStatus_${lws}`);
  localStorage.removeItem(`inAbrDocs_${lws}`);
  localStorage.removeItem(`inAbrNote_${lws}`);
  localStorage.removeItem(`inAbrDate_${lws}`);
  render();
}

function getStatus(lws)  { return localStorage.getItem(`inAbrStatus_${lws}`) || "collecting"; }
function setStatus(lws, v) { localStorage.setItem(`inAbrStatus_${lws}`, v); }

function getDocs(lws) {
  try { return JSON.parse(localStorage.getItem(`inAbrDocs_${lws}`) || "{}"); }
  catch { return {}; }
}
function setDoc(lws, doc, val) {
  const d = getDocs(lws); d[doc] = val;
  localStorage.setItem(`inAbrDocs_${lws}`, JSON.stringify(d));
}

function getNote(lws) { return localStorage.getItem(`inAbrNote_${lws}`) || ""; }
function setNote(lws, v) { localStorage.setItem(`inAbrNote_${lws}`, v); }

function getAbrDate(lws) { return localStorage.getItem(`inAbrDate_${lws}`) || new Date().toISOString().slice(0,10); }

function renderCard(p) {
  const status = getStatus(p.lws);
  const docs   = getDocs(p.lws);
  const note   = getNote(p.lws);
  const stage  = STAGES.find(s => s.key === status) || STAGES[0];
  const docsOk = DOCS.filter(d => docs[d]).length;

  return `
  <div class="abr-card" data-lws="${p.lws}">
    <div class="abr-card-head">
      <div>
        <div class="abr-lws">${p.leo_url
          ? `<a href="${p.leo_url}" target="_blank" class="lws-link">${p.lws}</a>`
          : p.lws}</div>
        <div class="abr-address">${p.address || "—"}${p.lage ? ` · ${p.lage}` : ""}</div>
      </div>
      <div style="text-align:right">
        ${p.amount ? `<div class="abr-amount">${fmtMoney(p.amount)}</div>` : ""}
        <div class="abr-bl">${p.bauleiter || ""}</div>
      </div>
    </div>

    <!-- Воронка статусов -->
    <div class="abr-stages">
      ${STAGES.map(s => `
        <button class="abr-stage-btn${s.key === status ? " active" : ""}"
          style="${s.key === status ? `background:${s.color};color:#fff` : ""}"
          onclick="setStatus('${p.lws}','${s.key}');render()"
          title="${s.label}">${s.icon} ${s.label}</button>
      `).join("")}
    </div>

    <!-- Чеклист документов -->
    <div class="abr-docs">
      <div class="abr-docs-title">Dokumente (${docsOk}/${DOCS.length})</div>
      <div class="abr-docs-list">
        ${DOCS.map(doc => `
          <label class="abr-doc-item${docs[doc] ? " checked" : ""}">
            <input type="checkbox" ${docs[doc] ? "checked" : ""}
              onchange="setDoc('${p.lws}','${doc}',this.checked);render()">
            ${doc}
          </label>
        `).join("")}
      </div>
    </div>

    <!-- Заметка -->
    <textarea class="abr-note" placeholder="Notiz…"
      onblur="setNote('${p.lws}',this.value)">${note}</textarea>

    <!-- Дата добавления + удалить -->
    <div class="abr-footer">
      <span class="abr-date-tag">In Abrechnung seit: ${fmtDE(getAbrDate(p.lws).split("-").reverse().join("."))}</span>
      <button class="abr-remove-btn" onclick="if(confirm('${p.lws} aus Abrechnung entfernen?'))removeFromList('${p.lws}')">
        ✕ Entfernen
      </button>
    </div>
  </div>`;
}

function render() {
  const lwsList = getList();
  const projects = lwsList
    .map(lws => allProjects.find(p => p.lws === lws))
    .filter(Boolean);

  // Счётчики по статусам
  const counts = {};
  STAGES.forEach(s => counts[s.key] = 0);
  projects.forEach(p => { const st = getStatus(p.lws); if (counts[st] !== undefined) counts[st]++; });

  // Фильтр
  const visible = filterStatus
    ? projects.filter(p => getStatus(p.lws) === filterStatus)
    : projects;

  document.getElementById("pageTitle").textContent = `In Abrechnung (${projects.length})`;

  // Воронка-хедер
  document.getElementById("abrFunnel").innerHTML = STAGES.map(s => `
    <button class="funnel-btn${filterStatus === s.key ? " funnel-active" : ""}"
      style="${filterStatus === s.key ? `border-color:${s.color};color:${s.color}` : ""}"
      onclick="filterStatus=filterStatus==='${s.key}'?'':'${s.key}';render()">
      ${s.icon} ${s.label} <b>${counts[s.key]}</b>
    </button>
  `).join("");

  const body = document.getElementById("abrBody");
  if (!projects.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:60px 0;text-align:center">
      Keine Projekte in Abrechnung.<br>
      <small>Auf der Hauptseite "Fertig → Abrechnung" klicken.</small>
    </div>`;
    return;
  }
  if (!visible.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:40px 0;text-align:center">Kein Projekt in diesem Status.</div>`;
    return;
  }
  body.innerHTML = visible.map(renderCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects = data.projects || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";

      // Сохраняем дату добавления если ещё не было
      getList().forEach(lws => {
        if (!localStorage.getItem(`inAbrDate_${lws}`)) {
          localStorage.setItem(`inAbrDate_${lws}`, new Date().toISOString().slice(0,10));
        }
      });

      render();
    });
});
