"""
Запускать ТОЛЬКО локально (и потом раз в несколько недель, когда сессия
протухнет). Этот скрипт никуда не передаёт пароль — ты вводишь его сам
в открывшемся окне браузера. Скрипт сам определяет, что ты залогинился
(ищет на странице элемент дашборда — "Alle Aufgaben"), и сохраняет файл
сессии.

Использование:
    cd scraper
    pip install -r requirements.txt
    playwright install chromium
    python3 login_and_save_session.py
"""

import time
from playwright.sync_api import sync_playwright

LEO_URL = "https://leo-pro.de/login.php"
OUTPUT_FILE = "storage_state.json"
TIMEOUT_SECONDS = 300


def is_logged_in(page):
    try:
        return page.get_by_text("Alle Aufgaben").count() > 0
    except Exception:
        return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(LEO_URL)

        print("\n>>> Открылось окно Chrome. Залогинься там в LEO своими данными.")
        print(">>> Дальше ничего делать не нужно — скрипт сам всё сохранит.\n")

        waited = 0
        while not is_logged_in(page) and waited < TIMEOUT_SECONDS:
            time.sleep(2)
            waited += 2

        if not is_logged_in(page):
            print("Не дождался логина (5 минут). Запусти скрипт заново, когда будешь готов.")
            print(f"(для справки: текущий адрес страницы — {page.url})")
            browser.close()
            return

        browser.contexts[0].storage_state(path=OUTPUT_FILE)
        print(f"\nГотово! Сессия сохранена в {OUTPUT_FILE}. Можно закрывать окно браузера.")
        browser.close()


if __name__ == "__main__":
    main()
