#!/usr/bin/env python3
"""Reorder company page sections — see module docstring in repo."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "src" / "pages"

M_INSIGHTS = "\n\n      <h2>תובנות</h2>"
M_TRENDS = "\n\n      <h2>מגמות לאורך שנים</h2>"
M_CASH = "\n\n      {(cashFlowChartHasData"
M_TABLE = "\n\n      <h2>טבלת נתונים לפי שנה</h2>"
M_SEG = "\n\n      {segmentKeys.length > 0 && ("
# Note: split(M_FILES) leaves middle ending with ` />` with no newline after the closing tag.
M_BREAK = "\n\n      <h2>מגמות: שנה מול שנה ולפי נושא</h2>\n      <IaiBreakdownDemos metrics={data.metrics} />"
M_FILES = "\n\n      <h2>קבצי דוח בתיקייה</h2>"

# IAI only: model section between insights and trends in original file
M_IAI_MODEL = "\n\n      <h2>ניסוי מודל: המרת התקשרויות למכירות</h2>"


def reorder_middle(middle: str) -> str:
    """
    middle = content starting with M_INSIGHTS, ending before M_FILES (exclusive of M_FILES).
    Original order: insights, trends, cash, table, segment?, breakdown
    New order: trends, breakdown, cash, table, insights, segment?
    """
    if not middle.startswith(M_INSIGHTS):
        raise ValueError("middle must start with תובנות h2")

    i_t = middle.find(M_TRENDS)
    if i_t < 0:
        raise ValueError("מגמות לאורך שנים not found")
    insights_block = middle[:i_t]

    i_c = middle.find(M_CASH, i_t)
    if i_c < 0:
        raise ValueError("cash block not found")
    trends_block = middle[i_t:i_c]

    i_tab = middle.find(M_TABLE, i_c)
    if i_tab < 0:
        raise ValueError("table not found")
    cash_block = middle[i_c:i_tab]

    i_br = middle.find(M_BREAK, i_tab)
    if i_br < 0:
        raise ValueError("breakdown not found")

    between = middle[i_tab:i_br]
    i_seg = between.find(M_SEG)
    if i_seg >= 0:
        table_block = between[:i_seg]
        segment_block = between[i_seg:]
    else:
        table_block = between
        segment_block = ""

    breakdown_block = middle[i_br : i_br + len(M_BREAK)]
    tail = middle[i_br + len(M_BREAK) :]
    if tail.strip():
        raise ValueError(f"unexpected trailing content in middle: {tail[:120]!r}")

    return trends_block + breakdown_block + cash_block + table_block + insights_block + segment_block


def reorder_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "IaiCompanyPage" in path.name:
        return reorder_iaifile(path, text)
    if M_INSIGHTS not in text or M_FILES not in text:
        print(f"skip (markers): {path.name}", file=sys.stderr)
        return False
    pre, rest = text.split(M_INSIGHTS, 1)
    middle, post = rest.split(M_FILES, 1)
    middle = M_INSIGHTS + middle
    try:
        new_middle = reorder_middle(middle)
    except ValueError as e:
        print(f"{path.name}: {e}", file=sys.stderr)
        return False
    path.write_text(pre + new_middle + M_FILES + post, encoding="utf-8")
    print(f"ok: {path.name}")
    return True


def reorder_iaifile(path: Path, text: str) -> bool:
    """IAI: after תקציר — trends, breakdown, cash, table, insights, model, segment, files."""
    if M_INSIGHTS not in text or M_FILES not in text:
        return False
    pre, rest = text.split(M_INSIGHTS, 1)
    middle, post = rest.split(M_FILES, 1)
    middle = M_INSIGHTS + middle

    i_model = middle.find(M_IAI_MODEL)
    if i_model < 0:
        print("IAI: model marker missing", file=sys.stderr)
        return False

    insights_block = middle[:i_model]
    rest_mid = middle[i_model:]  # starts with ניסוי מודל

    i_t = rest_mid.find(M_TRENDS)
    if i_t < 0:
        return False
    model_block = rest_mid[:i_t]
    core = rest_mid[i_t:]  # trends through breakdown (same as standard from trends)

    i_c = core.find(M_CASH)
    i_tab = core.find(M_TABLE)
    i_br = core.find(M_BREAK)
    if min(i_c, i_tab, i_br) < 0:
        return False
    trends_block = core[:i_c]
    cash_block = core[i_c:i_tab]
    between = core[i_tab:i_br]
    i_seg = between.find(M_SEG)
    if i_seg >= 0:
        table_block = between[:i_seg]
        segment_block = between[i_seg:]
    else:
        table_block = between
        segment_block = ""
    breakdown_block = core[i_br : i_br + len(M_BREAK)]
    tail = core[i_br + len(M_BREAK) :]
    if tail.strip():
        print(f"IAI tail: {tail[:80]!r}", file=sys.stderr)
        return False

    new_middle = (
        trends_block + breakdown_block + cash_block + table_block + insights_block + model_block + segment_block
    )
    path.write_text(pre + new_middle + M_FILES + post, encoding="utf-8")
    print(f"ok: {path.name} (IAI)")
    return True


def main() -> None:
    files = sorted(PAGES.glob("*CompanyPage.tsx"))
    ok = 0
    for p in files:
        if reorder_file(p):
            ok += 1
    print(f"done: {ok}/{len(files)}", file=sys.stderr)


if __name__ == "__main__":
    main()
