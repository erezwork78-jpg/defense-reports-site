import type { MetricRow } from "../types/iai";

/** EBIT / הכנסות × 100 — כשיש רווח תפעולי והכנסות חיוביות */
export function operatingMarginPct(
  revenue: number | null | undefined,
  operating: number | null | undefined
): number | null {
  if (
    revenue == null ||
    operating == null ||
    revenue <= 0 ||
    Number.isNaN(revenue) ||
    Number.isNaN(operating)
  ) {
    return null;
  }
  return (operating / revenue) * 100;
}

/** רווח נקי / הכנסות × 100 */
export function netMarginPct(
  revenue: number | null | undefined,
  netIncome: number | null | undefined
): number | null {
  if (
    revenue == null ||
    netIncome == null ||
    revenue <= 0 ||
    Number.isNaN(revenue) ||
    Number.isNaN(netIncome)
  ) {
    return null;
  }
  return (netIncome / revenue) * 100;
}

/** EBITDA / הכנסות × 100 */
export function ebitdaMarginPct(
  revenue: number | null | undefined,
  ebitda: number | null | undefined
): number | null {
  if (
    revenue == null ||
    ebitda == null ||
    revenue <= 0 ||
    Number.isNaN(revenue) ||
    Number.isNaN(ebitda)
  ) {
    return null;
  }
  return (ebitda / revenue) * 100;
}

/** מלאי הזמנות חלקי הכנסות שנתיות (יחס בלי יחידות; לרוב בין 0.3 ל־2+) */
export function backlogToRevenueRatio(
  backlog: number | null | undefined,
  revenue: number | null | undefined
): number | null {
  if (
    backlog == null ||
    revenue == null ||
    revenue <= 0 ||
    Number.isNaN(backlog) ||
    Number.isNaN(revenue)
  ) {
    return null;
  }
  return backlog / revenue;
}

/** הוצאות מו״פ כאחוז מההכנסות */
export function rdPctOfRevenue(
  revenue: number | null | undefined,
  rd: number | null | undefined
): number | null {
  if (
    revenue == null ||
    rd == null ||
    revenue <= 0 ||
    Number.isNaN(revenue) ||
    Number.isNaN(rd)
  ) {
    return null;
  }
  return (rd / revenue) * 100;
}

/** שורות לפי שנה עם לפחות הכנסה (לציר X עקבי) */
export function rowsWithRevenue(metrics: MetricRow[]): MetricRow[] {
  return [...metrics]
    .filter((m) => m.revenueMUSD != null && m.revenueMUSD > 0)
    .sort((a, b) => a.year - b.year);
}

/**
 * תזרים חופשי פשוט: תזרים תפעולי פחות CapEx (שניהם במיליון USD).
 * מניחים ש־CapEx בנתונים מדווח כחיוב חיובי (סכום ההשקעה).
 */
export function freeCashFlowMUSD(
  operatingCashFlow: number | null | undefined,
  capex: number | null | undefined
): number | null {
  if (
    operatingCashFlow == null ||
    capex == null ||
    Number.isNaN(operatingCashFlow) ||
    Number.isNaN(capex)
  ) {
    return null;
  }
  return operatingCashFlow - capex;
}

/**
 * המרת רווח לתזרים: תזרים תפעולי חלקי רווח נקי (יחס ללא יחידות).
 * כשהרווח הנקי קרוב לאפס — לא מחזירים ערך (לא יציב).
 */
export function ocfToNetIncomeRatio(
  operatingCashFlow: number | null | undefined,
  netIncome: number | null | undefined
): number | null {
  if (
    operatingCashFlow == null ||
    netIncome == null ||
    Number.isNaN(operatingCashFlow) ||
    Number.isNaN(netIncome)
  ) {
    return null;
  }
  if (Math.abs(netIncome) < 1e-6) return null;
  return operatingCashFlow / netIncome;
}

/**
 * CAGR באחוזים בין שנה ראשונה לאחרונה בטווח:
 * (ערך_סוף / ערך_התחלה)^(1/n) − 1, כאשר n = הפרש השנים (מספר תקופות שנתיות).
 * דורש ערכים חיוביים (לא מתאים למגמת הפסד ללא התאמה).
 */
export function cagrAnnualPct(
  startValue: number,
  endValue: number,
  startYear: number,
  endYear: number
): number | null {
  const n = endYear - startYear;
  if (n <= 0) return null;
  if (
    startValue <= 0 ||
    endValue <= 0 ||
    Number.isNaN(startValue) ||
    Number.isNaN(endValue)
  ) {
    return null;
  }
  return (Math.pow(endValue / startValue, 1 / n) - 1) * 100;
}
