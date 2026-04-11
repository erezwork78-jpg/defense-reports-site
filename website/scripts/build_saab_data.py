#!/usr/bin/env python3
"""סורק את תיקיית SaaB ומעדכן את public/data/saab.json"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT.parent / "SaaB"
OUT = ROOT / "public" / "data" / "saab.json"
METRICS_PATH = ROOT / "public" / "data" / "saab-metrics.json"
TARGET_YEARS = list(range(2020, 2026))
YEAR_RE = re.compile(r"(?<![0-9])(202[0-5])(?![0-9])")


def years_from_name(name: str) -> list[int]:
    return sorted(set(int(m.group(1)) for m in YEAR_RE.finditer(name)))


def main() -> None:
    files_out = []
    if REPORTS.is_dir():
        for p in sorted(REPORTS.iterdir()):
            if p.name.startswith(".") or not p.is_file():
                continue
            files_out.append(
                {
                    "fileName": p.name,
                    "yearsInName": years_from_name(p.name),
                    "sizeBytes": p.stat().st_size,
                    "extension": p.suffix.lower().lstrip("."),
                }
            )
    else:
        print(f"אזהרה: לא נמצאה תיקייה {REPORTS}")

    if METRICS_PATH.is_file():
        raw = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
        metrics_rows = raw.get("rows", [])
        insights_out = [str(x).strip() for x in (raw.get("insights") or []) if str(x).strip()]
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
        insights_out = []

    payload = {
        "company": {
            "slug": "saab",
            "nameHe": "סאאב",
            "nameEn": "Saab AB",
            "reportsFolder": "SaaB",
        },
        "currencyNote": "המספרים בשדות המטריקה הם ב־מיליוני קרונות שוודיות (MSEK) כפי שמופיעים בדוחות — לא בדולרים. השוואה ישירה לחברות ב־USD עלולה להטעות.",
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
