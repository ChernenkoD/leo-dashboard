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
    """Парсим позиции на странице детали Mängel. Сохраняем HTML для отладки."""
    positionen = []

    # Ищем все строки с кодом позиции вида XX.XX.XX.XXXX
    rows = page.locator("tr").all()
    for row in rows:
        try:
            text = row.inner_text().strip()
        except Exception:
            continue
        code_match = re.search(r"\d{2}\.\d{2}\.\d{2}\.\d{4}", text)
        if not code_match:
            continue
        lines = lines_of(text)
        code = code_match.group(0)

        status = None
        for kw in ["Mangel behoben & geprüft", "angenommen", "abgelehnt", "in Bearbeitung", "offen"]:
            if kw.lower() in text.lower():
                status = kw
                break

        mangel_beschreibung = None
        mb_match = re.search(r"Mangelbeschreibung[:\s]*\n?(.+?)(?:\n|$)", text, re.IGNORECASE)
        if mb_match:
            mangel_beschreibung = mb_match.group(1).strip()

        gewerk = None
        for i, l in enumerate(lines):
            if re.match(r"\d{2}\.\d{2}\.\d{2}\.\d{4}", l) and i + 1 < len(lines):
                gewerk = lines[i + 1]
                break

        menge_match = re.search(r"(psch|m²|stk|St\.?|m|h)\s+[\d,\.]+", text, re.IGNORECASE)
        menge = menge_match.group(0) if menge_match else None

        leistung = None
        bereich = None
        bereiche = ("Wohnung", "Treppenhaus", "Keller", "Außenanlage", "Dach", "Garage")
        for l in lines:
            if l in bereiche:
                bereich = l
            elif len(l) > 30 and not re.search(r"\d{2}\.\d{2}\.\d{2}\.\d{4}", l) \
                    and "Mangelbeschreibung" not in l and l != mangel_beschreibung \
                    and not leistung:
                leistung = l

        positionen.append({
            "code": code,
            "gewerk": gewerk,
            "status": status,
            "leistung": leistung,
            "bereich": bereich,
            "mangel_beschreibung": mangel_beschreibung,
            "menge": menge,
        })

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
    for m, detail_url in items:
        if detail_url:
            try:
                page.goto(detail_url)
                page.wait_for_load_state("networkidle", timeout=8000)
                m["positionen"] = parse_positionen(page)
                print(f"  {m['id']}: {len(m['positionen'])} позиций (url: {detail_url})")
            except Exception as e:
                print(f"  {m['id']}: ошибка при загрузке позиций — {e}")
                m["positionen"] = []
        else:
            m["positionen"] = []
        maengel.append(m)

    return maengel


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=STORAGE_STATE)
        page = context.new_page()

        try:
            tasks = parse_tasks(page)
            maengel = parse_mangel(page)
        except RuntimeError as e:
            print(f"ОШИБКА: {e}", file=sys.stderr)
            sys.exit(1)

        data = {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "tasks": tasks,
            "maengel": maengel,
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Сохранено {len(tasks)} задач и {len(maengel)} Mängel в {OUTPUT_FILE}")
        browser.close()


if __name__ == "__main__":
    main()
