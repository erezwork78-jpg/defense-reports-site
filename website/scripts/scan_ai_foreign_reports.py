# -*- coding: utf-8 -*-
"""
סריקת דוחות מקומיים בתיקיית '01. דוחות כספיים' לאזכורי AI.
פלט: קובץ JSON עם תוצאות גולמיות + עדכון ai-narratives-defense.json לחברות הזרות.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    raise SystemExit("pip install pypdf")

BASE = Path("/Users/erezbokobza/Documents/01. דוחות כספיים")
OUT_SCAN = Path(__file__).resolve().parents[1] / "scripts" / "_ai_scan_raw.json"
DATA_JSON = Path(__file__).resolve().parents[1] / "public/data/ai-narratives-defense.json"

# slug -> (שם תיקייה, {שנה: שם קובץ או None})
FILE_MAP: dict[str, tuple[str, dict[int, str | None]]] = {
    "lockheed": (
        "Lockheed Martin",
        {
            2023: "lockheed-martin-annual-report-2023.pdf",
            2024: "lockheed-martin-annual-report-2024.pdf",
            2025: "SEC-10K-FY2025-lmt-20251231.htm",
        },
    ),
    "rtx": (
        "RTX",
        {
            2023: "SEC-10K-FY2023-rtx-20231231.htm",
            2024: "SEC-10K-FY2024-rtx-20241231.htm",
            2025: "2025-12-31 10-K-Final.pdf",
        },
    ),
    "leonardo": (
        "Leonardo Spa",
        {
            2023: "Integrated Annual Report 2023_12032024_per sito.pdf",
            2024: "2024 Integrated Annual Report - Leonardo.pdf",
            2025: "Integrated Report 2025.pdf",
        },
    ),
    "bae": (
        "BAE Systems",
        {
            2023: "BAESystemsAnnualReport2023.pdf",
            2024: "BAE-Systems-Annual-Report-2024.pdf",
            2025: "BAE-Systems-Annual-Report-2025.pdf",
        },
    ),
    "rheinmetall": (
        "Rheinmetall",
        {
            2023: "DE0007030009-JA-2023-EQ-E-00.pdf",
            2024: "DE0007030009-JA-2024-EQ-E-00.pdf",
            2025: "Rheinmetall-Annual-Report-2025.pdf",
        },
    ),
    "thales": (
        "Thales",
        {
            2023: "Thales_-_Consolidated_financial_statements_at_30_June_2023_1_1.pdf",
            2024: "Thales - Consolidated Financial Statements at 31 December 2024.pdf",
            2025: "Thales_Consolidated_Financial_Statements_at_31_December_2025_0.pdf",
        },
    ),
    "gd": (
        "General Dynamics",
        {
            2023: "2023-general-dynamics-annual-report-form-ars-_final-pdf.pdf",
            2024: "2024-Annual-Report-General-Dynamics-Corporation.pdf",
            2025: "GD_2025-Annual-Report.pdf",
        },
    ),
    "northrop": (
        "Northrop Grumman",
        {
            2023: "NORTHROP GRUMMAN CORPORATION - 2023 Annual Report.pdf",
            2024: "NORTHROP GRUMMAN 2024 ANNUAL REPORT.pdf",
            2025: "Northrop-Grumman-2025-Annual-Report.pdf",
        },
    ),
    "l3harris": (
        "L3Harris",
        {
            2023: "SEC-10K-FY2023-hrs-20231229.htm",
            2024: "L3Harris - 2024 Annual Report.pdf",
            2025: "L3Harris_2025_Annual_Report.pdf",
        },
    ),
    "boeing": (
        "Boeing",
        {
            2023: "Boeing-2023-Annual-Report.pdf",
            2024: "Boeing 2024-annual-report.pdf",
            2025: "The_Boeing_Company-AR2025.pdf",
        },
    ),
    "embraer": (
        "EMBRAER",
        {
            2023: "SEC-10K-2023-12-31-official.htm",
            2024: "EMBRAER 2024.pdf",
            2025: "EMBRAER 2025 20-F.pdf",
        },
    ),
    "saab": (
        "SaaB",
        {
            2023: "saab-annual-and-sustainability-report-2023-official.pdf",
            2024: "20250303-saab-publishes-its-2024-annual-and-sustainability-report-en-0-4999946.pdf",
            2025: "2026-03-03 - saab 2025 annual report.pdf",
        },
    ),
}

# דפוסים: אנגלית + צרפתית + גרמנית (Thales / Rheinmetall)
KW = re.compile(
    r"artificial intelligence|machine learning|\bgenerative AI\b|\bGenAI\b|"
    r"deep learning|large language model|\bLLMs?\b|neural network|"
    r"AI-enabled|AI-powered|\bAI technologies\b|\bcognitive\b.{0,40}\bcomputing\b|"
    r"\bdata analytics\b.{0,80}\bAI\b|\bAI\b.{0,40}machine|"
    r"intelligence artificielle|apprentissage automatique|apprentissage profond|"
    r"Künstliche Intelligenz|künstliche Intelligenz|maschinelles Lernen|"
    r"Machine Learning|Generative KI",
    re.I | re.DOTALL,
)


def extract_text(path: Path) -> str:
    if not path.exists():
        return ""
    suf = path.suffix.lower()
    if suf == ".pdf":
        try:
            r = PdfReader(str(path))
            parts: list[str] = []
            for pg in r.pages:
                parts.append(pg.extract_text() or "")
            return "\n".join(parts)
        except Exception as e:
            return f"<<PDF_ERROR {e}>>"
    if suf in (".htm", ".html"):
        raw = path.read_text(encoding="utf-8", errors="ignore")
        raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.I | re.DOTALL)
        raw = re.sub(r"<style[^>]*>.*?</style>", " ", raw, flags=re.I | re.DOTALL)
        return re.sub(r"<[^>]+>", " ", raw)
    return ""


def snippets(text: str, limit: int = 12) -> list[str]:
    text = re.sub(r"\s+", " ", text.replace("\x00", " "))
    out: list[str] = []
    seen: set[str] = set()
    for m in KW.finditer(text):
        a, b = max(0, m.start() - 280), min(len(text), m.end() + 280)
        sn = text[a:b].strip()
        if len(sn) < 40:
            continue
        key = sn[:100]
        if key in seen:
            continue
        seen.add(key)
        out.append(sn[:650])
        if len(out) >= limit:
            break
    return out


def scan_all() -> dict:
    results: dict = {}
    for slug, (folder, years_files) in FILE_MAP.items():
        fdir = BASE / folder
        results[slug] = {"folder": folder, "years": {}}
        for year, fname in sorted(years_files.items()):
            if not fname:
                results[slug]["years"][str(year)] = {"file": None, "found": False, "snippets": []}
                continue
            p = fdir / fname
            txt = extract_text(p)
            is_pdf_err = bool(txt.startswith("<<PDF_ERROR"))
            raw_len = len(txt) if txt and not is_pdf_err else 0
            if p.suffix.lower() == ".pdf" and not is_pdf_err and 0 < raw_len < 800:
                sn = []
                low_text = True
            else:
                low_text = False
                sn = snippets(txt) if txt and not is_pdf_err else []
            results[slug]["years"][str(year)] = {
                "file": fname,
                "exists": p.exists(),
                "chars": len(txt),
                "found": len(sn) > 0,
                "low_text": low_text,
                "pdf_error": is_pdf_err,
                "snippets": sn,
            }
    return results


def hebrew_from_snippets(snippets: list[str], company_he: str, year: int) -> tuple[str | None, str | None, str | None]:
    """מחזיר (whatTheySay, productImpact, operationsImpact) — איכותני לפי קטעים."""
    if not snippets:
        return None, None, None
    blob = " ".join(snippets[:4]).lower()
    parts_w: list[str] = []
    if "risk" in blob or "subject to" in blob or "exposure" in blob:
        parts_w.append("הדוח כולל התייחסות לסיכונים או לאתגרים הקשורים לטכנולוגיות בינה מלאכותית / למידת מכונה (לרבות מסגרת רגולטורית מתפתחת, תחרות, או שימוש לרעה).")
    if "generative" in blob or "genai" in blob or "large language" in blob:
        parts_w.append("מוזכרת בינה מלאכותית גנרטיבית (Generative AI) ו/או מודלים גדולי שפה (LLM) — בהקשר מוצרי, תפעולי או סיכוני סייבר.")
    if "product" in blob or "solution" in blob or "portfolio" in blob or "system" in blob:
        parts_w.append("מוזכר שילוב יכולות AI במוצרים, בפתרונות או בפורטפוליו טכנולוגי.")
    if "operation" in blob or "business" in blob or "process" in blob or "enterprise" in blob:
        parts_w.append("מוזכר שימוש או שילוב של AI בתהליכי עסק / תפעול.")
    if not parts_w:
        parts_w.append(
            "מזוהים בדוח אזכורים לבינה מלאכותית, למידת מכונה או מונחים קרובים — ראו מקור. "
            "מומלץ לאמת מול קטעים רלוונטיים בדוח המלא."
        )
    what = " ".join(parts_w)
    prod = None
    ops = None
    if any(x in blob for x in ("product", "solution", "customer", "defense", "mission")):
        prod = "לפי קטעים שחולצו מהדוח: התייחסות לשילוב AI/ML או אנליטיקה מתקדמת בהקשר של מוצרים, מערכות או שירותים ללקוחות."
    if any(x in blob for x in ("operation", "process", "business", "enterprise", "efficien")):
        ops = "לפי קטעים שחולצו מהדוח: התייחסות לשימוש ב-AI או בכלים קוגניטיביים בהקשר תפעולי או ארגוני."
    if not prod and snippets:
        prod = "ראו פירוט כללי בשדה «מה כתוב בדוח»; לדיוק מוצרי יש לעיין במסמך המקור."
    return what, prod, ops


def forward_from_snippets(snippets: list[str]) -> str | None:
    blob = " ".join(snippets[:3]).lower()
    if any(x in blob for x in ("expect", "will ", "future", "planned", "continue to invest", "emerging")):
        return (
            "הדוחות כוללים לעיתים ניסוחים עתידיים (למשל ציפייה להרחבת שימוש ב-AI או השקעות) — "
            "מדובר בדברי החברה ולא בתחזית האתר; יש לקרוא את הסעיף המלא בדוח."
        )
    return None


NAME_HE = {
    "lockheed": "לוקהיד מרטין",
    "rtx": "RTX",
    "leonardo": "לאונרדו",
    "bae": "BAE Systems",
    "rheinmetall": "Rheinmetall",
    "thales": "Thales",
    "gd": "ג׳נרל דיינמיקס",
    "northrop": "נורת׳רופ גראמן",
    "l3harris": "L3Harris",
    "boeing": "בואינג",
    "embraer": "אמבראיר",
    "saab": "סאאב",
}


def apply_to_json(scan: dict) -> None:
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    by_slug = {c["slug"]: c for c in data["companies"]}

    for slug, pack in scan.items():
        if slug not in by_slug:
            continue
        c = by_slug[slug]
        name_he = NAME_HE.get(slug, c["nameHe"])
        trend_parts: list[str] = []
        new_years: list[dict] = []

        for ystr in ["2023", "2024", "2025"]:
            yd = pack["years"][ystr]
            year = int(ystr)
            sn = yd.get("snippets") or []
            found = yd.get("found", False)
            fname = yd.get("file")
            exists = yd.get("exists", False)

            sources = []
            if fname and exists:
                sources.append({"document": fname, "sectionOrPage": "חילוץ טקסט אוטומטי — יש לאמת סעיפים בדוח המלא"})

            if not exists or not fname:
                new_years.append(
                    {
                        "year": year,
                        "whatTheySay": "קובץ הדוח המתוכנן לשנה זו לא נמצא בתיקייה או שם הקובץ שונה — יש לעדכן את המיפוי בסקריפט.",
                        "productImpact": None,
                        "operationsImpact": None,
                        "forwardLookingFromReport": None,
                        "sources": [],
                    }
                )
                trend_parts.append(f"{year}: לא סורק — קובץ חסר.")
                continue

            if yd.get("pdf_error"):
                new_years.append(
                    {
                        "year": year,
                        "whatTheySay": (
                            f"לא ניתן לחלץ טקסט מ«{fname}» (שגיאת קריאת PDF). "
                            f"לעיתים נדרשת חבילת cryptography לקבצים מוצפנים: pip install cryptography. "
                            f"לאחר התקנה יש להריץ שוב את סקריפט הסריקה."
                        ),
                        "productImpact": None,
                        "operationsImpact": None,
                        "forwardLookingFromReport": None,
                        "sources": sources,
                    }
                )
                trend_parts.append(f"{year}: שגיאת חילוץ PDF — לא סווג.")
                continue

            if yd.get("low_text"):
                new_years.append(
                    {
                        "year": year,
                        "whatTheySay": (
                            f"הקובץ «{fname}» נסרק אך חילוץ הטקסט החזיר מעט מאוד תווים — ככל הנראה PDF מבוסס תמונה "
                            f"(ללא שכבת טקסט) או מסמך שאינו הדוח המלא. לא בוצע חיפוש אמין; מומלץ OCR או קובץ אלקטרוני אחר."
                        ),
                        "productImpact": None,
                        "operationsImpact": None,
                        "forwardLookingFromReport": None,
                        "sources": sources,
                    }
                )
                trend_parts.append(f"{year}: PDF ללא מספיק טקסט לחילוץ — לא סווג.")
                continue

            if not found:
                new_years.append(
                    {
                        "year": year,
                        "whatTheySay": (
                            f"בקובץ «{fname}» לא זוהו במסגרת חיפוש אוטומטי (ביטויים באנגלית כגון "
                            f"artificial intelligence, machine learning, generative AI, LLM וכו׳). "
                            f"ייתכן שימוש במונחים אחרים, אזכור רק בתמונות/טבלאות, או שהנושא אינו מופיע בדוח זה."
                        ),
                        "productImpact": None,
                        "operationsImpact": None,
                        "forwardLookingFromReport": None,
                        "sources": sources,
                    }
                )
                trend_parts.append(f"{year}: לא נמצאו אזכורים (חיפוש אוטומטי).")
                continue

            w, p, o = hebrew_from_snippets(sn, name_he, year)
            fw = forward_from_snippets(sn)
            new_years.append(
                {
                    "year": year,
                    "whatTheySay": w,
                    "productImpact": p,
                    "operationsImpact": o,
                    "forwardLookingFromReport": fw,
                    "sources": sources,
                }
            )
            trend_parts.append(f"{year}: נמצאו אזכורי AI/ML (חיפוש אוטומטי) בקובץ {fname}.")

        c["years"] = new_years
        c["qualitativeTrend"] = (
            f"סיכום איכותנית לפי סריקת קבצים בתיקיית «{pack['folder']}»: " + " ".join(trend_parts)
        )

    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    scan = scan_all()
    OUT_SCAN.write_text(json.dumps(scan, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_to_json(scan)
    print("Wrote", OUT_SCAN)
    print("Updated", DATA_JSON)


if __name__ == "__main__":
    main()
