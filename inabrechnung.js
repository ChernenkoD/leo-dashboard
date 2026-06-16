let state = loadState();
let query = "";
let workflowQuery = "";

function toggleDoc(cardId, idx) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card || !card.docs) return;
  card.docs[idx].done = !card.docs[idx].done;
  saveState(state);
  render();
}

function setReview(cardId, status) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.reviewStatus = status;
  saveState(state);
  render();
}

function workflowKey(card) {
  const total = (card.docs || []).length;
  const done = (card.docs || []).filter(d => d.done).length;
  const allDone = total > 0 && done === total;
  if (card.reviewStatus === "invoiced") return "invoiced";
  if (card.reviewStatus === "approved") return "approved";
  if (card.reviewStatus === "submitted") return "submitted";
  return allDone ? "ready" : "collecting";
}

function renderCard(card) {
  const total = (card.docs || []).length;
  const done = (card.docs || []).filter(d => d.done).length;
  const allDone = total > 0 && done === total;
  const status = card.reviewStatus || null;

  let workflowHtml = "";
  if (!allDone) {
    workflowHtml = `<div class="workflow-hint">${t("workflow_hint")}</div>`;
  } else if (status === null) {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill ready">${t("status_ready")}</span>
        <button class="primary" onclick="setReview('${card.id}', 'submitted')">${t("btn_submit_review")}</button>
      </div>`;
  } else if (status === "submitted") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill submitted">${t("status_submitted")}</span>
        <button class="primary" onclick="setReview('${card.id}', 'approved')">${t("btn_approve")}</button>
      </div>`;
  } else if (status === "approved") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill approved">${t("status_approved")}</span>
        <button class="primary" onclick="setReview('${card.id}', 'invoiced')">${t("btn_invoice")}</button>
      </div>`;
  } else if (status === "invoiced") {
    workflowHtml = `
      <div class="workflow-row">
        <span class="status-pill invoiced">${t("status_invoiced")}</span>
      </div>`;
  }

  return `
    <div class="card">
      <div class="lws">${card.id}</div>
      <div class="address">${card.address}</div>
      <div class="lage">${card.lage}</div>
      <span class="tag">${t("docs_count", { done, total })} · ${card.hadMangel ? t("had_mangel") : t("no_mangel")}</span>
      <div class="docs">
        ${(card.docs || []).map((d, idx) => `
          <label class="doc-row">
            <input type="checkbox" ${d.done ? "checked" : ""} onchange="toggleDoc('${card.id}', ${idx})">
            <span class="${d.done ? "done" : ""}">${d.label}</span>
          </label>
        `).join("")}
      </div>
      ${workflowHtml}
    </div>
  `;
}

function fillWorkflowFilter() {
  document.getElementById("workflowFilter").innerHTML = `
    <option value="">${t("filter_all_workflow")}</option>
    <option value="collecting">${t("workflow_collecting")}</option>
    <option value="ready">${t("status_ready")}</option>
    <option value="submitted">${t("workflow_submitted_f")}</option>
    <option value="approved">${t("workflow_approved_f")}</option>
  `;
}

function render() {
  document.getElementById("pageTitle").textContent = t("invoiced_title");
  document.getElementById("pageSub").textContent = t("invoiced_sub");
  document.getElementById("search").placeholder = t("search_placeholder");

  const list = state.cards
    .filter(c => c.column === "done" && c.reviewStatus !== "invoiced")
    .filter(c => !workflowQuery || workflowKey(c) === workflowQuery)
    .filter(c => !query || [c.id, c.address].join(" ").toLowerCase().includes(query.toLowerCase()));

  document.getElementById("inabrechnungList").innerHTML = list.length
    ? list.map(renderCard).join("")
    : `<div class="empty-hint">${t("invoiced_empty")}</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  fillWorkflowFilter();
  render();
  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
  document.getElementById("workflowFilter").addEventListener("change", e => { workflowQuery = e.target.value; render(); });
});
