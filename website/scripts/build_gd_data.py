#!/usr/bin/env python3
"""
סורק את תיקיית דוחות General Dynamics ומעדכן את public/data/gd.json
נתונים מספריים מ-public/data/gd-metrics.json אם קיים.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT.parent / "General Dynamics"
OUT = ROOT / "public" / "data" / "gd.json"
METRICS_PATH = ROOT / "public" / "data" / "gd-metrics.json"

TARGET_YEARS = list(range(2020, 2026))
YEAR_RE = re.compile(r"(?<![0-9])(202[0-5])(?![0-9])")


def years_from_name(name: str) -> list[int]:
    found = [int(m.group(1)) for m in YEAR_RE.finditer(name)]
    return sorted(set(found))


def main() -> None:
    files_out = []
    if REPORTS.is_dir():
        for p in sorted(REPORTS.iterdir()):
            if p.name.startswith(".") or not p.is_file():
                continue
            ys = years_from_name(p.name)
            files_out.append(
                {
                    "fileName": p.name,
                    "yearsInName": ys,
                    "sizeBytes": p.stat().st_size,
                    "extension": p.suffix.lower().lstrip("."),
                }
            )
    else:
        print(f"אזהרה: לא נמצאה תיקייה {REPORTS}")

    metrics_rows = []
    insights_out: list[str] = []
    if METRICS_PATH.is_file():
        raw = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
        metrics_rows = raw.get("rows", [])
        insights_out = raw.get("insights") or []
        if not isinstance(insights_out, list):
            insights_out = []
        insights_out = [str(x).strip() for x in insights_out if str(x).strip()]
    else:
        metrics_rows = [
            {
                "year": y,
                "revenueMUSD": None,
                "backlogMUSD": None,
                "netIncomeMUSD": None,
                "operatingIncomeMUSD": None,
                "grossMarginPct": None,
                "operatingCashFlowMUSD": None,
                "investingCashFlowMUSD": None,
                "financingCashFlowMUSD": None,
                "totalAssetsMUSD": None,
                "totalLiabilitiesMUSD": None,
                "equityMUSD": None,
                "capexMUSD": None,
                "researchDevelopmentMUSD": None,
                "ebitdaMUSD": None,
                "employees": None,
            }
            for y in TARGET_YEARS
        ]

    payload = {
        "company": {
            "slug": "gd",
            "nameHe": "ג׳נרל דיינמיקס",
            "nameEn": "General Dynamics Corporation",
            "reportsFolder": "General Dynamics",
        },
        "currencyNote": "מיליוני דולר ארה״ב (MUSD); המקור בדוחות המאוחדים (10-K) בדולרים במיליונים.",
        "insights": insights_out,
        "metrics": metrics_rows,
        "files": files_out,
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"נכתב {OUT} ({len(files_out)} קבצים)")


if __name__ == "__main__":
    main()
