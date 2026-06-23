"""
Лёгкий скрипт: читает assignments.json из репозитория,
обновляет Google Sheets (Manager, Techniker, даты).
Не требует Playwright — работает за секунды.
"""
import json
import os
import sys
import re
import urllib.request
from datetime import datetime

SHEET_ID   = "1kbSSyETlCqFG5htYdC70LyV8VUQ565yT0uDXRi7u3Ng"
SHEET_NAME = "Mangel-LKBau"
REPO_RAW   = "https://raw.githubusercontent.com/ChernenkoD/leo-dashboard/main"


def load_json(url):
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read().decode())


def main():
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDS", "")
    if not creds_json:
        print("GOOGLE_SHEETS_CREDS не задан")
        sys.exit(1)

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    sheet = service.spreadsheets()

    # Загружаем assignments и data.json
    try:
        assignments = load_json(f"{REPO_RAW}/assignments.json?t={int(datetime.now().timestamp())}").get("assignments", {})
    except Exception as e:
        print(f"assignments.json не загружен: {e}")
        assignments = {}

    try:
        data = load_json(f"{REPO_RAW}/data.json?t={int(datetime.now().timestamp())}")
        maengel = {m["id"]: m for m in data.get("maengel", [])}
    except Exception as e:
        print(f"data.json не загружен: {e}")
        maengel = {}

    # Читаем таблицу
    result = sheet.values().get(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!A:A"
    ).execute()
    rows = result.get("values", [])

    # Проверяем/добавляем заголовок колонок L-P
    header_result = sheet.values().get(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!L1:P1"
    ).execute()
    header_vals = header_result.get("values", [[]])[0] if header_result.get("values") else []
    if not header_vals or header_vals[0] != "Manager":
        sheet.values().update(
            spreadsheetId=SHEET_ID,
            range=f"{SHEET_NAME}!L1:P1",
            valueInputOption="RAW",
            body={"values": [["Manager", "Techniker", "Datum In Arbeit", "Datum Fertig", "Tage"]]}
        ).execute()

    # id → row number
    id_to_row = {}
    for i, row in enumerate(rows[1:], start=2):
        if row:
            id_to_row[row[0]] = i

    # Новые строки для Mängel которых нет в таблице
    existing_ids = set(id_to_row.keys())
    today = datetime.now().strftime("%d.%m.%Y")
    new_rows = []
    for mid, m in maengel.items():
        if mid in existing_ids:
            continue
        asgn = assignments.get(mid, {})
        pos_text = "; ".join(
            f"{p.get('code','')} {p.get('mangel_beschreibung','')}"
            for p in (m.get("positionen") or [])
        )
        lws_match = re.search(r"LWS-\d+", mid)
        new_rows.append([
            mid,
            lws_match.group(0) if lws_match else "",
            m.get("address", ""),
            m.get("lage", "") or "",
            m.get("bauleiter", "") or "",
            m.get("innendienst", "") or "",
            m.get("ausfuehrungsbeginn", "") or "",
            m.get("fertigstellung", "") or "",
            m.get("mangel_status", "") or "",
            pos_text,
            today,
            asgn.get("manager_name", "") or "",
            asgn.get("technician_name", "") or "",
            asgn.get("date_started", "") or "",
            asgn.get("date_finished", "") or "",
            "",
        ])

    if new_rows:
        sheet.values().append(
            spreadsheetId=SHEET_ID,
            range=f"{SHEET_NAME}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": new_rows}
        ).execute()
        print(f"Добавлено {len(new_rows)} новых Mängel")
        # Обновляем id_to_row
        result2 = sheet.values().get(spreadsheetId=SHEET_ID, range=f"{SHEET_NAME}!A:A").execute()
        for i, row in enumerate(result2.get("values", [])[1:], start=2):
            if row:
                id_to_row[row[0]] = i

    # Обновляем assignments для существующих строк
    updates = []
    for mid, asgn in assignments.items():
        if mid not in id_to_row:
            continue
        row_num = id_to_row[mid]
        manager  = asgn.get("manager_name", "") or ""
        tech     = asgn.get("technician_name", "") or ""
        started  = asgn.get("date_started", "") or ""
        finished = asgn.get("date_finished", "") or ""
        tage = ""
        if started and finished:
            try:
                d0 = datetime.strptime(started, "%Y-%m-%d")
                d1 = datetime.strptime(finished, "%Y-%m-%d")
                tage = str((d1 - d0).days)
            except Exception:
                pass
        if any([manager, tech, started, finished]):
            updates.append({
                "range": f"{SHEET_NAME}!L{row_num}:P{row_num}",
                "values": [[manager, tech, started, finished, tage]]
            })

    if updates:
        sheet.values().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={"valueInputOption": "RAW", "data": updates}
        ).execute()
        print(f"Обновлено {len(updates)} assignments в Google Sheets")
    else:
        print("Нет изменений для обновления")


if __name__ == "__main__":
    main()
