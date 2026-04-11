import {
  backlogToRevenueRatio,
  cagrAnnualPct,
  freeCashFlowMUSD,
  netMarginPct,
  ocfToNetIncomeRatio,
  rowsWithRevenue,
} from "./iaiMetrics";
import type { MetricRow } from "../types/iai";

/**
 * משפטים קצרים שנגזרים אוטומטית מסדרת השנים (ללא ניתוח איכותני מדוחות).
 */
export function deriveAutoInsights(metrics: MetricRow[]): string[] {
  const r = rowsWithRevenue(metrics);
  const out: string[] = [];
  if (r.length < 2) return out;

  const first = r[0];
  const last = r[r.length - 1];

  if (
    first.revenueMUSD != null &&
    last.revenueMUSD != null &&
    first.revenueMUSD > 0 &&
    last.revenueMUSD > 0
  ) {
    const c = cagrAnnualPct(
      first.revenueMUSD,
      last.revenueMUSD,
      first.year,
      last.year
    );
    if (c != null) {
      out.push(
        `בין ${first.year} ל־${last.year} הכנסות צמחו בממוצע של כ־${c.toFixed(1)}% לשנה (CAGR).`
      );
    }
  }

  let maxYoy = -Infinity;
  let maxYear: number | null = null;
  for (let i = 1; i < r.length; i++) {
    const prev = r[i - 1].revenueMUSD;
    const cur = r[i].revenueMUSD;
    if (prev != null && cur != null && prev > 0) {
      const yoy = ((cur - prev) / prev) * 100;
      if (yoy > maxYoy) {
        maxYoy = yoy;
        maxYear = r[i].year;
      }
    }
  }
  if (maxYear != null && Number.isFinite(maxYoy) && maxYoy > -80 && maxYoy < 300) {
    out.push(
      `שיא צמיחה שנתית בהכנסות (מול השנה שקדמה לה): ${maxYear} (כ־${maxYoy.toFixed(1)}%).`
    );
  }

  const nmFirst = netMarginPct(first.revenueMUSD, first.netIncomeMUSD);
  const nmLast = netMarginPct(last.revenueMUSD, last.netIncomeMUSD);
  if (nmFirst != null && nmLast != null) {
    const d = nmLast - nmFirst;
    if (Math.abs(d) >= 0.25) {
      out.push(
        `רווח נקי ממכירות ${d > 0 ? "עלה" : "ירד"} בכ־${Math.abs(d).toFixed(1)} נקודות אחוז בין ${first.year} ל־${last.year}.`
      );
    }
  }

  const brFirst = backlogToRevenueRatio(first.backlogMUSD, first.revenueMUSD);
  const brLast = backlogToRevenueRatio(last.backlogMUSD, last.revenueMUSD);
  if (
    brFirst != null &&
    brLast != null &&
    Math.abs(brLast - brFirst) >= 0.04
  ) {
    out.push(
      `יחס מלאי הזמנות להכנסות ${brLast > brFirst ? "התחזק" : "התמתן"} (מ־${brFirst.toFixed(2)} ל־${brLast.toFixed(2)}).`
    );
  }

  const ocfNiFirst = ocfToNetIncomeRatio(first.operatingCashFlowMUSD, first.netIncomeMUSD);
  const ocfNiLast = ocfToNetIncomeRatio(last.operatingCashFlowMUSD, last.netIncomeMUSD);
  if (ocfNiFirst != null && ocfNiLast != null && Math.abs(ocfNiLast - ocfNiFirst) >= 0.35) {
    out.push(
      `יחס תזרים תפעולי לרווח נקי ${ocfNiLast > ocfNiFirst ? "עלה" : "ירד"} מ־${ocfNiFirst.toFixed(2)} ל־${ocfNiLast.toFixed(2)} בין ${first.year} ל־${last.year} — משקף כמה המזומן מהפעילות עומד ביחס לרווח המדווח.`
    );
  }

  const fcfFirst = freeCashFlowMUSD(first.operatingCashFlowMUSD, first.capexMUSD);
  const fcfLast = freeCashFlowMUSD(last.operatingCashFlowMUSD, last.capexMUSD);
  if (
    fcfFirst != null &&
    fcfLast != null &&
    fcfFirst < 0 &&
    fcfLast > 0 &&
    fcfLast > fcfFirst + 50
  ) {
    out.push(
      `תזרים חופשי פשוט (תפעולי פחות CapEx) השתפר מכ־${Math.round(fcfFirst)} לכ־${Math.round(fcfLast)} מיליון $ בין ${first.year} ל־${last.year}.`
    );
  } else if (
    fcfFirst != null &&
    fcfLast != null &&
    fcfFirst > 100 &&
    fcfLast < fcfFirst - 100 &&
    fcfLast < fcfFirst * 0.55
  ) {
    out.push(
      `תזרים חופשי פשוט ירד בצורה משמעותית מכ־${Math.round(fcfFirst)} לכ־${Math.round(fcfLast)} מיליון $ בין ${first.year} ל־${last.year} — שווה לבדוק השקעות בקבועים ותזרים תפעולי.`
    );
  }

  return out.slice(0, 8);
}
