#!/usr/bin/env python3
"""
סורק את תיקיית דוחות Lockheed Martin ומעדכן את public/data/lockheed.json
נתונים מספריים מ-public/data/lockheed-metrics.json אם קיים.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT.parent / "Lockheed Martin"
OUT = ROOT / "public" / "data" / "lockheed.json"
METRICS_PATH = ROOT / "public" / "data" / "lockheed-metrics.json"

YEAR_RE = __import__("re").compile(r"(?<![0-9])(20[12][0-9])(?![0-9])")


def years_from_name(name: str) -> list[int]:
    return sorted({int(m.group(1)) for m in YEAR_RE.finditer(name)})


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
        metrics_rows = []
        insights_out = []

    payload = {
        "company": {
            "slug": "lockheed",
            "nameHe": "לוקהיד מרטין",
            "nameEn": "Lockheed Martin Corporation",
            "reportsFolder": "Lockheed Martin",
        },
        "currencyNote": "דיווח בדולר ארה״ב (USD); באתר מוצגים מיליוני דולר (MUSD) — ראה lockheed-metrics insights.",
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
