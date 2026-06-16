"""
Запускается в GitHub Actions по расписанию (2 раза в день).
Берёт сохранённую сессию LEO (из секрета LEO_SESSION, GitHub кладёт её
во временный файл storage_state.json перед запуском), заходит в LEO,
собирает Aufgaben и Mangelaufträge, пишет data.json.

Если сессия протухла — скрипт это обнаружит (попадёт на страницу логина)
и завершится с понятной ошибкой, ничего не поломав в data.json.
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
    return "login.php" in page.url


def parse_tasks(page):
    page.goto(f"{BASE}/index.php")
    if is_logged_out(page):
        raise RuntimeError("Сессия LEO протухла — нужно перелогиниться локально и обновить LEO_SESSION secret")

    tasks = []
    page_num = 1
    while True:
        rows = page.locator("table tr").all()
        for row in rows:
            text = row.inner_text().strip()
            if not text or "Aufgabe" in text and "Bauvorhaben" in text:
                continue
            lws_match = re.search(r"LWS-\d+", text)
            date_match = re.search(r"\d{2}\.\d{2}\.\d{4}", text)
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            if not lines:
                continue
            task_type = lines[0]
            address = lines[1] if len(lines) > 1 else None
            tasks.append({
                "type": task_type,
                "address": address if lws_match else None,
                "lws": lws_match.group(0) if lws_match else None,
                "due": date_match.group(0) if date_match else None,
            })

        next_link = page.locator("text=Nächste").first
        if next_link.count() == 0:
            break
        try:
            next_link.click()
            page.wait_for_load_state("networkidle", timeout=5000)
            page_num += 1
            if page_num > 20:
                break
        except Exception:
            break

    return tasks


def parse_mangel(page):
    page.goto(f"{BASE}/index.php")
    page.click("text=Projekte")
    page.click("text=Mangelaufträge")
    page.wait_for_load_state("networkidle")

    maengel = []
    page_num = 1
    while True:
        blocks = page.locator("text=/M-LWS-\\d+-\\d+/").all()
        for block in blocks:
            row = block.locator("xpath=ancestor::tr[1]")
            text = row.inner_text().strip()
            id_match = re.search(r"M-LWS-\d+-\d+", text)
            leg_match = re.search(r"LEG-\d+-\d+", text)
            dates = re.findall(r"\d{2}\.\d{2}\.\d{4}", text)
            if id_match:
                maengel.append({
                    "id": id_match.group(0),
                    "raw": text,
                    "leg": leg_match.group(0) if leg_match else None,
                    "dates": dates,
                })

        next_link = page.locator("text=Nächste").first
        if next_link.count() == 0:
            break
        try:
            next_link.click()
            page.wait_for_load_state("networkidle", timeout=5000)
            page_num += 1
            if page_num > 20:
                break
        except Exception:
            break

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
            "maengel_raw": maengel,
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Сохранено {len(tasks)} задач и {len(maengel)} Mängel в {OUTPUT_FILE}")
        browser.close()


if __name__ == "__main__":
    main()
