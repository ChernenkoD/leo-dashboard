// ============================================================
// planer.js — Übergabe-Planer, Geld, Ereignisse
// Alles was zum Planen gebraucht wird auf einem Screen.
// ============================================================

let PROJECTS = [], HANDOVER = {}, CHAT = [], CHANGES = [], BZP = {}, MAENGEL = [];
let CHAT_UNREAD = 0;
let currentPlanTab = "plan";
let pfBauleiter = "", pfStadt = "", pfNurProblem = false;
let eventFilter = "";

const GEWERK_ICON = {
  "Elektro": "⚡", "Sanitär": "🚿", "Fliesen": "🧱", "Maler": "🎨",
  "Boden": "🪵", "Tischler": "🚪", "Reinigung": "🧹", "Maurer": "🧰",
  "Asbest": "☣️", "Sonstige": "🔧",
};

const TAG_META = {
  storniert:     { icon: "🛑", label: "Storniert",    color: "#dc2626" },
  termin:        { icon: "📅", label: "Termin",       color: "#d97706" },
  neuer_auftrag: { icon: "🆕", label: "Neuer Auftrag", color: "#2563eb" },
  nachtrag:      { icon: "📎", label: "Nachtrag",     color: "#7c3aed" },
  mangel:        { icon: "⚠️", label: "Mangel",       color: "#dc2626" },
  foto:          { icon: "📸", label: "Fotos",        color: "#0891b2" },
  dokument:      { icon: "📄", label: "Dokumente",    color: "#4b5563" },
  termin_info:   { icon: "🏠", label: "Wohnung",      color: "#059669" },
  sonstiges:     { icon: "💬", label: "Sonstiges",    color: "#6b7280" },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function parseDE(s) {
  if (!s) return null;
  const [d, m, y] = String(s).split(".");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}
function parseDETime(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : parseDE(s);
}
function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function daysUntil(s) { const d = parseDE(s); return d ? Math.round((d - today0()) / 86400000) : null; }
function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function cityOf(p) {
  const last = (p.address || "").split(",").pop()?.trim() || "";
  return last.replace(/^\d{4,5}\s*/, "").trim();
}
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function projectByLws(lws) { return PROJECTS.find(p => p.lws === lws); }

function isActive(p) {
  return !p.abgeschlossen && !p.is_ghost && (p.fortschritt || 0) < 100;
}

// Проблемы, из-за которых квартиру нельзя сдать вовремя
function problemsOf(p) {
  const out = [];
  if (p.baustopp) out.push({ icon: "⛔", text: "Baustopp" });
  if (p.has_mangel) out.push({ icon: "⚠️", text: "Offene Mängel" });
  const d = daysUntil(p.ende);
  if (d !== null && d < 0) out.push({ icon: "🔴", text: `${Math.abs(d)} Tage überfällig` });
  const h = HANDOVER[p.lws];
  if (h && !h.vermietet && (p.fortschritt || 0) >= 100) out.push({ icon: "🏠", text: "Fertig, nicht vermietet" });
  if (p.leistung_geprueft && !p.abgerechnet) out.push({ icon: "💶", text: "Nicht abgerechnet" });
  return out;
}

// ── tabs ──────────────────────────────────────────────────────────────────────
function switchPlanTab(tab) {
  currentPlanTab = tab;
  [["plan", "planSection", "tabPlan"], ["geld", "geldSection", "tabGeld"], ["events", "eventsSection", "tabEvents"]]
    .forEach(([key, sec, btn]) => {
      const s = document.getElementById(sec), b = document.getElementById(btn);
      if (s) s.style.display = key === tab ? "flex" : "none";
      if (b) b.classList.toggle("active", key === tab);
    });
  if (tab === "plan") renderPlan();
  if (tab === "geld") renderGeld();
  if (tab === "events") renderEvents();
}

// ── TAB 1: план сдачи по неделям ──────────────────────────────────────────────
function planFiltered() {
  return PROJECTS.filter(p => {
    if (!isActive(p)) return false;
    if (pfBauleiter && p.bauleiter !== pfBauleiter) return false;
    if (pfStadt && cityOf(p) !== pfStadt) return false;
    if (pfNurProblem && problemsOf(p).length === 0) return false;
    return true;
  });
}

// Корзины: просрочено / эта неделя / следующая / через 2 / этот месяц / позже
function bucketOf(p) {
  const d = daysUntil(p.ende);
  if (d === null) return "ohne";
  if (d < 0) return "overdue";
  if (d <= 6) return "week0";
  if (d <= 13) return "week1";
  if (d <= 20) return "week2";
  if (d <= 45) return "later";
  return "future";
}

const BUCKETS = [
  { key: "overdue", title: "🔴 Überfällig",        color: "#dc2626" },
  { key: "week0",   title: "🗓 Diese Woche",       color: "#d97706" },
  { key: "week1",   title: "📆 Nächste Woche",     color: "#2563eb" },
  { key: "week2",   title: "📆 In 2 Wochen",       color: "#0891b2" },
  { key: "later",   title: "🔭 Bis in 6 Wochen",   color: "#059669" },
  { key: "future",  title: "⏳ Später",            color: "#6b7280" },
  { key: "ohne",    title: "❔ Ohne Termin",       color: "#9ca3af" },
];

function gewerkStrip(lws) {
  const g = BZP[lws];
  if (!g || !g.length) return "";
  const now = today0();
  // одна строка на Gewerk — берём самый ранний интервал
  const byG = {};
  g.forEach(x => {
    const von = parseDE(x.von);
    if (!byG[x.gewerk] || (von && parseDE(byG[x.gewerk].von) > von)) byG[x.gewerk] = x;
  });
  const items = Object.values(byG).sort((a, b) => (parseDE(a.von) || 0) - (parseDE(b.von) || 0));
  return `<div class="gewerk-strip">${items.map(x => {
    const von = parseDE(x.von), bis = parseDE(x.bis);
    const done = bis && bis < now;
    const active = von && bis && von <= now && now <= bis;
    const cls = done ? "gw-done" : active ? "gw-active" : "gw-plan";
    const icon = GEWERK_ICON[x.gewerk] || "🔧";
    return `<span class="gw ${cls}" title="${esc(x.gewerk)}: ${x.von} – ${x.bis}">${icon} ${x.von.slice(0, 5)}</span>`;
  }).join("")}</div>`;
}

function planCard(p) {
  const d = daysUntil(p.ende);
  const probs = problemsOf(p);
  const h = HANDOVER[p.lws];
  const link = p.leo_url
    ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${p.lws}</a>` : p.lws;
  const money = p.amount ? `<span class="pc-money">${fmtMoney(p.amount)}</span>` : "";
  const unbilled = p.leistung_geprueft && !p.abgerechnet;
  return `
    <div class="plan-card${probs.length ? " plan-card-problem" : ""}">
      <div class="pc-head">
        <span class="pc-lws">${link}</span>
        <span class="pc-due${d !== null && d < 0 ? " pc-due-late" : ""}">${p.ende || "—"}</span>
      </div>
      <div class="pc-addr">${esc(p.address || "—")}</div>
      ${p.lage ? `<div class="pc-lage">${esc(p.lage)}</div>` : ""}
      ${gewerkStrip(p.lws)}
      <div class="pc-foot">
        <span class="pc-bl">${esc(p.bauleiter || "—")}</span>
        ${money}
      </div>
      <div class="pc-progress"><div class="pc-progress-bar" style="width:${p.fortschritt || 0}%"></div></div>
      ${probs.length ? `<div class="pc-probs">${probs.map(x =>
        `<span class="pc-prob">${x.icon} ${esc(x.text)}</span>`).join("")}</div>` : ""}
      ${h && !h.vermietet && h.leerstand_seit
        ? `<div class="pc-leer">🏠 leer seit ${h.leerstand_seit}</div>` : ""}
      ${unbilled ? `<div class="pc-leer">💶 abgenommen ${p.leistung_geprueft}, nicht abgerechnet</div>` : ""}
    </div>`;
}

function renderPlan() {
  const list = planFiltered();
  const groups = {};
  list.forEach(p => { (groups[bucketOf(p)] ||= []).push(p); });
  Object.values(groups).forEach(g => g.sort((a, b) => (parseDE(a.ende) || 0) - (parseDE(b.ende) || 0)));

  const info = document.getElementById("pfInfo");
  if (info) info.textContent = `${list.length} aktive Projekte`;

  const withProblem = list.filter(p => problemsOf(p).length).length;
  const sumWeek = (groups.week0 || []).reduce((s, p) => s + (p.amount || 0), 0);
  const readyHandover = Object.entries(HANDOVER).filter(([, h]) => !h.vermietet).length;
  document.getElementById("planKPI").innerHTML = [
    { v: (groups.week0 || []).length, l: "Diese Woche fällig", sub: fmtMoney(sumWeek) },
    { v: (groups.overdue || []).length, l: "Überfällig", color: (groups.overdue || []).length ? "#dc2626" : "" },
    { v: withProblem, l: "Mit Problemen", color: withProblem ? "#d97706" : "" },
    { v: readyHandover, l: "Zur Übergabe bereit" },
  ].map(k => `<div class="kpi-card">
      <div class="kpi-value" style="${k.color ? `color:${k.color}` : ""}">${k.v}</div>
      <div class="kpi-label">${k.l}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ""}
    </div>`).join("");

  document.getElementById("planBuckets").innerHTML = BUCKETS.map(b => {
    const g = groups[b.key] || [];
    if (!g.length) return "";
    const sum = g.reduce((s, p) => s + (p.amount || 0), 0);
    return `<section class="plan-bucket">
      <div class="plan-bucket-head" style="border-left:4px solid ${b.color}">
        <span class="pb-title">${b.title}</span>
        <span class="pb-count">${g.length}</span>
        <span class="pb-sum">${fmtMoney(sum)}</span>
      </div>
      <div class="plan-bucket-grid">${g.map(planCard).join("")}</div>
    </section>`;
  }).join("") || `<div class="empty-hint">Keine Projekte</div>`;
}

function resetPlanerFilter() {
  pfBauleiter = pfStadt = ""; pfNurProblem = false;
  ["pfBauleiter", "pfStadt"].forEach(id => { const e = document.getElementById(id); if (e) e.value = ""; });
  const c = document.getElementById("pfNurProblem"); if (c) c.checked = false;
  renderPlan();
}

// ── TAB 2: деньги ─────────────────────────────────────────────────────────────
function moneyRow(p, extra) {
  const link = p.leo_url ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${p.lws}</a>` : p.lws;
  return `<div class="woche-list-item">
    <div class="woche-list-id">${link} · ${fmtMoney(p.amount || 0)}</div>
    <div class="woche-list-addr">${esc(p.address || "—")}</div>
    <div class="woche-list-sub">${extra}${p.bauleiter ? ` · ${esc(p.bauleiter)}` : ""}</div>
  </div>`;
}

function renderGeld() {
  const active = PROJECTS.filter(p => !p.is_ghost && p.amount);
  const unbilled = active.filter(p => p.leistung_geprueft && !p.abgerechnet)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const unchecked = active.filter(p => (p.fortschritt || 0) >= 100 && !p.leistung_geprueft && !p.abgeschlossen)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const partial = active.filter(p => p.abgerechnet > 0 && p.amount && p.abgerechnet < p.amount * 0.99)
    .sort((a, b) => ((b.amount - b.abgerechnet) - (a.amount - a.abgerechnet)));

  const sum = arr => arr.reduce((s, p) => s + (p.amount || 0), 0);
  const gap = partial.reduce((s, p) => s + ((p.amount || 0) - (p.abgerechnet || 0)), 0);

  document.getElementById("geldKPI").innerHTML = [
    { v: fmtMoney(sum(unbilled)), l: "Abgenommen, nicht abgerechnet", color: sum(unbilled) ? "#dc2626" : "", sub: `${unbilled.length} Projekte` },
    { v: fmtMoney(sum(unchecked)), l: "Fertig, nicht abgenommen", sub: `${unchecked.length} Projekte` },
    { v: fmtMoney(gap), l: "Teilabrechnung offen", sub: `${partial.length} Projekte` },
  ].map(k => `<div class="kpi-card">
      <div class="kpi-value" style="font-size:20px;${k.color ? `color:${k.color}` : ""}">${k.v}</div>
      <div class="kpi-label">${k.l}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ""}
    </div>`).join("");

  const fill = (id, arr, fn, empty) => {
    document.getElementById(id).innerHTML = arr.length
      ? arr.slice(0, 25).map(fn).join("") : `<div class="empty-hint">${empty}</div>`;
  };
  fill("geldUnbilled", unbilled, p => moneyRow(p, `✅ geprüft ${p.leistung_geprueft}`),
    "Alles abgerechnet 🎉");
  fill("geldUnchecked", unchecked, p => moneyRow(p, `🔨 100% fertig, wartet auf Abnahme`),
    "Nichts offen");
  fill("geldPartial", partial, p =>
    moneyRow(p, `abgerechnet ${fmtMoney(p.abgerechnet)} — offen ${fmtMoney((p.amount || 0) - (p.abgerechnet || 0))}`),
    "Keine Teilabrechnungen");
}

// ── TAB 3: события ────────────────────────────────────────────────────────────
function renderEventFilters() {
  const counts = {};
  CHAT.forEach(m => { counts[m.tag] = (counts[m.tag] || 0) + 1; });
  const tags = Object.keys(TAG_META).filter(t => counts[t]);
  document.getElementById("eventFilters").innerHTML =
    `<button class="plan-preset-btn${eventFilter === "" ? " plan-preset-active" : ""}" onclick="setEventFilter('')">Alle (${CHAT.length})</button>` +
    tags.map(t => `<button class="plan-preset-btn${eventFilter === t ? " plan-preset-active" : ""}"
      onclick="setEventFilter('${t}')">${TAG_META[t].icon} ${TAG_META[t].label} (${counts[t]})</button>`).join("");
}
function setEventFilter(t) { eventFilter = t; renderEvents(); }

function renderEvents() {
  renderEventFilters();
  const unreadEl = document.getElementById("chatUnread");
  if (unreadEl) unreadEl.textContent = CHAT_UNREAD ? `${CHAT_UNREAD} ungelesen in LEO` : "";

  const msgs = (eventFilter ? CHAT.filter(m => m.tag === eventFilter) : CHAT)
    .slice().sort((a, b) => (parseDETime(b.date) || 0) - (parseDETime(a.date) || 0));

  document.getElementById("chatFeed").innerHTML = msgs.length ? msgs.slice(0, 60).map(m => {
    const meta = TAG_META[m.tag] || TAG_META.sonstiges;
    const p = projectByLws(m.lws);
    const link = p?.leo_url
      ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${m.lws}</a>`
      : (m.lws || "—");
    return `<div class="woche-list-item" style="border-left:3px solid ${meta.color}">
      <div class="woche-list-id">${meta.icon} ${link}
        <span style="color:var(--muted);font-weight:400"> · ${esc(m.date || "")}</span></div>
      <div class="woche-list-addr">${esc(m.message || "")}</div>
      <div class="woche-list-sub">${esc(m.address || "")}${m.from ? ` · ${esc(m.from)}` : ""}</div>
    </div>`;
  }).join("") : `<div class="empty-hint">Keine Nachrichten</div>`;

  const ch = CHANGES.slice().reverse();
  document.getElementById("changeFeed").innerHTML = ch.length ? ch.slice(0, 60).map(c => {
    const p = projectByLws(c.lws);
    const link = p?.leo_url
      ? `<a href="${p.leo_url}" target="_blank" class="lws-link-home">${c.lws}</a>` : c.lws;
    const when = c.at ? new Date(c.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    const isDate = c.field === "ende" || c.field === "start";
    return `<div class="woche-list-item" style="border-left:3px solid ${isDate ? "#d97706" : "#6b7280"}">
      <div class="woche-list-id">${isDate ? "📅" : "🔄"} ${link}
        <span style="color:var(--muted);font-weight:400"> · ${when}</span></div>
      <div class="woche-list-addr"><b>${esc(c.label)}</b>:
        <span style="color:#b91c1c">${esc(c.from ?? "—")}</span> →
        <span style="color:#15803d;font-weight:700">${esc(c.to ?? "—")}</span></div>
      <div class="woche-list-sub">${esc(p?.address || "")}</div>
    </div>`;
  }).join("") : `<div class="empty-hint">Noch keine Änderungen erfasst — der Vergleich startet ab dem nächsten Scrape</div>`;
}

// ── init ──────────────────────────────────────────────────────────────────────
function fillSelect(id, values, label) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${label}</option>` +
    [...new Set(values)].filter(Boolean).sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json")
    .then(r => r.json())
    .then(data => {
      PROJECTS = data.projects || [];
      HANDOVER = data.handover || {};
      CHAT = data.chat || [];
      CHAT_UNREAD = data.chat_unread || 0;
      CHANGES = data.change_log || [];
      BZP = data.bzp || {};
      MAENGEL = data.maengel || [];
      const upd = data.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : "";
      const sub = document.getElementById("pageSub");
      if (sub) sub.textContent = upd ? `Stand: ${upd}` : "";

      const act = PROJECTS.filter(isActive);
      fillSelect("pfBauleiter", act.map(p => p.bauleiter), "Alle Bauleiter");
      fillSelect("pfStadt", act.map(cityOf), "Alle Städte");
      renderPlan();
    })
    .catch(e => {
      document.getElementById("planBuckets").innerHTML =
        `<div class="empty-hint">Fehler beim Laden: ${esc(e.message)}</div>`;
    });

  document.getElementById("pfBauleiter").addEventListener("change", e => { pfBauleiter = e.target.value; renderPlan(); });
  document.getElementById("pfStadt").addEventListener("change", e => { pfStadt = e.target.value; renderPlan(); });
  document.getElementById("pfNurProblem").addEventListener("change", e => { pfNurProblem = e.target.checked; renderPlan(); });
});
