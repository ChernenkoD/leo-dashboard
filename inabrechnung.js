let allProjects = [];
let query = "";
let workflowQuery = "";

// localStorage: inAbrechnung = [lws, ...] — список проектов отправленных в Abrechnung
// localStorage: inAbrStatus_{lws} = "collecting"|"ready"|"submitted"|"approved"|"invoiced"
// localStorage: inAbrDocs_{lws} = [true, false, ...] — чекбоксы документов

const DEFAULT_DOCS = [
  "E-Check Protokoll",
  "Fotos Sanitär",
  "Fotos Dämmung / Abdichtung",
  "Fotos nach Anstrich",
  "Zähler / Zählerantrag",
];

function getList() {
  try { return JSON.parse(localStorage.getItem("inAbrechnung") || "[]"); }
  catch { return []; }
}

function removeFromList(lws) {
  const list = getList().filter(l => l !== lws);
  localStorage.setItem("inAbrechnung", JSON.stringify(list));
}

function getDocs(lws) {
  try {
    const saved = JSON.parse(localStorage.getItem(`inAbrDocs_${lws}`) || "null");
    if (saved && saved.length === DEFAULT_DOCS.length) return saved;
  } catch {}
  return DEFAULT_DOCS.map(() => false);
}

function setDoc(lws, idx, val) {
  const docs = getDocs(lws);
  docs[idx] = val;
  localStorage.setItem(`inAbrDocs_${lws}`, JSON.stringify(docs));
  render();
}

function getStatus(lws) {
  return localStorage.getItem(`inAbrStatus_${lws}`) || null;
}

function setStatus(lws, status) {
  localStorage.setItem(`inAbrStatus_${lws}`, status);
  render();
}

function workflowKey(lws) {
  const docs = getDocs(lws);
  const allDone = docs.every(Boolean);
  const status = getStatus(lws);
  if (status === "invoiced") return "invoiced";
  if (status === "approved") return "approved";
  if (status === "submitted") return "submitted";
  return allDone ? "ready" : "collecting";
}

function renderCard(p) {
  const docs = getDocs(p.lws);
  const done = docs.filter(Boolean).length;
  const total = docs.length;
  const allDone = done === total;
  const status = getStatus(p.lws);
  const wk = workflowKey(p.lws);

  const leoLink = p.leo_url
    ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${p.lws}</a>`
    : p.lws;

  let workflowHtml = "";
  if (!allDone) {
    workflowHtml = `<div class="workflow-hint">Bitte alle Dokumente abhaken</div>`;
  } else if (!status) {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill ready">Bereit</span>
        <button class="primary" onclick="setStatus('${p.lws}', 'submitted')">Zur Prüfung einreichen</button>
      </div>`;
  } else if (status === "submitted") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill submitted">Eingereicht</span>
        <button class="primary" onclick="setStatus('${p.lws}', 'approved')">Genehmigen</button>
      </div>`;
  } else if (status === "approved") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill approved">Genehmigt</span>
        <button class="primary" onclick="setStatus('${p.lws}', 'invoiced')">Abrechnen</button>
      </div>`;
  } else if (status === "invoiced") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill invoiced">Abgerechnet</span>
        <button class="btn-archive" onclick="removeFromList('${p.lws}'); render()">Entfernen</button>
      </div>`;
  }

  return `
    <div class="card">
      <div class="lws">${leoLink}${p.has_mangel ? ' <span class="mangel-dot has" title="Hat Mängelauftrag">M</span>' : ""}</div>
      <div class="address">${p.address || "—"}</div>
      ${p.lage ? `<div class="lage">${p.lage}</div>` : ""}
      ${p.bauleiter ? `<div class="bauleiter-tag">BL: ${p.bauleiter}</div>` : ""}
      <span class="tag">${done}/${total} Dokumente</span>
      <div class="docs">
        ${DEFAULT_DOCS.map((label, idx) => `
          <label class="doc-row">
            <input type="checkbox" ${docs[idx] ? "checked" : ""} onchange="setDoc('${p.lws}', ${idx}, this.checked)">
            <span class="${docs[idx] ? "done" : ""}">${label}</span>
          </label>
        `).join("")}
      </div>
      ${workflowHtml}
    </div>
  `;
}

function render() {
  const lwsList = getList();
  let list = allProjects.filter(p => lwsList.includes(p.lws));

  if (workflowQuery) list = list.filter(p => workflowKey(p.lws) === workflowQuery);
  if (query) list = list.filter(p =>
    [p.lws, p.address, p.bauleiter].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  document.getElementById("inabrechnungList").innerHTML = list.length
    ? list.map(renderCard).join("")
    : `<div class="empty-hint">Keine Projekte in Abrechnung. Projekte über die Hauptseite hinzufügen.</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pageTitle").textContent = "In Abrechnung";

  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects = data.projects || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";

      document.getElementById("workflowFilter").innerHTML = `
        <option value="">Alle Status</option>
        <option value="collecting">Dokumente sammeln</option>
        <option value="ready">Bereit</option>
        <option value="submitted">Eingereicht</option>
        <option value="approved">Genehmigt</option>
      `;

      render();
    });

  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
  document.getElementById("workflowFilter").addEventListener("change", e => { workflowQuery = e.target.value; render(); });
});
