function renderSidebar(active) {
  const items = [
    { key: "home", label: t("nav_home"), href: "index.html", icon: "🏠" },
    { key: "projects", label: t("nav_projects"), href: "projects.html", icon: "📁" },
    { key: "mangel", label: t("nav_mangel"), href: "mangel.html", icon: "⚠️" },
    { key: "invoiced", label: t("nav_invoiced"), href: "inabrechnung.html", icon: "🧾" },
    { key: "stats", label: t("nav_stats"), href: "statistics.html", icon: "📊" }
  ];
  const lang = getLang();
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">LEO <span>Board</span></div>
      <nav>
        ${items.map(i => `
          <a class="side-link ${i.key === active ? "active" : ""}" href="${i.href}">
            <span class="ic">${i.icon}</span>${i.label}
          </a>
        `).join("")}
      </nav>
      <div class="sidebar-foot">
        <div class="lang-switch">
          <button class="${lang === "ru" ? "active" : ""}" onclick="setLang('ru')">RU</button>
          <button class="${lang === "de" ? "active" : ""}" onclick="setLang('de')">DE</button>
        </div>
        <div class="company">L.K. Bauservice GmbH</div>
      </div>
    </aside>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("sidebar-mount");
  if (mount) mount.outerHTML = renderSidebar(mount.dataset.active);
});
