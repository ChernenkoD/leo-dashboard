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


def parse_projects(page):
    """
    Тянем Projekte → Übersicht.
    Структура строки:
      tr[role=row] > td > div.section.outer.small
        h5.section > a.link-bold  → LWS + URL
        p                          → адрес
        p > small                  → lage
        span.label.small           → LEG/THT номер
      tr[role=row] > td:nth(1) > div.section.outer
        div.filled[data-value]     → % прогресса
        div.section.nowrap         → даты
    Пропускаем строки где data-value == 100.
    """
    page.goto(f"{BASE}/index.php")
    page.wait_for_load_state("networkidle")
    page.click("text=Projekte")
    page.click("text=Übersicht")
    page.wait_for_load_state("networkidle")

    seen = set()
    projects = []

    for _ in range(50):
        rows = page.locator("tr[role='row']").all()
        new_found = False

        for row in rows:
            try:
                # Прогресс — data-value на div.filled
                filled = row.locator("div.filled").first
                if filled.count() == 0:
                    continue
                fortschritt = int(filled.get_attribute("data-value") or 0)
                if fortschritt == 100:
                    continue  # пропускаем закрытые

                # LWS + URL
                lws_link = row.locator("h5.section a.link-bold").first
                if lws_link.count() == 0:
                    continue
                lws = lws_link.inner_text().strip()
                if not lws or lws in seen:
                    continue

                href = lws_link.get_attribute("href") or ""
                leo_url = href if href.startswith("http") else f"{BASE}/{href.lstrip('/')}"

                # Адрес
                address = None
                addr_el = row.locator("div.section.outer.small p").first
                if addr_el.count() > 0:
                    address = addr_el.inner_text().strip()

                # Lage
                lage = None
                lage_els = row.locator("div.section.outer.small p small").all()
                if lage_els:
                    lage = lage_els[0].inner_text().strip()

                # LEG/THT номер
                leg = None
                leg_el = row.locator("span.label.small").first
                if leg_el.count() > 0:
                    leg = leg_el.inner_text().strip()

                # Даты из второй колонки
                dates_text = ""
                nowrap = row.locator("div.section.nowrap").first
                if nowrap.count() > 0:
                    dates_text = nowrap.inner_text().strip()
                dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", dates_text)

                seen.add(lws)
                projects.append({
                    "lws": lws,
                    "leg": leg,
                    "address": address,
                    "lage": lage,
                    "fortschritt": fortschritt,
                    "start": dates[0] if len(dates) > 0 else None,
                    "ende": dates[1] if len(dates) > 1 else None,
                    "leo_url": leo_url,
                })
                new_found = True

            except Exception as e:
                print(f"  Ошибка парсинга строки проекта: {e}")
                continue

        if not new_found:
            break
        if not click_next_and_wait(page):
            break

    print(f"Найдено {len(projects)} активных проектов (не 100%)")
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
