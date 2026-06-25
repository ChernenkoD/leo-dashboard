"""
Telegram Bot helper для LK Bauservice.
- Создаёт треды (topics) для каждого нового Mängel
- Отправляет уведомления в треды
- Отправляет личные сообщения техникам
"""
import json
import os
import urllib.request
import urllib.parse
from datetime import datetime

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GROUP_ID  = os.environ.get("TELEGRAM_GROUP_ID", "")

TOPICS_FILE = os.path.join(os.path.dirname(__file__), "telegram_topics.json")


def _api(method, params):
    """Вызов Telegram Bot API."""
    if not BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = urllib.parse.urlencode(params).encode()
    try:
        with urllib.request.urlopen(url, data=data, timeout=10) as r:
            result = json.loads(r.read().decode())
            if not result.get("ok"):
                print(f"Telegram API error [{method}]: {result.get('description')}")
                return None
            return result.get("result")
    except Exception as e:
        print(f"Telegram API exception [{method}]: {e}")
        return None


def load_topics():
    """Загрузить маппинг mangel_id → message_thread_id."""
    if os.path.exists(TOPICS_FILE):
        try:
            with open(TOPICS_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_topics(topics):
    with open(TOPICS_FILE, "w", encoding="utf-8") as f:
        json.dump(topics, f, ensure_ascii=False, indent=2)


def create_topic_for_mangel(m):
    """Создать тред для нового Mängel. Возвращает message_thread_id или None."""
    if not GROUP_ID:
        return None

    topics = load_topics()
    mid = m.get("id", "")
    if mid in topics:
        return topics[mid]  # уже создан

    # Иконка по срочности
    days = _days_until(m.get("fertigstellung"))
    if days is not None and days < 0:
        icon_color = 16478047  # красный
    elif days is not None and days <= 7:
        icon_color = 16749490  # оранжевый
    else:
        icon_color = 6533046   # зелёный

    city = _city_of(m.get("address", ""))
    name = f"{'⚠️' if (days is not None and days < 0) else '🔧'} {mid} · {city}"
    name = name[:128]  # Telegram limit

    result = _api("createForumTopic", {
        "chat_id": GROUP_ID,
        "name": name,
        "icon_color": icon_color,
    })
    if not result:
        return None

    thread_id = result["message_thread_id"]
    topics[mid] = thread_id
    save_topics(topics)

    # Первое сообщение в треде — детали Mängel с двуязычными позициями
    days_str = f"{abs(days)} Tage {'überfällig ⚠️' if days < 0 else 'verbleibend'}" if days is not None else "Kein Datum"

    pos_lines = []
    for i, p in enumerate((m.get("positionen") or [])[:10], 1):
        desc = p.get("mangel_beschreibung") or p.get("leistung") or ""
        gewerk = p.get("gewerk", "—")
        if not desc:
            continue
        ru = _translate(desc, "ru") or ""
        line = f"*{i}. {gewerk}*\n🇩🇪 {desc[:120]}"
        if ru and ru.lower() != desc.lower():
            line += f"\n🇷🇺 {ru[:120]}"
        pos_lines.append(line)

    pos_block = "\n\n".join(pos_lines) if pos_lines else "Keine Positionen"

    lage = m.get("lage", "")
    text = (
        f"🔧 *Neuer Mängelauftrag*\n"
        f"━━━━━━━━━━━━━━━\n"
        f"📋 `{mid}`\n"
        f"📍 {m.get('address','—')}\n"
        + (f"🏠 {lage}\n" if lage else "")
        + f"👷 Bauleiter: {m.get('bauleiter','—')}\n"
        f"📅 Beginn: {m.get('ausfuehrungsbeginn','—')}\n"
        f"🗓 Fällig: {m.get('fertigstellung','—')} ({days_str})\n"
        f"━━━━━━━━━━━━━━━\n"
        f"*📋 Positionen:*\n\n"
        f"{pos_block}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"📸 *Fotos hier posten wenn fertig!\nФото сюда после завершения!*"
    )
    _api("sendMessage", {
        "chat_id": GROUP_ID,
        "message_thread_id": thread_id,
        "text": text,
        "parse_mode": "Markdown",
    })

    return thread_id


def notify_in_arbeit(m, manager_name, technician_name, thread_id=None):
    """Уведомление в тред что Mängel взят в работу."""
    if not GROUP_ID:
        return
    tid = thread_id or load_topics().get(m.get("id", ""))
    params = {
        "chat_id": GROUP_ID,
        "text": (
            f"✈️ *In Arbeit gesetzt*\n"
            f"👔 Manager: {manager_name or '—'}\n"
            f"🔧 Techniker: {technician_name or '—'}\n"
            f"📅 {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        ),
        "parse_mode": "Markdown",
    }
    if tid:
        params["message_thread_id"] = tid
    _api("sendMessage", params)


def send_daily_digest(maengel):
    """Ежедневный дайджест просроченных и горящих Mängel."""
    if not GROUP_ID or not maengel:
        return
    now = datetime.now()
    overdue = [m for m in maengel if _days_until(m.get("fertigstellung")) is not None
               and _days_until(m.get("fertigstellung")) < 0
               and m.get("mangel_status") != "geprueft"]
    urgent  = [m for m in maengel if _days_until(m.get("fertigstellung")) is not None
               and 0 <= _days_until(m.get("fertigstellung")) <= 3
               and m.get("mangel_status") != "geprueft"]

    lines = [f"📊 *Mängel Tagesbericht* — {now.strftime('%d.%m.%Y')}",
             f"Gesamt aktiv: *{len(maengel)}*\n"]
    if overdue:
        lines.append(f"🔴 *Überfällig ({len(overdue)}):*")
        for m in overdue[:10]:
            d = abs(_days_until(m.get("fertigstellung")))
            lines.append(f"  • {m.get('id','')} · {_city_of(m.get('address',''))} · {d}d über")
    if urgent:
        lines.append(f"\n🟠 *Dringend ≤3 Tage ({len(urgent)}):*")
        for m in urgent[:10]:
            d = _days_until(m.get("fertigstellung"))
            lines.append(f"  • {m.get('id','')} · {_city_of(m.get('address',''))} · noch {d}d")
    if not overdue and not urgent:
        lines.append("✅ Alles im grünen Bereich!")

    _api("sendMessage", {
        "chat_id": GROUP_ID,
        "text": "\n".join(lines),
        "parse_mode": "Markdown",
    })


def send_to_technician(telegram_user_id, text):
    """Личное сообщение технику."""
    if not telegram_user_id:
        return
    _api("sendMessage", {
        "chat_id": telegram_user_id,
        "text": text,
        "parse_mode": "Markdown",
    })


def _translate(text, target_lang):
    """Перевод через Google Translate (бесплатный endpoint)."""
    try:
        q = urllib.parse.quote(text[:500])
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target_lang}&dt=t&q={q}"
        with urllib.request.urlopen(url, timeout=8) as r:
            data = json.loads(r.read().decode())
            return "".join(s[0] for s in data[0] if s[0])
    except Exception:
        return ""


def _days_until(date_str):
    if not date_str:
        return None
    try:
        parts = date_str.split(".")
        if len(parts) != 3:
            return None
        d, m, y = parts
        dt = datetime(int(y), int(m), int(d))
        return (dt.date() - datetime.now().date()).days
    except Exception:
        return None


def _city_of(address):
    parts = address.split(",")
    last = parts[-1].strip() if parts else ""
    import re
    return re.sub(r"^\d{4,5}\s*", "", last).strip() or address[:20]
