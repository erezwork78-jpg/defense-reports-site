# -*- coding: utf-8 -*-
"""
Scan local PDF/HTM reports under ~/Documents/01. דוחות כספיים for AI-related mentions.
Updates public/data/ai-narratives-defense.json for non-Israeli slugs (preserves iai, elbit, rafael).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

BASE = Path.home() / "Documents" / "01. דוחות כספיים"
ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "public/data/ai-narratives-defense.json"
REPORT_PATH = ROOT / "scripts/ai_scan_report.txt"

SKIP_SLUGS = frozenset({"iai", "elbit", "rafael"})

# slug -> list of (year, relative_path_under_BASE)
FILE_PLAN: dict[str, list[tuple[int, str]]] = {
    "bae": [
        (2023, "BAE Systems/BAESystemsAnnualReport2023.pdf"),
        (2024, "BAE Systems/BAE-Systems-Annual-Report-2024.pdf"),
        (2025, "BAE Systems/BAE-Systems-Annual-Report-2025.pdf"),
    ],
    "boeing": [
        (2023, "Boeing/Boeing-2023-Annual-Report.pdf"),
        (2024, "Boeing/Boeing 2024-annual-report.pdf"),
        (2025, "Boeing/The_Boeing_Company-AR2025.pdf"),
    ],
    "embraer": [
        (2023, "EMBRAER/SEC-10K-2023-12-31-official.htm"),
        (2024, "EMBRAER/EMBRAER 2024.pdf"),
        (2025, "EMBRAER/EMBRAER 2025 20-F.pdf"),
    ],
    "gd": [
        (2023, "General Dynamics/2023-general-dynamics-annual-report-form-ars-_final-pdf.pdf"),
        (2024, "General Dynamics/2024-Annual-Report-General-Dynamics-Corporation.pdf"),
        (2025, "General Dynamics/GD_2025-Annual-Report.pdf"),
    ],
    "l3harris": [
        (2023, "L3Harris/SEC-10K-FY2023-hrs-20231229.htm"),
        (2024, "L3Harris/L3Harris - 2024 Annual Report.pdf"),
        (2025, "L3Harris/L3Harris_2025_Annual_Report.pdf"),
    ],
    "leonardo": [
        (2023, "Leonardo Spa/Integrated Annual Report 2023_12032024_per sito.pdf"),
        (2024, "Leonardo Spa/2024 Integrated Annual Report - Leonardo.pdf"),
        (2025, "Leonardo Spa/Integrated Report 2025.pdf"),
    ],
    "lockheed": [
        (2023, "Lockheed Martin/lockheed-martin-annual-report-2023.pdf"),
        (2024, "Lockheed Martin/lockheed-martin-annual-report-2024.pdf"),
        (2025, "Lockheed Martin/SEC-10K-FY2025-lmt-20251231.htm"),
    ],
    "northrop": [
        (2023, "Northrop Grumman/NORTHROP GRUMMAN CORPORATION - 2023 Annual Report.pdf"),
        (2024, "Northrop Grumman/NORTHROP GRUMMAN 2024 ANNUAL REPORT.pdf"),
        (2025, "Northrop Grumman/Northrop-Grumman-2025-Annual-Report.pdf"),
    ],
    "rtx": [
        (2023, "RTX/SEC-10K-FY2023-rtx-20231231.htm"),
        (2024, "RTX/SEC-10K-FY2024-rtx-20241231.htm"),
        (2025, "RTX/2025-12-31 10-K-Final.pdf"),
    ],
    "rheinmetall": [
        (2023, "Rheinmetall/DE0007030009-JA-2023-EQ-E-00.pdf"),
        (2024, "Rheinmetall/DE0007030009-JA-2024-EQ-E-00.pdf"),
        (2025, "Rheinmetall/Rheinmetall-Annual-Report-2025.pdf"),
    ],
    "saab": [
        (2023, "SaaB/saab-annual-and-sustainability-report-2023-official.pdf"),
        (2024, "SaaB/20250303-saab-publishes-its-2024-annual-and-sustainability-report-en-0-4999946.pdf"),
        (2025, "SaaB/2026-03-03 - saab 2025 annual report.pdf"),
    ],
    "thales": [
        (2023, "Thales/Thales-notice-availability-URD-2023-Euronext-official.pdf"),
        (2024, "Thales/Thales - Consolidated Financial Statements at 31 December 2024.pdf"),
        (2025, "Thales/Thales_Consolidated_Financial_Statements_at_31_December_2025_0.pdf"),
    ],
}

KW = re.compile(
    r"artificial intelligence|\bAI\b|machine learning|generative AI|\bGenAI\b|deep learning|"
    r"\bLLM\b|large language model|neural network|autonomous system|robotics|"
    r"big data|data analytics|algorithm|digital twin|computer vision|agentic AI",
    re.I,
)


def load_text(path: Path) -> str:
    if not path.exists():
        return ""
    suf = path.suffix.lower()
    if suf in (".htm", ".html"):
        raw = path.read_text(encoding="utf-8", errors="ignore")
        raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
        raw = re.sub(r"<style[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
        raw = re.sub(r"<[^>]+>", " ", raw)
        return re.sub(r"\s+", " ", raw)
    try:
        r = PdfReader(str(path))
        parts: list[str] = []
        for page in r.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception as e:
        return f"<<PDF_ERROR {e}>>"


def snippets(text: str, limit: int = 12) -> tuple[int, list[str]]:
    if not text or text.startswith("<<PDF_ERROR"):
        return 0, []
    text = text.replace("\x00", " ")
    seen: set[str] = set()
    out: list[str] = []
    n = 0
    for m in KW.finditer(text):
        n += 1
        a, b = max(0, m.start() - 320), min(len(text), m.end() + 320)
        sn = re.sub(r"\s+", " ", text[a:b]).strip()
        key = sn[:100]
        if key in seen:
            continue
        seen.add(key)
        out.append(sn[:700])
        if len(out) >= limit:
            break
    return n, out


def he_summary_from_english(slug: str, year: int, hit_count: int, snips: list[str]) -> tuple[str | None, str | None, str | None, str | None]:
    """Returns whatTheySay, productImpact, operationsImpact, forwardLooking — Hebrew summaries."""
    if hit_count == 0 or not snips:
        return (
            f"בחילוץ אוטומטי מהקובץ שצוין לשנת {year} לא זוהו אזכורים ברורים של מונחי AI / בינה מלאכותית / למידת מכונה (או שהמסמך אינו מלא טקסט נשלף).",
            None,
            None,
            None,
        )
    blob = " ".join(snips).lower()
    parts_what: list[str] = [
        f"בטקסט שחולץ מהדוח לשנת {year} זוהו אזכורים למילות מפתח הקשורות ל־AI, למידת מכונה, generative AI, אוטונומיה וכו׳ (חיפוש אוטומטי — יש לאמת בדוח המקור)."
    ]
    prod = ops = fwd = None
    if "product" in blob or "portfolio" in blob or "customer" in blob or "defense" in blob:
        prod = (
            "לפי קטעים שחולצו: התייחסות ליכולות טכנולוגיות הקשורות ל־AI/למידת מכונה/אוטונומיה בהקשר של מוצרים, פתרונות או שוק — יש לאמת מול עמוד המקור בדוח."
        )
    if "operat" in blob or "business" in blob or "process" in blob or "employee" in blob:
        ops = "לפי קטעים שחולצו: התייחסות ל־AI בהקשר תפעולי או ארגוני (תהליכים, סיכונים עסקיים) — יש לאמת מול הדוח."
    if "expect" in blob or "future" in blob or "may" in blob or "will" in blob or "plan" in blob:
        fwd = "מופיעים ניסוחים באנגלית מסוג ציפייה/אפשרות (expect, may, future וכו׳) סביב טכנולוגיה או סיכונים — לפי הדוח בלבד, לא כתחזית האתר."
    if prod is None and hit_count > 0:
        prod = "האזכורים בטקסט שחולץ אינם מסווגים אוטומטית למוצר מול תפעול — מומלץ לעבור לסעיפי אסטרטגיה/סיכונים/מוצר בדוח המקורי."
    parts_what.append("דוגמאות קצרות מהטקסט (אנגלית): " + snips[0][:280] + ("…" if len(snips[0]) > 280 else ""))
    return "\n".join(parts_what), prod, ops, fwd


def qualitative_trend(slug: str, by_year: dict[int, int]) -> str:
    ys = sorted(by_year.keys())
    found_years = [y for y in ys if by_year[y] > 0]
    if not found_years:
        return (
            f"בקבצים שסורקו לטווח {ys[0]}–{ys[-1]} לא זוהה בחילוץ האוטומטי טקסט עם מילות המפתח שנבחרו; "
            f"ייתכן שהדוחות הם כספיים צרים או שהניסוח שונה — כדאי לבדוק ידנית."
        )
    missing = [y for y in ys if y not in found_years]
    extra = f" בשנים {', '.join(str(y) for y in missing)} לא זוהה אזכור בחילוץ האוטומטי." if missing else ""
    return (
        f"בחילוץ האוטומטי הופיעו אזכורים רלוונטיים בדוחות לשנים: {', '.join(str(y) for y in found_years)}; "
        f"מומלץ השוואה איכותנית ידנית בין הדוחות (אסטרטגיה, סיכונים, תיאור מוצרים).{extra}"
    )


def main() -> None:
    data = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    lines: list[str] = ["דוח סריקת AI — חברות זרות", "=" * 50, ""]

    for c in data["companies"]:
        slug = c["slug"]
        if slug in SKIP_SLUGS:
            lines.append(f"[{slug}] נשמר ללא שינוי (חברה ישראלית — עודכן ידנית קודם).")
            continue
        plan = FILE_PLAN.get(slug)
        if not plan:
            lines.append(f"[{slug}] אין מיפוי קבצים בסקריפט — דילוג.")
            continue

        by_year_counts: dict[int, int] = {}
        new_years: list[dict] = []

        for year, rel in plan:
            path = BASE / rel
            text = load_text(path)
            n, snip_list = snippets(text)
            by_year_counts[year] = n
            w, p, o, f = he_summary_from_english(slug, year, n, snip_list)
            src = [{"document": Path(rel).name, "sectionOrPage": "חילוץ אוטומטי — יש לאמת מול PDF"}]
            if not path.exists():
                w = f"הקובץ לא נמצא בנתיב: {rel}"
                src = [{"document": rel, "sectionOrPage": "חסר בדיסק"}]
            new_years.append(
                {
                    "year": year,
                    "whatTheySay": w,
                    "productImpact": p,
                    "operationsImpact": o,
                    "forwardLookingFromReport": f,
                    "sources": src,
                }
            )

        c["years"] = new_years
        c["qualitativeTrend"] = qualitative_trend(slug, by_year_counts)

        status = "נמצאו אזכורים (התאמות מילות מפתח)" if sum(by_year_counts.values()) > 0 else "לא נמצאו התאמות"
        lines.append(f"[{slug}] {status} | per-year: {by_year_counts}")
        lines.append("")

    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("Wrote", OUT_JSON)
    print("Report:", REPORT_PATH)


if __name__ == "__main__":
    main()
