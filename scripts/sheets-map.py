#!/usr/bin/env python3
# Pure transform: reads sheets-export/pottery-pieces-form.xlsx (a one-off pull
# of the studio's Google Sheet — see conversation for how it was fetched;
# there's no API-driven re-export script here the way there is for Momence)
# and produces the exact rows to write, without touching the database.
#
# Scope (per team decision, see conversation):
#   - Form Responses 1 -> User.name/User.phone only. All other columns
#     (zip, gender, birthday, NPS, etc.) have no home on User and are
#     dropped. The pickup-text checkbox is transactional consent, NOT
#     marketing consent -- never written to smsMarketingOptIn.
#   - Shelf Spaces -> ShelfSpace / ShelfWaitlistEntry, but only rows whose
#     occupant/waitlist name resolves to exactly one existing User by
#     normalized name match. Ambiguous or unmatched names are skipped and
#     reported, not guessed.
#   - Everything else in the workbook (kiln/firing tabs, staff pay rates,
#     membership sale totals) has no schema home and is left alone.
#
# Run with:
#   python3 scripts/sheets-map.py
import json
from pathlib import Path
import openpyxl

EXPORT_DIR = Path(__file__).parent.parent / "sheets-export"
OUT_DIR = EXPORT_DIR / "mapped"
XLSX_PATH = EXPORT_DIR / "pottery-pieces-form.xlsx"


def nonempty_rows(ws):
    return [r for r in ws.iter_rows(values_only=True) if any(c is not None and str(c).strip() != "" for c in r)]


def main():
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # User <-> Users matching (and the resulting write counts) happens in
    # scripts/sheets-apply.ts, which has DB access; this report only covers
    # what was extracted from the spreadsheet.
    report = {
        "formResponses": {"totalRows": 0, "distinctEmails": 0},
        "shelfSpaces": {"occupantRows": 0},
        "shelfWaitlist": {"rows": 0},
    }

    # ---- Form Responses 1 -----------------------------------------------
    ws = wb["Form Responses 1"]
    rows = nonempty_rows(ws)
    header = rows[0]
    email_idx = header.index("Email Address")
    name_idx = header.index("What is your full name? (So we know who to contact.)")
    phone_idx = header.index("What phone number can we text when your pieces are ready? (Ex: 18012044545)")
    ts_idx = header.index("Timestamp")

    by_email = {}
    for r in rows[1:]:
        email = r[email_idx]
        if not email or not isinstance(email, str) or "@" not in email:
            continue
        email = email.strip().lower()
        name = r[name_idx].strip() if isinstance(r[name_idx], str) and r[name_idx].strip() else None
        phone_raw = r[phone_idx]
        phone = None
        if phone_raw is not None:
            digits = "".join(ch for ch in str(int(phone_raw)) if ch.isdigit()) if isinstance(phone_raw, (int, float)) else "".join(ch for ch in str(phone_raw) if ch.isdigit())
            if len(digits) == 10:
                digits = "1" + digits
            if len(digits) == 11:
                phone = f"+{digits}"
        ts = r[ts_idx]

        # Rows are already in submission order, so the first time we see an
        # email is its earliest submission — no need to compare timestamps
        # (which come in mixed datetime/string form across rows).
        entry = by_email.setdefault(email, {"name": None, "phone": None, "firstSeen": ts})
        # Keep the latest non-null name/phone seen (rows are in submission order).
        if name:
            entry["name"] = name
        if phone:
            entry["phone"] = phone

    report["formResponses"]["totalRows"] = len(rows) - 1
    report["formResponses"]["distinctEmails"] = len(by_email)

    def format_ts(ts):
        if ts is None:
            return None
        return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

    with open(OUT_DIR / "form-emails.json", "w") as f:
        json.dump(
            {
                email: {
                    "name": e["name"],
                    "phone": e["phone"],
                    "firstSeen": format_ts(e["firstSeen"]),
                }
                for email, e in by_email.items()
            },
            f,
            indent=2,
        )

    # ---- Shelf Spaces -----------------------------------------------------
    ws2 = wb["Shelf Spaces"]
    rows2 = nonempty_rows(ws2)
    occupants = []
    waitlist = []
    for r in rows2[1:]:
        shelf_num = r[0]
        occupant_name = r[1]
        waitlist_pos = r[5] if len(r) > 5 else None
        waitlist_name = r[6] if len(r) > 6 else None
        if occupant_name and isinstance(occupant_name, str) and occupant_name.strip():
            occupants.append({"shelfNumber": int(shelf_num) if shelf_num else None, "name": occupant_name.strip()})
        if waitlist_name and isinstance(waitlist_name, str) and waitlist_name.strip():
            waitlist.append({"position": waitlist_pos, "name": waitlist_name.strip()})

    report["shelfSpaces"]["occupantRows"] = len(occupants)
    report["shelfWaitlist"]["rows"] = len(waitlist)

    with open(OUT_DIR / "shelf-occupants.json", "w") as f:
        json.dump(occupants, f, indent=2)
    with open(OUT_DIR / "shelf-waitlist.json", "w") as f:
        json.dump(waitlist, f, indent=2)

    with open(OUT_DIR / "report.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(json.dumps(report, indent=2, default=str))
    print(f"\nWrote mapped rows to {OUT_DIR}")
    print("No database access happened in this step (name matching against Users happens in scripts/sheets-apply.ts).")


if __name__ == "__main__":
    main()
