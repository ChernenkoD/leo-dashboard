"""
Запускать ТОЛЬКО локально, руками, один раз (и потом раз в несколько недель,
когда сессия протухнет). Этот скрипт никуда не передаёт пароль — ты вводишь
его сам в открывшемся окне браузера, скрипт только сохраняет файл сессии
(куки) после того как ты залогинился.

Использование:
    cd scraper
    pip install -r requirements.txt
    playwright install chromium
    python3 login_and_save_session.py

Дальше:
    gh secret set LEO_SESSION --repo <твой-юзер>/leo-dashboard < storage_state.json

(эту команду выполняешь сам в терминале — отправь содержимое только в свой
собственный приватный GitHub-секрет, никому больше)
"""

from playwright.sync_api import sync_playwright

LEO_URL = "https://leo-pro.de/login.php"
OUTPUT_FILE = "storage_state.json"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(LEO_URL)

        print("\n>>> Залогинься в открывшемся окне Chrome своими данными.")
        print(">>> После того как увидишь Dashboard LEO — вернись сюда и нажми Enter.\n")
        input("Нажми Enter после успешного логина... ")

        browser.contexts[0].storage_state(path=OUTPUT_FILE)
        print(f"Готово. Сессия сохранена в {OUTPUT_FILE}")
        print("Теперь загрузи её в GitHub Secret командой из комментария в начале файла.")
        browser.close()


if __name__ == "__main__":
    main()
