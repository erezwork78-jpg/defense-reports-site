#!/usr/bin/env python3
"""
בונה את כל קובצי public/data/<slug>.json (15 חברות האתר) אך ורק מתוך
קובץ הייצוא של CapitalIQ / S&P Global ("Wide A&D BM"), ומעדכן את השדות
הבאים בלבד: revenue, gross margin, EBIT, backlog, R&D, capex, net income,
EBITDA, operating cash flow. שאר שדות MetricRow (מאזן, תזרים השקעה/מימון,
פילוחי מגזר/אזור, עובדים) אינם קיימים בקובץ ונשארים null.

הרצה:
    python3 scripts/build_from_ciq.py [path/to/CIQ-export.xlsx]

אם לא מועבר נתיב, מחפש קובץ יחיד שמתאים לתבנית "CIQ*.xlsx" בתיקיית website.
"""
from __future__ import annotations

import glob
import json
import os
import sys
from datetime import datetime

import openpyxl

WEBSITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(WEBSITE_ROOT, "public", "data")

# מיפוי slug (כפי שמוגדר ב-src/App.tsx וב-public/data/<slug>.json הקיימים)
# ל(a) שם הישות בגיליון S&P כפי שהוא מופיע בעמודה "Entity Name",
# ו-(b) מטא-דאטה קבועה שאינה חלק מהנתונים הפיננסיים (שם עברי/אנגלי, תיקיית דוחות).
COMPANIES = {
    "iai": {
        "match": "Israel Aerospace Industries",
        "nameHe": "תעשייה אווירית",
        "nameEn": "Israel Aerospace Industries Ltd.",
        "reportsFolder": "01. IAI",
    },
    "elbit": {
        "match": "Elbit Systems",
        "nameHe": "אלביט מערכות",
        "nameEn": "Elbit Systems Ltd.",
        "reportsFolder": "אלביט",
    },
    "rafael": {
        "match": "Rafael Advanced Defense",
        "nameHe": "רפאל מערכות לחימה מתקדמות",
        "nameEn": "Rafael Advanced Defense Systems Ltd.",
        "reportsFolder": "רפאל",
    },
    "lockheed": {
        "match": "Lockheed Martin",
        "nameHe": "לוקהיד מרטין",
        "nameEn": "Lockheed Martin Corporation",
        "reportsFolder": "Lockheed Martin",
    },
    "rtx": {
        "match": "RTX Corporation",
        "nameHe": "RTX",
        "nameEn": "RTX Corporation",
        "reportsFolder": "RTX",
    },
    "leonardo": {
        "match": "Leonardo S.p.a",
        "nameHe": "לאונרדו",
        "nameEn": "Leonardo S.p.A.",
        "reportsFolder": "Leonardo Spa",
    },
    "bae": {
        "match": "BAE Systems plc",
        "nameHe": "BAE Systems",
        "nameEn": "BAE Systems plc",
        "reportsFolder": "BAE Systems",
    },
    "rheinmetall": {
        "match": "Rheinmetall AG",
        "nameHe": "ריינמטאל",
        "nameEn": "Rheinmetall AG",
        "reportsFolder": "Rheinmetall",
    },
    "thales": {
        "match": "Thales S.A.",
        "nameHe": "טלס",
        "nameEn": "Thales Group",
        "reportsFolder": "Thales",
    },
    "gd": {
        "match": "General Dynamics",
        "nameHe": "ג׳נרל דיינמיקס",
        "nameEn": "General Dynamics Corporation",
        "reportsFolder": "General Dynamics",
    },
    "northrop": {
        "match": "Northrop Grumman",
        "nameHe": "נורת׳רופ גראמן",
        "nameEn": "Northrop Grumman Corporation",
        "reportsFolder": "Northrop Grumman",
    },
    "l3harris": {
        "match": "L3Harris Technologies",
        "nameHe": "L3Harris Technologies",
        "nameEn": "L3Harris Technologies, Inc.",
        "reportsFolder": "L3Harris",
    },
    "boeing": {
        "match": "The Boeing Company",
        "nameHe": "בואינג",
        "nameEn": "The Boeing Company",
        "reportsFolder": "Boeing",
    },
    "embraer": {
        "match": "Embraer S.A.",
        "nameHe": "אמבראיר",
        "nameEn": "Embraer S.A.",
        "reportsFolder": "EMBRAER",
    },
    "saab": {
        "match": "Saab AB",
        "nameHe": "סאאב",
        "nameEn": "Saab AB",
        "reportsFolder": "SaaB",
    },
}

# עמודות בגיליון (0-based), נכון למבנה "Wide A&D BM" עם 9 בלוקי מדדים.
# כל בלוק: [FY0, FY2025, FY2024, FY2023, FY2022, FY2021, FY2020] ($000)
COL_ENTITY_NAME = 1
BLOCKS = {
    "revenue": 7,
    "grossProfit": 14,
    "ebit": 21,
    "backlog": 28,
    "rd": 35,
    "capex": 42,
    "netIncome": 49,
    "ebitda": 56,
    "cfo": 63,
}
YEARS = [2025, 2024, 2023, 2022, 2021, 2020]
HEADER_ROW = 3  # שורה 4 בגיליון (0-based=3): כותרות העמודות
FIRST_DATA_ROW = 4


def find_default_xlsx() -> str:
    search_dirs = [
        os.path.join(WEBSITE_ROOT, "scripts", "data_source"),
        WEBSITE_ROOT,
    ]
    matches = []
    for d in search_dirs:
        matches = sorted(glob.glob(os.path.join(d, "CIQ*.xlsx")))
        if matches:
            break
    if not matches:
        raise SystemExit(
            "לא נמצא קובץ CIQ*.xlsx ב-scripts/data_source או בתיקיית website. "
            "העבירו נתיב מפורש כארגומנט."
        )
    if len(matches) > 1:
        print(f"אזהרה: נמצאו כמה קבצי CIQ*.xlsx, נבחר האחרון: {matches[-1]}")
    return matches[-1]


def load_rows(xlsx_path: str):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["Wide A&D BM"]
    rows = list(ws.iter_rows(min_row=FIRST_DATA_ROW + 1, values_only=True))
    return rows


def num(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def to_musd(v_thousands):
    v = num(v_thousands)
    if v is None:
        return None
    return round(v / 1000.0, 3)


def build_metrics(row) -> list[dict]:
    values = {}
    for key, base_col in BLOCKS.items():
        # base_col עצמו הוא FY0 (לא בשימוש); FY2025..FY2020 הם base_col+1 .. base_col+6
        values[key] = [row[base_col + 1 + i] for i in range(len(YEARS))]

    metrics = []
    for i, year in enumerate(YEARS):
        revenue_musd = to_musd(values["revenue"][i])
        gross_musd = to_musd(values["grossProfit"][i])
        gross_margin_pct = None
        if revenue_musd is not None and gross_musd is not None and revenue_musd > 0:
            gross_margin_pct = round(gross_musd / revenue_musd * 100, 3)

        capex_raw = to_musd(values["capex"][i])
        # בקובץ ה-CIQ קאפקס מדווח כשלילי (תזרים יוצא); המבנה הקיים באתר
        # (ראו iaiMetrics.freeCashFlowMUSD) מניח capex כערך חיובי.
        capex_musd = abs(capex_raw) if capex_raw is not None else None

        metrics.append(
            {
                "year": year,
                "revenueMUSD": revenue_musd,
                "backlogMUSD": to_musd(values["backlog"][i]),
                "netIncomeMUSD": to_musd(values["netIncome"][i]),
                "operatingIncomeMUSD": to_musd(values["ebit"][i]),
                "grossMarginPct": gross_margin_pct,
                "operatingCashFlowMUSD": to_musd(values["cfo"][i]),
                "investingCashFlowMUSD": None,
                "financingCashFlowMUSD": None,
                "totalAssetsMUSD": None,
                "totalLiabilitiesMUSD": None,
                "equityMUSD": None,
                "capexMUSD": capex_musd,
                "researchDevelopmentMUSD": to_musd(values["rd"][i]),
                "marketingSalesMUSD": None,
                "generalAdminMUSD": None,
                "revenueBySegmentMUSD": None,
                "salesByRegionPct": None,
                "ebitdaMUSD": to_musd(values["ebitda"][i]),
                "employees": None,
                "notes": None,
            }
        )
    metrics.sort(key=lambda m: m["year"])
    return metrics


def main():
    xlsx_path = sys.argv[1] if len(sys.argv) > 1 else find_default_xlsx()
    print(f"קורא נתונים מ: {xlsx_path}")
    rows = load_rows(xlsx_path)

    by_match = {}
    for row in rows:
        name = row[COL_ENTITY_NAME]
        if not name:
            continue
        by_match[str(name)] = row

    generated_at = datetime.now().isoformat(timespec="seconds")
    missing = []

    for slug, cfg in COMPANIES.items():
        matched_row = None
        for name, row in by_match.items():
            if cfg["match"] in name:
                matched_row = row
                break
        if matched_row is None:
            missing.append(slug)
            metrics = []
        else:
            metrics = build_metrics(matched_row)

        has_any_data = any(
            any(v is not None for k, v in m.items() if k != "year") for m in metrics
        )

        payload = {
            "company": {
                "slug": slug,
                "nameHe": cfg["nameHe"],
                "nameEn": cfg["nameEn"],
                "reportsFolder": cfg["reportsFolder"],
            },
            "currencyNote": (
                "מיליוני דולר ארה״ב (MUSD). כל הנתונים מיובאים אך ורק מקובץ "
                "הייצוא CapitalIQ/S&P Global \"Wide A&D BM\". שדות שאינם קיימים "
                "במקור (מאזן, תזרים השקעה/מימון, פילוחי מגזר/אזור, עובדים) נשארים null."
            ),
            "insights": (
                []
                if has_any_data
                else ["לא נמצאו נתונים פיננסיים לחברה זו בקובץ המקור (CIQ Wide A&D BM)."]
            ),
            "metrics": metrics,
            "files": [],
            "generatedAt": generated_at,
        }

        out_path = os.path.join(DATA_DIR, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"  {slug}: {'נכתב' if has_any_data else 'נכתב (ריק — לא נמצאו נתונים)'} -> {out_path}")

    if missing:
        print(f"אזהרה: לא נמצאה התאמה בגיליון עבור: {', '.join(missing)}")


if __name__ == "__main__":
    main()
