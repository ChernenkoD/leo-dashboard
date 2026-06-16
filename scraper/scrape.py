"""
Запускается в GitHub Actions по расписанию (2 раза в день).
Берёт сохранённую сессию LEO (секрет LEO_SESSION), заходит в LEO,
собирает Aufgaben и Mangelaufträge, пишет data.json.

Если сессия протухла — скрипт это обнаружит и завершится с понятной
ошибкой, ничего не поломав в data.json.
"""

import json
import re
import sys
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

BASE = "https://leo-pro.de"
STORAGE_STATE = "storage_state.json"
OUTPUT_FILE = "../data.json"


def is_logged_out(page):
    try:
        return page.get_by_text("Alle Aufgaben").count() == 0
    except Exception:
        return True


def lines_of(text):
    return [l.strip() for l in text.split("\n") if l.strip()]


def click_next_and_wait(page):
    next_link = page.locator("text=Nächste").first
    if next_link.count() == 0:
        return False
    try:
        next_link.click()
        page.wait_for_load_state("networkidle", timeout=5000)
        return True
    except Exception:
        return False


def parse_task_block(text):
    lines = lines_of(text)
    if not lines:
        return None
    lws_match = re.search(r"(?<!M-)LWS-\d+", text)
    leg_match = re.search(r"LEG-\d+-\d+", text)
    dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", text)
    return {
        "type": lines[0],
        "address": lines[1] if len(lines) > 1 and lws_match else None,
        "lws": lws_match.group(0) if lws_match else None,
        "leg": leg_match.group(0) if leg_match else None,
        "due": dates[-1] if dates else None,
    }


def parse_tasks(page):
    page.goto(f"{BASE}/index.php")
    page.wait_for_load_state("networkidle")
    if is_logged_out(page):
        raise RuntimeError("Сессия LEO протухла — нужно перелогиниться локально и обновить LEO_SESSION secret")

    seen_keys = set()
    tasks = []
    for _ in range(20):
        blocks = page.locator("text=/(?<!M-)LWS-\\d+/").all()
        new_found = False
        for block in blocks:
            row = block.locator("xpath=ancestor::tr[1]")
            if row.count() == 0:
                continue
            text = row.first.inner_text().strip()
            task = parse_task_block(text)
            if not task:
                continue
            key = (task["lws"], task["type"], task["due"])
            if key in seen_keys:
                continue
            seen_keys.add(key)
            tasks.append(task)
            new_found = True

        if not new_found:
            break
        if not click_next_and_wait(page):
            break

    return tasks


def parse_mangel_block(text):
    lines = lines_of(text)
    id_match = re.search(r"M-LWS-\d+-\d+", text)
    if not id_match:
        return None

    status_match = re.search(r"\(([a-zA-Zäöü]+)\)", text)
    leg_match = re.search(r"LEG-\d+-\d+", text)
    fortschritt_match = re.search(r"(\d+)%\s*abgeschlossen", text)
    dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", text)

    address = None
    lage = None
    bauleiter = None
    innendienst = None
    anzahl = None

    try:
        idx = lines.index("Ausführungsbeginn:")
        values = lines[idx + 4: idx + 8]
        if len(values) == 4:
            bauleiter, innendienst = values[2], values[3]
    except ValueError:
        pass

    for i, l in enumerate(lines):
        if l.startswith("Lage:"):
            lage = l.replace("Lage:", "").strip()
        if re.match(r"^[A-ZÄÖÜ].*\d.*,\s*\d{4,5}\s", l):
            address = l

    if lines and not address and len(lines) > 2:
        address = lines[2]  # лучшее приближение, если регулярка не сработала

    if lines and re.match(r"^\d+$", lines[-1]):
        anzahl = int(lines[-1])

    return {
        "id": id_match.group(0),
        "status": status_match.group(1) if status_match else None,
        "address": address,
        "lage": lage,
        "leg": leg_match.group(0) if leg_match else None,
        "fortschritt": int(fortschritt_match.group(1)) if fortschritt_match else None,
        "ausfuehrungsbeginn": dates[0] if len(dates) > 0 else None,
        "fertigstellung": dates[1] if len(dates) > 1 else None,
        "bauleiter": bauleiter,
        "innendienst": innendienst,
        "anzahl": anzahl,
    }


def parse_positionen(page):
    """
    Структура на странице детали:
      div.section → number (.inner), .lv-nummer p.top (код), p.bottom (gewerk), .badge-icon .label (статус)
    Рядом в DOM (siblings) лежат: p.kurztext (leistung), p.text-zusatz (bereich),
      div.text-apos p.kurztext (Mangelbeschreibung), div.section-price (menge)
    """
    positionen = []
    # Каждая позиция: section-description, section-text, section-price — соседи внутри apos-list-position
    containers = page.locator("div.apos-list-position").all()
    for container in containers:
        try:
            sec_desc = container.locator("div.section-description").first
            if sec_desc.count() == 0:
                continue

            code_el = sec_desc.locator("p.top").first
            if code_el.count() == 0:
                continue
            code = code_el.inner_text().strip()
            if not re.match(r"\d{2}\.\d{2}\.\d{2}\.\d{4}", code):
                continue

            gewerk = None
            g = sec_desc.locator("p.bottom").first
            if g.count() > 0:
                gewerk = g.inner_text().strip()

            status = None
            badge = sec_desc.locator(".badge-icon .label").first
            if badge.count() > 0:
                status = badge.inner_text().strip()

            sec_text = container.locator("div.section-text").first

            leistung = None
            bereich = None
            mangel_beschreibung = None

            if sec_text.count() > 0:
                # Leistung — первый p.kurztext не содержащий "Mangelbeschreibung"
                for el in sec_text.locator("p.kurztext").all():
                    t = el.inner_text().strip()
                    if t and "Mangelbeschreibung" not in t and len(t) > 5:
                        leistung = t
                        break

                # Bereich
                z = sec_text.locator("p.text-zusatz").first
                if z.count() > 0:
                    bereich = z.inner_text().strip()

                # Mangelbeschreibung — p.kurztext после метки
                kurzs = [e.inner_text().strip() for e in sec_text.locator("p.kurztext").all()]
                for i, t in enumerate(kurzs):
                    if "Mangelbeschreibung" in t and i + 1 < len(kurzs):
                        mangel_beschreibung = kurzs[i + 1]
                        break

            menge = None
            price_el = container.locator("div.section-price").first
            if price_el.count() > 0:
                menge = price_el.inner_text().strip().replace("\n", " ")

            positionen.append({
                "code": code,
                "gewerk": gewerk,
                "status": status,
                "leistung": leistung,
                "bereich": bereich,
                "mangel_beschreibung": mangel_beschreibung,
                "menge": menge,
            })
        except Exception:
            continue

    return positionen


def collect_mangel_list(page):
    """Шаг 1: собираем все Mängel и их URL со списка, без заходов внутрь."""
    page.goto(f"{BASE}/index.php")
    page.wait_for_load_state("networkidle")
    page.click("text=Projekte")
    page.click("text=Mangelaufträge")
    page.wait_for_load_state("networkidle")

    seen_ids = set()
    items = []  # list of (mangel_dict, detail_url)

    for _ in range(20):
        blocks = page.locator("text=/M-LWS-\\d+-\\d+/").all()
        new_found = False
        for block in blocks:
            row = block.locator("xpath=ancestor::tr[1]")
            if row.count() == 0:
                continue
            text = row.first.inner_text().strip()
            m = parse_mangel_block(text)
            if not m or m["id"] in seen_ids:
                continue
            seen_ids.add(m["id"])

            # Запоминаем URL детали если есть ссылка
            detail_url = None
            link = row.first.locator("a[href*='mangel']").first
            if link.count() == 0:
                link = row.first.locator("a").first
            if link.count() > 0:
                href = link.get_attribute("href")
                if href:
                    detail_url = href if href.startswith("http") else f"{BASE}/{href.lstrip('/')}"

            m["leo_url"] = detail_url
            items.append((m, detail_url))
            new_found = True

        if not new_found:
            break
        if not click_next_and_wait(page):
            break

    return items


def parse_mangel(page):
    items = collect_mangel_list(page)
    print(f"Найдено {len(items)} Mängel в списке")

    maengel = []
    for i, (m, detail_url) in enumerate(items):
        if detail_url:
            try:
                page.goto(detail_url)
                page.wait_for_load_state("networkidle", timeout=10000)
                # Отладка: сохраняем HTML первой страницы
                if i == 0:
                    html = page.content()
                    with open("../debug_detail.html", "w", encoding="utf-8") as f:
                        f.write(html)
                    print(f"  DEBUG title={page.title()}, html={len(html)}b")
                    # Все видимые текстовые строки страницы
                    body_text = page.locator("body").inner_text()
                    print("  DEBUG body[:2000]:", body_text[:2000])
                m["positionen"] = parse_positionen(page)
                print(f"  {m['id']}: {len(m['positionen'])} позиций")
            except Exception as e:
                print(f"  {m['id']}: ошибка — {e}")
                m["positionen"] = []
        else:
            m["positionen"] = []
        maengel.append(m)

    return maengel


def parse_project_row(row_text):
    """Парсим одну строку из таблицы проектов Übersicht."""
    lines = lines_of(row_text)
    if not lines:
        return None

    lws_match = re.search(r"LWS-\d+", row_text)
    leg_match = re.search(r"LEG-\d+-\d+", row_text)
    dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", row_text)
    fortschritt_match = re.search(r"(\d+)\s*%", row_text)

    # Адрес — строка с цифрами и запятой (PLZ)
    address = None
    for l in lines:
        if re.search(r"\d{4,5}", l) and ("," in l or re.search(r"straße|weg|ring|allee|platz|gasse", l, re.I)):
            address = l
            break
    if not address and len(lines) > 1:
        address = lines[1]

    fortschritt = int(fortschritt_match.group(1)) if fortschritt_match else None

    return {
        "lws": lws_match.group(0) if lws_match else None,
        "leg": leg_match.group(0) if leg_match else None,
        "address": address,
        "start": dates[0] if len(dates) > 0 else None,
        "ende": dates[1] if len(dates) > 1 else None,
        "fortschritt": fortschritt,
        "abgeschlossen": fortschritt == 100,
    }


def parse_projects(page):
    """Тянем Projekte → Übersicht, только не 100% закрытые."""
    page.goto(f"{BASE}/index.php")
    page.wait_for_load_state("networkidle")
    page.click("text=Projekte")
    page.click("text=Übersicht")
    page.wait_for_load_state("networkidle")

    # Отладка первой страницы
    html = page.content()
    with open("../debug_projects.html", "w", encoding="utf-8") as f:
        f.write(html)
    body = page.locator("body").inner_text()
    print(f"DEBUG projects: title={page.title()}, html={len(html)}b")
    print(f"DEBUG body[:1500]: {body[:1500]}")

    seen = set()
    projects = []

    for page_num in range(50):  # до 50 страниц
        rows = page.locator("tr").all()
        new_found = False
        for row in rows:
            try:
                text = row.inner_text().strip()
            except Exception:
                continue
            if not re.search(r"LWS-\d+", text):
                continue
            lws_match = re.search(r"LWS-\d+", text)
            if not lws_match:
                continue
            lws = lws_match.group(0)
            if lws in seen:
                continue

            # Пропускаем 100% закрытые
            fort_match = re.search(r"(\d+)\s*%", text)
            if fort_match and int(fort_match.group(1)) == 100:
                continue

            p = parse_project_row(text)
            if not p or not p["lws"]:
                continue

            # URL детали
            try:
                link = row.locator("a").first
                href = link.get_attribute("href") if link.count() > 0 else None
                p["leo_url"] = (href if href and href.startswith("http") else f"{BASE}/{href.lstrip('/')}") if href else None
            except Exception:
                p["leo_url"] = None

            seen.add(lws)
            projects.append(p)
            new_found = True

        if not new_found:
            break
        if not click_next_and_wait(page):
            break

    print(f"Найдено {len(projects)} активных проектов")
    return projects


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=STORAGE_STATE)
        page = context.new_page()

        try:
            tasks = parse_tasks(page)
            maengel = parse_mangel(page)
            projects = parse_projects(page)
        except RuntimeError as e:
            print(f"ОШИБКА: {e}", file=sys.stderr)
            sys.exit(1)

        data = {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "tasks": tasks,
            "maengel": maengel,
            "projects": projects,
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Сохранено {len(tasks)} задач, {len(maengel)} Mängel, {len(projects)} проектов в {OUTPUT_FILE}")
        browser.close()


if __name__ == "__main__":
    main()
