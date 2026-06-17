let allProjects = [];
let query = "";
let cityQuery = "";
let baustopOnly = false;
let mangelQuery = "";
let showArchived = false;

function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function parseDE(str) {
  if (!str) return null;
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function fmtDE(str) {
  if (!str) return "—";
  const d = parseDE(str);
  if (!d || isNaN(d)) return str;
  return d.toLocaleDateString("de-DE");
}

function toInputDate(str) {
  if (!str) return "";
  const [d, m, y] = str.split(".");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

function fromInputDate(val) {
  if (!val) return null;
  const [y, m, d] = val.split("-");
  return `${d}.${m}.${y}`;
}

// Planungsdatum: localStorage override per LWS, fallback = ende aus LEO
function getPlanung(lws, ende) {
  return localStorage.getItem(`plan_${lws}`) || ende || null;
}

function setPlanung(lws, dateStr) {
  if (dateStr) localStorage.setItem(`plan_${lws}`, dateStr);
  else localStorage.removeItem(`plan_${lws}`);
}

function isBaustop(p) { return !!p.baustopp; }

function isAbgeschlossen(p) {
  return p.abgeschlossen === true || p.fortschritt >= 100;
}

function filtered() {
  return allProjects.filter(p => {
    if (showArchived) {
      if (!isAbgeschlossen(p)) return false;
    } else {
      if (isAbgeschlossen(p)) return false;
    }
    if (baustopOnly) { if (!isBaustop(p)) return false; } else { if (isBaustop(p)) return false; }
    if (mangelQuery === "yes" && !p.has_mangel) return false;
    if (mangelQuery === "no" && p.has_mangel) return false;
    if (cityQuery) {
      const last = (p.address || "").split(",").pop()?.trim() || "";
      const city = last.replace(/^\d{4,5}\s*/, "").trim();
      if (city.toLowerCase() !== cityQuery.toLowerCase()) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      const hay = [p.lws, p.address, p.lage, p.bauleiter, p.status].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderBadge(p) {
  if (isBaustop(p)) {
    const tip = p.baustopp_start ? ` title="seit ${p.baustopp_start}"` : "";
    return `<span class="proj-badge baustop"${tip}>BAUSTOP</span>`;
  }
  if (isAbgeschlossen(p)) return `<span class="proj-badge abgeschlossen">Abgeschlossen</span>`;
  if (p.fortschritt > 0) return `<span class="proj-badge active">${p.fortschritt}%</span>`;
  return `<span class="proj-badge new">${p.status || "Neu"}</span>`;
}

function renderPlanCell(p) {
  const planung = getPlanung(p.lws, p.ende);
  const isOverridden = !!localStorage.getItem(`plan_${p.lws}`);
  return `<td class="plan-cell">
    <input type="date" class="plan-input${isOverridden ? " plan-overridden" : ""}"
      data-lws="${p.lws}" data-original="${toInputDate(p.ende)}"
      value="${toInputDate(planung)}"
      title="${isOverridden ? "Manuell (Doppelklick = zurücksetzen)" : "Planungsdatum ändern"}">
  </td>`;
}

function renderTable() {
  const list = filtered().sort((a, b) => {
    if (isBaustop(a) && !isBaustop(b)) return -1;
    if (!isBaustop(a) && isBaustop(b)) return 1;
    const da = parseDE(getPlanung(a.lws, a.ende));
    const db = parseDE(getPlanung(b.lws, b.ende));
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  const total = allProjects.filter(p => showArchived ? isAbgeschlossen(p) : !isAbgeschlossen(p)).length;
  document.getElementById("projCount").textContent = `${list.length} / ${total}`;

  const body = document.getElementById("projTableBody");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty-hint">Keine Projekte gefunden</td></tr>`;
    return;
  }

  body.innerHTML = list.map(p => {
    const mangelIcon = p.has_mangel
      ? `<span class="mangel-dot has" title="Hat Mängelauftrag">M</span>`
      : `<span class="mangel-dot none">—</span>`;
    const rowClass = isBaustop(p) ? ' class="row-baustop"' : "";
    const leoLink = p.leo_url
      ? `<a href="${p.leo_url}" target="_blank" class="lws-link">${p.lws}</a>`
      : p.lws;

    return `<tr${rowClass}>
      <td>${p.address || "—"}${p.lage ? `<div class="sub-cell">${p.lage}</div>` : ""}</td>
      <td class="lws-cell">${leoLink}</td>
      <td>${p.bauleiter || "—"}</td>
      <td>${fmtDE(p.start)}</td>
      <td>${fmtDE(p.ende)}</td>
      ${renderPlanCell(p)}
      <td>${p.amount ? fmtMoney(p.amount) : "—"}</td>
      <td>${renderBadge(p)}</td>
      <td>${mangelIcon}</td>
    </tr>`;
  }).join("");

  body.querySelectorAll(".plan-input").forEach(inp => {
    inp.addEventListener("change", e => {
      const lws = e.target.dataset.lws;
      const val = fromInputDate(e.target.value);
      const original = fromInputDate(e.target.dataset.original);
      setPlanung(lws, val === original ? null : val);
      renderTable();
    });
    inp.addEventListener("dblclick", e => {
      setPlanung(e.target.dataset.lws, null);
      renderTable();
    });
  });
}

function fillCityFilter() {
  const cities = [...new Set(allProjects.map(p => {
    const parts = (p.address || "").split(",");
    const last = parts[parts.length - 1]?.trim() || "";
    // Убираем PLZ (5 цифр в начале): "26382 Wilhelmshaven" → "Wilhelmshaven"
    return last.replace(/^\d{4,5}\s*/, "").trim();
  }).filter(Boolean))].sort();
  const sel = document.getElementById("cityFilter");
  sel.innerHTML = `<option value="">Alle Städte</option>` +
    cities.map(c => `<option value="${c}">${c}</option>`).join("");
}

function updateTabCounts() {
  const active = allProjects.filter(p => !isAbgeschlossen(p)).length;
  const archived = allProjects.filter(p => isAbgeschlossen(p)).length;
  document.getElementById("tabActive").textContent = `Aktiv (${active})`;
  document.getElementById("tabArchived").textContent = `Abgeschlossen (${archived})`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pageTitle").textContent = "Projekte";

  fetch("data.json?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      allProjects = data.projects || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      document.getElementById("pageSub").textContent = upd ? `Stand: ${upd}` : "";
      fillCityFilter();
      updateTabCounts();
      renderTable();
    })
    .catch(e => {
      document.getElementById("projTableBody").innerHTML =
        `<tr><td colspan="9" class="empty-hint">Fehler beim Laden: ${e.message}</td></tr>`;
    });

  document.getElementById("search").addEventListener("input", e => { query = e.target.value.trim(); renderTable(); });
  document.getElementById("cityFilter").addEventListener("change", e => { cityQuery = e.target.value; renderTable(); });
  document.getElementById("baustopFilter").addEventListener("change", e => { baustopOnly = e.target.checked; renderTable(); });
  document.getElementById("mangelFilter").addEventListener("change", e => { mangelQuery = e.target.value; renderTable(); });
  document.getElementById("tabActive").addEventListener("click", () => {
    showArchived = false;
    document.getElementById("tabActive").classList.add("tab-active");
    document.getElementById("tabArchived").classList.remove("tab-active");
    renderTable();
  });
  document.getElementById("tabArchived").addEventListener("click", () => {
    showArchived = true;
    document.getElementById("tabArchived").classList.add("tab-active");
    document.getElementById("tabActive").classList.remove("tab-active");
    renderTable();
  });
});
