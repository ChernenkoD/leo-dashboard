// Общее хранилище карточек объектов — используется на всех страницах
const DEFAULT_DOCS = [
  { label: "E-Check протокол", done: false },
  { label: "Фото сантехники", done: false },
  { label: "Фото изоляции / гидроизоляции", done: false },
  { label: "Фото после покраски", done: false },
  { label: "Счётчик / Zählerantrag", done: false }
];

const CITIES = ["Wolfsburg", "Braunschweig", "Wilhelmshaven", "Hannover", "Göttingen", "Aurich", "Celle", "Hameln", "Salzgitter", "Bremervörde"];
const STREETS = ["Hauptstraße", "Lindenweg", "Schulstraße", "Bahnhofstraße", "Gartenweg", "Birkenallee", "Wiesenweg", "Ringstraße", "Parkstraße", "Mühlenweg", "Kirchweg", "Sonnenallee", "Am Bach", "Feldstraße", "Talweg", "Rosenstraße"];
const LAGEN = ["Erdgeschoss links", "Erdgeschoss rechts", "1. Obergeschoss links", "1. Obergeschoss rechts", "2. Obergeschoss links", "2. Obergeschoss rechts", "3. Obergeschoss links", "Dachgeschoss"];
const ZADEL_TAGS = ["neuer Mangelauftrag", "fehlende Nachweisdokumente", "Rechnung abgelehnt", "Nachweisdokument abgelehnt", "100% abgeschlossen", "in Vorbereitung"];

function buildDefaultCards() {
  const cards = [];
  let n = 75000;

  // 6 "в плане" (ещё не в Заделе)
  for (let i = 0; i < 6; i++) {
    n += 137;
    cards.push({
      id: `LWS-${n}`,
      address: `${STREETS[i % STREETS.length]} ${i + 1}, ${CITIES[i % CITIES.length]}`,
      city: CITIES[i % CITIES.length],
      lage: LAGEN[i % LAGEN.length],
      start: "—",
      ende: `2026-${String(8 + (i % 3)).padStart(2, "0")}-${String(10 + i).padStart(2, "0")}`,
      tag: "neues Projekt",
      column: "plan",
      docs: null,
      hadMangel: i % 4 === 0,
      amount: 1200 + (i * 731) % 9000
    });
  }

  // 28 "Задел" — растянуты по июню–октябрю 2026
  const months = ["06", "06", "06", "07", "07", "08", "08", "09", "10"];
  for (let i = 0; i < 28; i++) {
    n += 211;
    const month = months[i % months.length];
    const day = String(2 + (i * 3) % 27).padStart(2, "0");
    cards.push({
      id: `LWS-${n}`,
      address: `${STREETS[(i + 3) % STREETS.length]} ${i + 4}, ${CITIES[(i + 2) % CITIES.length]}`,
      city: CITIES[(i + 2) % CITIES.length],
      lage: LAGEN[(i + 1) % LAGEN.length],
      start: `2026-${month}-${String(Math.max(1, +day - 9)).padStart(2, "0")}`,
      ende: `2026-${month}-${day}`,
      tag: ZADEL_TAGS[i % ZADEL_TAGS.length],
      column: "zadel",
      docs: null,
      hadMangel: i % 3 === 0,
      amount: 2500 + (i * 947) % 16000
    });
  }

  // 6 "в работе по документам / in Abrechnung" — для демонстрации этой страницы
  const docVariants = [
    { docs: [{ label: "E-Check протокол", done: true }, { label: "Фото сантехники", done: true }, { label: "Фото изоляции / гидроизоляции", done: false }, { label: "Фото после покраски", done: false }], reviewStatus: null },
    { docs: [{ label: "E-Check протокол", done: false }, { label: "Счётчик / Zählerantrag", done: false }], reviewStatus: null },
    { docs: [{ label: "E-Check протокол", done: true }, { label: "Фото сантехники", done: true }], reviewStatus: "submitted" },
    { docs: [{ label: "E-Check протокол", done: true }, { label: "Фото изоляции / гидроизоляции", done: true }, { label: "Счётчик / Zählerantrag", done: true }], reviewStatus: "approved" },
    { docs: [{ label: "E-Check протокол", done: true }, { label: "Фото сантехники", done: true }], reviewStatus: "invoiced" },
    { docs: [{ label: "E-Check протокол", done: true }, { label: "Счётчик / Zählerantrag", done: true }, { label: "Фото после покраски", done: true }], reviewStatus: "invoiced" }
  ];
  for (let i = 0; i < 6; i++) {
    n += 173;
    cards.push({
      id: `LWS-${n}`,
      address: `${STREETS[(i + 7) % STREETS.length]} ${i + 10}, ${CITIES[(i + 5) % CITIES.length]}`,
      city: CITIES[(i + 5) % CITIES.length],
      lage: LAGEN[(i + 3) % LAGEN.length],
      start: `2026-0${6 + (i % 2)}-0${1 + i}`,
      ende: `2026-0${6 + (i % 2)}-1${i}`,
      tag: "100% abgeschlossen",
      column: "done",
      docs: docVariants[i].docs,
      reviewStatus: docVariants[i].reviewStatus,
      hadMangel: i % 2 === 0,
      amount: 3000 + (i * 1583) % 12000
    });
  }

  cards.forEach(c => { c.plannedDate = c.ende; });
  return cards;
}

const DEFAULT_STATE = { cards: buildDefaultCards() };

const STORAGE_KEY = "leo-board-state-v6";

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function statusInfo(card) {
  if (card.column === "done" && card.reviewStatus === "invoiced") {
    return { key: "archived", label: t("status_archived") };
  }
  if (card.column === "done") {
    return { key: "documents", label: t("status_documents") };
  }
  if (card.column === "zadel") {
    return { key: "waiting", label: t("status_waiting") };
  }
  return { key: "active", label: t("status_active") };
}

function fmtDate(iso) {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU");
}

function daysUntil(iso) {
  if (!iso || iso === "—") return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso);
  return Math.round((d - today) / 86400000);
}

// Плановая дата сдачи: если её отредактировали вручную — используем её, иначе берём дату окончания проекта
function effectiveDate(card) {
  return card.plannedDate || card.ende;
}

function isPlannedEdited(card) {
  return card.plannedDate && card.plannedDate !== card.ende;
}

function monthKey(iso) {
  if (!iso || iso === "—") return null;
  return iso.slice(0, 7); // "2026-06"
}

const MONTH_NAMES = {
  ru: ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"],
  de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
};

function monthLabel(key) {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const lang = getLang();
  return `${MONTH_NAMES[lang][+m - 1]} ${y}`;
}

function fmtMoney(n) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n) + " €";
}

// Понедельник той недели, в которую попадает дата iso
function weekStart(iso) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // 0 = понедельник
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekRangeLabel(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);
  const fmt = d => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(startDate)}–${fmt(end)}`;
}

function isThisWeek(iso) {
  if (!iso || iso === "—") return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ws = weekStart(today.toISOString());
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  const d = new Date(iso);
  return d >= ws && d <= we;
}
