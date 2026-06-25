"""
Опрашивает бота, скачивает фото из тредов Mängel,
сохраняет в photos/{mangel_id}/ и коммитит в репо.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GROUP_ID  = os.environ.get("TELEGRAM_GROUP_ID", "")
REPO_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOPICS_FILE = os.path.join(os.path.dirname(__file__), "telegram_topics.json")
OFFSET_FILE = os.path.join(os.path.dirname(__file__), "telegram_offset.json")


def api(method, params=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = urllib.parse.urlencode(params or {}).encode() if params else None
    try:
        with urllib.request.urlopen(url, data=data, timeout=15) as r:
            result = json.loads(r.read().decode())
            return result.get("result") if result.get("ok") else None
    except Exception as e:
        print(f"API error [{method}]: {e}")
        return None


def load_topics():
    if os.path.exists(TOPICS_FILE):
        try:
            with open(TOPICS_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def load_offset():
    if os.path.exists(OFFSET_FILE):
        try:
            with open(OFFSET_FILE) as f:
                return json.load(f).get("offset", 0)
        except Exception:
            pass
    return 0


def save_offset(offset):
    with open(OFFSET_FILE, "w") as f:
        json.dump({"offset": offset}, f)


def download_file(file_id, dest_path):
    file_info = api("getFile", {"file_id": file_id})
    if not file_info:
        return False
    file_path = file_info.get("file_path")
    url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
    try:
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        urllib.request.urlretrieve(url, dest_path)
        return True
    except Exception as e:
        print(f"Download error: {e}")
        return False


def main():
    if not BOT_TOKEN or not GROUP_ID:
        print("TELEGRAM_BOT_TOKEN или TELEGRAM_GROUP_ID не заданы")
        sys.exit(0)

    topics = load_topics()
    # Инвертируем: thread_id → mangel_id
    thread_to_mangel = {str(v): k for k, v in topics.items()}

    offset = load_offset()
    updates = api("getUpdates", {"offset": offset, "timeout": 5, "limit": 100,
                                  "allowed_updates": '["message"]'})
    if not updates:
        print("Нет новых обновлений")
        return

    downloaded = 0
    for upd in updates:
        offset = max(offset, upd["update_id"] + 1)
        msg = upd.get("message", {})
        if not msg:
            continue

        # Только из нашей группы
        if str(msg.get("chat", {}).get("id")) != GROUP_ID:
            continue

        thread_id = str(msg.get("message_thread_id", ""))
        mangel_id = thread_to_mangel.get(thread_id)
        if not mangel_id:
            continue

        # Фото
        photos = msg.get("photo")
        if not photos:
            continue

        # Берём наибольшее разрешение
        best = max(photos, key=lambda p: p.get("file_size", 0))
        file_id = best["file_id"]
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = os.path.join(REPO_DIR, "photos", mangel_id, f"{ts}.jpg")

        if download_file(file_id, dest):
            print(f"✅ Фото сохранено: photos/{mangel_id}/{ts}.jpg")
            downloaded += 1
        
        # Caption (если есть) — сохраняем как заметку
        caption = msg.get("caption")
        if caption and downloaded:
            notes_file = os.path.join(REPO_DIR, "photos", mangel_id, "notes.txt")
            with open(notes_file, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now().strftime('%d.%m.%Y %H:%M')}] {caption}\n")

    save_offset(offset)
    print(f"Скачано фото: {downloaded}, новый offset: {offset}")


if __name__ == "__main__":
    main()
