import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IaiBreakdownDemos } from "../components/IaiBreakdownDemos";
import {
  backlogToRevenueRatio,
  ebitdaMarginPct,
  freeCashFlowMUSD,
  netMarginPct,
  ocfToNetIncomeRatio,
  operatingMarginPct,
  rdPctOfRevenue,
} from "../lib/iaiMetrics";
import { deriveAutoInsights } from "../lib/deriveAutoInsights";
import type { IaiPayload, MetricRow } from "../types/iai";
import iaiBundled from "../../public/data/iai.json";
import { SiteNav } from "../components/SiteNav";

/** כש־fetch ל־/data/iai.json נכשל (file://, שרת בלי public), מציגים את העותק מהבילד */
const IAI_DATA_FALLBACK = iaiBundled as IaiPayload;

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", {
    maximumFractionDigits: frac,
    minimumFractionDigits: frac,
  });
}

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} מ״ב`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} ק״ב`;
  return `${n} בתים`;
}

function hasAnyMetric(m: MetricRow): boolean {
  return (
    m.revenueMUSD != null ||
    m.backlogMUSD != null ||
    m.netIncomeMUSD != null ||
    m.operatingIncomeMUSD != null ||
    m.grossMarginPct != null ||
    m.operatingCashFlowMUSD != null ||
    m.ebitdaMUSD != null ||
    m.investingCashFlowMUSD != null ||
    m.financingCashFlowMUSD != null ||
    m.totalAssetsMUSD != null ||
    m.totalLiabilitiesMUSD != null ||
    m.equityMUSD != null ||
    m.capexMUSD != null ||
    m.researchDevelopmentMUSD != null ||
    m.marketingSalesMUSD != null ||
    m.generalAdminMUSD != null ||
    m.employees != null
  );
}

type ConversionCurveResult = {
  horizon: number;
  weights: number[];
  avgLagYears: number;
  fitRows: { year: number; actual: number; predicted: number }[];
  mapePct: number | null;
};

function evaluateCurveBest(metrics: MetricRow[], preferredHorizons: number[] = [4, 3, 2, 1]): ConversionCurveResult | null {
  for (const h of preferredHorizons) {
    const r = evaluateCurve(metrics, h);
    if (r) return r;
  }
  return null;
}

/** הסבר בעברית כשאין מודל — לפי אותם כללים כמו evaluateCurve */
function conversionModelBlockedReason(metrics: MetricRow[]): string {
  const implied = impliedOrders(metrics).filter((r) => Number.isFinite(r.revenue));
  const withOrders = implied.filter((r) => r.orders != null && !Number.isNaN(r.orders));
  const bits: string[] = [
    `שנים עם הכנסות במודל: ${implied.length}. שנים עם Orders משוער (צריך צבר שנה קודמת): ${withOrders.length}.`,
  ];
  for (const h of [4, 3, 2, 1]) {
    if (implied.length < h + 2) {
      bits.push(`אופק 0–${h}: דולג (צריך לפחות ${h + 2} שורות הכנסות, יש ${implied.length}).`);
      continue;
    }
    let fitCount = 0;
    for (let i = h; i < implied.length; i++) {
      let ok = true;
      for (let k = 0; k <= h; k++) {
        const o = implied[i - k].orders;
        if (o == null || Number.isNaN(o)) {
          ok = false;
          break;
        }
      }
      if (ok) fitCount++;
    }
    bits.push(`אופק 0–${h}: ${fitCount} נקודות התאמה אפשריות (נדרשות לפחות 2).`);
  }
  return bits.join(" ");
}

function impliedOrders(metrics: MetricRow[]): { year: number; revenue: number; orders: number | null }[] {
  const xs = [...metrics].sort((a, b) => a.year - b.year);
  return xs.map((m, i) => {
    const rev = m.revenueMUSD;
    if (rev == null || Number.isNaN(rev)) return { year: m.year, revenue: NaN, orders: null };
    if (i === 0) return { year: m.year, revenue: rev, orders: null };
    const prevBacklog = xs[i - 1].backlogMUSD;
    const curBacklog = m.backlogMUSD;
    if (prevBacklog == null || curBacklog == null || Number.isNaN(prevBacklog) || Number.isNaN(curBacklog)) {
      return { year: m.year, revenue: rev, orders: null };
    }
    return { year: m.year, revenue: rev, orders: rev + (curBacklog - prevBacklog) };
  });
}

function evaluateCurve(metrics: MetricRow[], horizon = 4): ConversionCurveResult | null {
  const rows = impliedOrders(metrics).filter((r) => Number.isFinite(r.revenue));
  // צריך לפחות 2 נקודות התאמה: len - horizon >= 2  => len >= horizon + 2
  if (rows.length < horizon + 2) return null;
  const step = 0.05;
  const units = Math.round(1 / step); // 20
  let best: { err: number; w: number[]; fit: { year: number; actual: number; predicted: number }[] } | null = null;

  const rec = (idx: number, remaining: number, acc: number[]) => {
    if (idx === horizon) {
      const w = [...acc, remaining].map((u) => u * step);
      const fit: { year: number; actual: number; predicted: number }[] = [];
      for (let i = horizon; i < rows.length; i++) {
        const cohort = [];
        let ok = true;
        for (let k = 0; k <= horizon; k++) {
          const o = rows[i - k].orders;
          if (o == null || Number.isNaN(o)) {
            ok = false;
            break;
          }
          cohort.push(o);
        }
        if (!ok) continue;
        const pred = cohort.reduce((s, o, k) => s + o * w[k], 0);
        fit.push({ year: rows[i].year, actual: rows[i].revenue, predicted: pred });
      }
      if (fit.length < 2) return;
      const mape = fit.reduce((s, r) => s + Math.abs((r.actual - r.predicted) / r.actual), 0) / fit.length;
      if (!best || mape < best.err) best = { err: mape, w, fit };
      return;
    }
    for (let u = 0; u <= remaining; u++) rec(idx + 1, remaining - u, [...acc, u]);
  };

  rec(0, units, []);
  if (!best) return null;
  const avgLag = best.w.reduce((s, x, i) => s + x * i, 0);
  return {
    horizon,
    weights: best.w,
    avgLagYears: avgLag,
    fitRows: best.fit,
    mapePct: best.err * 100,
  };
}

type ConversionForecastChartRow = {
  year: number;
  actual: number | null;
  /** מודל בשנים עם נתוני מכירות בפועל בלבד (לא ממשיך לשנות תחזית) */
  modelInSample: number | null;
  /** קו מקווקו: משנה אחרונה עם דוח ואילך עד סוף אופק התחזית (2026, 2027, …) */
  modelForecastBridge: number | null;
};

/** שורה לטבלת תחזית (בלי מכירות בפועל בדוח) */
type ConversionFutureTableRow = {
  year: number;
  revenuePredictedMUSD: number | null;
  /** O לשנה זו; לשנות עתיד — אקסטרפולציה לינארית מהשנים הקודמות */
  ordersImpliedMUSD: number | null;
};

type ConversionForecastPack = {
  /** שנת המכירות האחרונה שיש לה דוח (למשל 2025) */
  lastActualYear: number;
  /** שנת סוף התחזית (למשל 2027 כשמוסיפים שנה אחת קדימה) */
  forecastEndYear: number;
  forecastYear: number;
  forecastRevenueMUSD: number | null;
  extrapolatedOrdersMUSD: number | null;
  futureTableRows: ConversionFutureTableRow[];
  chartRows: ConversionForecastChartRow[];
};

function buildOrderMapFromImplied(rows: { year: number; orders: number | null }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r.orders != null && !Number.isNaN(r.orders)) m.set(r.year, r.orders);
  }
  return m;
}

/** מרחיב מפת Orders לשנים עתידיות: O_y ≈ 2·O_{y−1} − O_{y−2} */
function extendOrdersMapLinear(
  base: Map<number, number>,
  lastHistoricalYear: number,
  throughYear: number
): Map<number, number> {
  const m = new Map(base);
  for (let y = lastHistoricalYear + 1; y <= throughYear; y++) {
    const o1 = m.get(y - 1);
    const o0 = m.get(y - 2);
    if (o1 == null || o0 == null) break;
    m.set(y, 2 * o1 - o0);
  }
  return m;
}

function predictedRevenueFromOrderMap(
  targetYear: number,
  horizon: number,
  weights: number[],
  orders: Map<number, number>
): number | null {
  let s = 0;
  for (let k = 0; k <= horizon; k++) {
    const y = targetYear - k;
    const o = orders.get(y);
    if (o == null) return null;
    s += o * weights[k];
  }
  return s;
}

/** כמה שנות תחזית קדימה אחרי הדוח האחרון (למשל 2 ⇒ 2026 ו־2027 אחרי 2025) */
const CONVERSION_FORECAST_YEARS_AHEAD = 2;

function buildConversionForecast(metrics: MetricRow[], curve: ConversionCurveResult): ConversionForecastPack {
  const withRevenue = metrics.filter((m) => m.revenueMUSD != null && !Number.isNaN(m.revenueMUSD!));
  const maxYear =
    withRevenue.length > 0
      ? Math.max(...withRevenue.map((m) => m.year))
      : Math.max(...metrics.map((m) => m.year), curve.fitRows.at(-1)?.year ?? new Date().getFullYear());
  const forecastYear = maxYear + 1;
  const forecastEndYear = maxYear + CONVERSION_FORECAST_YEARS_AHEAD;

  const implied = impliedOrders(metrics);
  const orderMapHist = buildOrderMapFromImplied(implied);
  const ordersExtended = extendOrdersMapLinear(orderMapHist, maxYear, forecastEndYear);

  const revenueByYear = new Map<number, number>();
  for (const m of metrics) {
    if (m.revenueMUSD != null && !Number.isNaN(m.revenueMUSD)) revenueByYear.set(m.year, m.revenueMUSD);
  }

  const minYear = Math.min(...metrics.map((m) => m.year));
  const lastActualYear = maxYear;

  const chartRows: ConversionForecastPack["chartRows"] = [];
  for (let y = minYear; y <= forecastEndYear; y++) {
    const actual = revenueByYear.get(y) ?? null;
    const model = predictedRevenueFromOrderMap(y, curve.horizon, curve.weights, ordersExtended);
    const modelInSample = model != null && y <= lastActualYear ? model : null;
    const modelForecastBridge =
      model != null && y >= lastActualYear && y <= forecastEndYear ? model : null;
    chartRows.push({ year: y, actual, modelInSample, modelForecastBridge });
  }

  const futureTableRows: ConversionFutureTableRow[] = [];
  for (let y = forecastYear; y <= forecastEndYear; y++) {
    const o = ordersExtended.get(y) ?? null;
    const rev = predictedRevenueFromOrderMap(y, curve.horizon, curve.weights, ordersExtended);
    futureTableRows.push({
      year: y,
      revenuePredictedMUSD: rev,
      ordersImpliedMUSD: o,
    });
  }

  const forecastRevenueMUSD = futureTableRows[0]?.revenuePredictedMUSD ?? null;
  const extrapolatedOrdersMUSD = futureTableRows[0]?.ordersImpliedMUSD ?? null;

  return {
    lastActualYear,
    forecastEndYear,
    forecastYear,
    forecastRevenueMUSD,
    extrapolatedOrdersMUSD,
    futureTableRows,
    chartRows,
  };
}

/**
 * בלי ResponsiveContainer: ב-Recharts 2.x המצב ההתחלתי הוא width/height שליליים ואז chartContent=null;
 * אם ResizeObserver מחזיר רוחב 0 (layout/RTL/מיכל), הגרף נשאר ריק לצמיתות.
 * כאן רוחב וגובה מספריים קבועים + גלילה אופקית במסכים צרים.
 */
const CONVERSION_FORECAST_CHART_W = 920;
const CONVERSION_FORECAST_CHART_H = 320;

function ConversionForecastLineChart({
  rows,
  forecastRangeLabel,
}: {
  rows: ConversionForecastChartRow[];
  /** למשל "2026–2027" לכותרת בסרגל המקרא */
  forecastRangeLabel: string;
}) {
  return (
    <div
      className="conversion-forecast-chart__canvas"
      role="img"
      aria-label="גרף מכירות מול מודל ותחזית"
    >
      <LineChart
        width={CONVERSION_FORECAST_CHART_W}
        height={CONVERSION_FORECAST_CHART_H}
        data={rows}
        margin={{ top: 12, right: 16, left: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
        <YAxis
          tick={{ fill: "#9aa8bc" }}
          label={{
            value: "מיליון USD",
            angle: -90,
            position: "insideLeft",
            fill: "#9aa8bc",
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
          labelStyle={{ color: "#e8eef7" }}
          formatter={(value: number | undefined, name: string) =>
            value == null || Number.isNaN(value) ? ["—", name] : [fmtNum(value, 0), name]
          }
        />
        <Legend wrapperStyle={{ direction: "rtl" }} />
        <Line
          type="monotone"
          dataKey="actual"
          name="מכירות בפועל"
          stroke="#4f9eff"
          strokeWidth={2}
          connectNulls={false}
          dot
        />
        <Line
          type="monotone"
          dataKey="modelInSample"
          name="מודל (התאמה)"
          stroke="#e6a23c"
          strokeWidth={2}
          connectNulls
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="modelForecastBridge"
          name={`תחזית ${forecastRangeLabel} (מקווקו)`}
          stroke="#f0c674"
          strokeWidth={2}
          strokeDasharray="8 5"
          connectNulls
          dot={{ r: 4, strokeWidth: 2 }}
        />
      </LineChart>
    </div>
  );
}

export function IaiCompanyPage() {
  const [data, setData] = useState<IaiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** true אם לא הצלחנו לטעון מ־/data/iai.json ומשתמשים בעותק מהבילד */
  const [fromBundledFallback, setFromBundledFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/iai.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IaiPayload>;
      })
      .then((payload) => {
        if (!cancelled) {
          setErr(null);
          setFromBundledFallback(false);
          setData(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr(null);
          setFromBundledFallback(true);
          setData(IAI_DATA_FALLBACK);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartRows = useMemo(() => {
    if (!data) return [];
    return data.metrics.map((m) => ({
      year: m.year,
      revenue: m.revenueMUSD,
      backlog: m.backlogMUSD,
      netIncome: m.netIncomeMUSD,
      operatingIncome: m.operatingIncomeMUSD,
      ebitda: m.ebitdaMUSD,
      grossMarginPct: m.grossMarginPct,
      operatingMarginPct: operatingMarginPct(m.revenueMUSD, m.operatingIncomeMUSD),
      netMarginPct: netMarginPct(m.revenueMUSD, m.netIncomeMUSD),
      ebitdaMarginPct: ebitdaMarginPct(m.revenueMUSD, m.ebitdaMUSD),
    }));
  }, [data]);

  const cashFlowChartRows = useMemo(() => {
    if (!data) return [];
    return data.metrics.map((m) => ({
      year: m.year,
      operating: m.operatingCashFlowMUSD,
      investing: m.investingCashFlowMUSD,
      financing: m.financingCashFlowMUSD,
    }));
  }, [data]);

  const balanceChartRows = useMemo(() => {
    if (!data) return [];
    return data.metrics.map((m) => ({
      year: m.year,
      assets: m.totalAssetsMUSD,
      liabilities: m.totalLiabilitiesMUSD,
      equity: m.equityMUSD,
    }));
  }, [data]);

  const investChartRows = useMemo(() => {
    if (!data) return [];
    return data.metrics.map((m) => ({
      year: m.year,
      capex: m.capexMUSD,
      rd: m.researchDevelopmentMUSD,
      marketing: m.marketingSalesMUSD ?? null,
      generalAdmin: m.generalAdminMUSD ?? null,
    }));
  }, [data]);

  const cashQualityChartRows = useMemo(() => {
    if (!data) return [];
    return data.metrics.map((m) => ({
      year: m.year,
      fcf: freeCashFlowMUSD(m.operatingCashFlowMUSD, m.capexMUSD),
      ocfNi: ocfToNetIncomeRatio(m.operatingCashFlowMUSD, m.netIncomeMUSD),
    }));
  }, [data]);

  const cashFlowChartHasData = useMemo(() => {
    return cashFlowChartRows.some(
      (r) => r.operating != null || r.investing != null || r.financing != null
    );
  }, [cashFlowChartRows]);

  const balanceChartHasData = useMemo(() => {
    return balanceChartRows.some(
      (r) => r.assets != null || r.liabilities != null || r.equity != null
    );
  }, [balanceChartRows]);

  const investChartHasData = useMemo(() => {
    return investChartRows.some(
      (r) => r.capex != null || r.rd != null || r.marketing != null || r.generalAdmin != null
    );
  }, [investChartRows]);

  const cashQualityChartHasData = useMemo(() => {
    return cashQualityChartRows.some((r) => r.fcf != null || r.ocfNi != null);
  }, [cashQualityChartRows]);

  const segmentKeys = useMemo(() => {
    if (!data?.metrics.length) return [];
    const keys = new Set<string>();
    for (const m of data.metrics) {
      const s = m.revenueBySegmentMUSD;
      if (s && typeof s === "object") {
        for (const k of Object.keys(s)) keys.add(k);
      }
    }
    return [...keys].sort((a, b) => a.localeCompare(b, "he"));
  }, [data]);

  const chartHasData = useMemo(() => {
    return chartRows.some(
      (r) =>
        r.revenue != null ||
        r.backlog != null ||
        r.netIncome != null ||
        r.operatingIncome != null ||
        r.grossMarginPct != null ||
        r.operatingMarginPct != null ||
        r.netMarginPct != null ||
        r.ebitdaMarginPct != null ||
        r.ebitda != null
    );
  }, [chartRows]);

  const latest = useMemo(() => {
    if (!data?.metrics.length) return null;
    const withData = [...data.metrics].filter(hasAnyMetric).sort((a, b) => b.year - a.year);
    return withData[0] ?? null;
  }, [data]);

  const autoInsights = useMemo(() => {
    if (!data?.metrics.length) return [];
    return deriveAutoInsights(data.metrics);
  }, [data]);

  const conversionModel = useMemo(() => {
    if (!data?.metrics?.length) return null;
    const curve = evaluateCurveBest(data.metrics, [4, 3, 2, 1]);
    if (!curve) return null;
    return { curve, forecast: buildConversionForecast(data.metrics, curve) };
  }, [data]);

  if (err) {
    return (
      <div className="disclaimer">
        לא ניתן לטעון נתונים: {err}. ודא שהשרת מציג את תיקיית <code>public</code> (הרץ{" "}
        <code>npm run dev</code> מתוך <code>website</code>).
      </div>
    );
  }

  if (!data) {
    return <p className="muted">טוען נתונים…</p>;
  }

  return (
    <>
      <SiteNav />
      <header>
        <p className="badge">דוחות כספיים — תעשייה אווירית</p>
        <h1>{data.company.nameHe}</h1>
        <p className="muted" style={{ marginBottom: "0.25rem" }}>
          {data.company.nameEn}
        </p>
        <p className="muted">
          תיקיית דוחות במאגר:{" "}
          <span className="file-path">{data.company.reportsFolder}</span>
        </p>
        {data.generatedAt && (
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            עדכון רשימת קבצים: {data.generatedAt}
          </p>
        )}
      </header>

      {fromBundledFallback && (
        <div className="disclaimer" role="status">
          מוצגים נתונים מעותק מוטמע (לא נטען הקובץ <span className="file-path">/data/iai.json</span>).
          הרץ <code>npm run dev</code> מתוך תיקיית <code>website</code> או שרת סטטי שמגיש את תיקיית{" "}
          <code>dist</code> כולה — כדי לראות את הקובץ העדכני אחרי <code>npm run data:iai</code>.
        </div>
      )}

      <div className="disclaimer">
        הנתונים המספריים והתובנות הידניות נשמרים ב־
        <span className="file-path">public/data/iai-metrics.json</span> (מפתחות{" "}
        <code>rows</code>, <code>insights</code>) — הוראות בעמוד <strong>README</strong>{" "}
        בתיקיית האתר. רשימת הקבצים נוצרת עם <code>npm run data:iai</code>.
      </div>

      <h2>תקציר מספרי (לפי שנה אחרונה עם נתונים)</h2>
      {latest ? (
        <div className="card-grid">
          <div className="card">
            <div className="label">שנה</div>
            <div className="value">{latest.year}</div>
          </div>
          <div className="card">
            <div className="label">הכנסות (מיליון USD)</div>
            <div className="value">{fmtNum(latest.revenueMUSD)}</div>
          </div>
          <div className="card">
            <div className="label">מלאי הזמנות (מיליון USD)</div>
            <div className="value">{fmtNum(latest.backlogMUSD)}</div>
          </div>
          <div className="card">
            <div className="label">רווח נקי (מיליון USD)</div>
            <div className="value">{fmtNum(latest.netIncomeMUSD)}</div>
          </div>
          <div className="card">
            <div className="label">רווח תפעולי — EBIT (מיליון USD)</div>
            <div className="value">{fmtNum(latest.operatingIncomeMUSD)}</div>
          </div>
          <div className="card">
            <div className="label">רווח גולמי (% מההכנסות)</div>
            <div className="value">
              {latest.grossMarginPct != null
                ? `${fmtNum(latest.grossMarginPct, 1)}%`
                : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">רווח תפעולי ממכירות (%)</div>
            <div className="value">
              {operatingMarginPct(latest.revenueMUSD, latest.operatingIncomeMUSD) !=
              null
                ? `${fmtNum(
                    operatingMarginPct(
                      latest.revenueMUSD,
                      latest.operatingIncomeMUSD
                    )!,
                    2
                  )}%`
                : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">רווח נקי ממכירות (%)</div>
            <div className="value">
              {netMarginPct(latest.revenueMUSD, latest.netIncomeMUSD) != null
                ? `${fmtNum(netMarginPct(latest.revenueMUSD, latest.netIncomeMUSD)!, 2)}%`
                : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">יחס מלאי הזמנות להכנסות</div>
            <div className="value">
              {backlogToRevenueRatio(latest.backlogMUSD, latest.revenueMUSD) != null
                ? fmtNum(
                    backlogToRevenueRatio(latest.backlogMUSD, latest.revenueMUSD)!,
                    2
                  )
                : "—"}
            </div>
            <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
              מלאי הזמנות ÷ הכנסות שנתיות
            </p>
          </div>
          <div className="card">
            <div className="label">EBITDA (מיליון USD)</div>
            <div className="value">{fmtNum(latest.ebitdaMUSD)}</div>
            {ebitdaMarginPct(latest.revenueMUSD, latest.ebitdaMUSD) != null && (
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
                {fmtNum(ebitdaMarginPct(latest.revenueMUSD, latest.ebitdaMUSD)!, 1)}%
                ממכירות
              </p>
            )}
          </div>
          <div className="card">
            <div className="label">עובדים</div>
            <div className="value">{fmtNum(latest.employees, 0)}</div>
          </div>
        </div>
      ) : (
        <p className="muted">
          אין עדיין ערכים מספריים — ערוך את{" "}
          <span className="file-path">public/data/iai-metrics.json</span> והרץ{" "}
          <code>npm run data:iai</code>.
        </p>
      )}
      {latest ? (
        <>
          <h3 className="section-subh">תזרים, מאזן והשקעה (מיליון USD)</h3>
          <p className="muted small">
            נתונים מדוח תזרים, מאזן והערות (CapEx, מו״פ). ערכים שליליים בתזרים
            השקעה/מימון נפוצים — כפי שמדווח בדוח.
          </p>
          <div className="card-grid">
            <div className="card">
              <div className="label">תזרים תפעולי</div>
              <div className="value">{fmtNum(latest.operatingCashFlowMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">תזרים השקעה</div>
              <div className="value">{fmtNum(latest.investingCashFlowMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">תזרים מימון</div>
              <div className="value">{fmtNum(latest.financingCashFlowMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">תזרים חופשי (פשוט)</div>
              <div className="value">
                {fmtNum(freeCashFlowMUSD(latest.operatingCashFlowMUSD, latest.capexMUSD))}
              </div>
              <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                תזרים תפעולי − CapEx (מיליון USD)
              </p>
            </div>
            <div className="card">
              <div className="label">תזרים תפעולי ÷ רווח נקי</div>
              <div className="value">
                {ocfToNetIncomeRatio(latest.operatingCashFlowMUSD, latest.netIncomeMUSD) != null
                  ? fmtNum(
                      ocfToNetIncomeRatio(latest.operatingCashFlowMUSD, latest.netIncomeMUSD)!,
                      2
                    )
                  : "—"}
              </div>
              <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                המרת רווח לתזרים (יחס)
              </p>
            </div>
            <div className="card">
              <div className="label">סה״כ נכסים</div>
              <div className="value">{fmtNum(latest.totalAssetsMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">סה״כ התחייבויות</div>
              <div className="value">{fmtNum(latest.totalLiabilitiesMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">הון עצמי</div>
              <div className="value">{fmtNum(latest.equityMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">השקעות בקבועים (CapEx)</div>
              <div className="value">{fmtNum(latest.capexMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">מחקר ופיתוח</div>
              <div className="value">{fmtNum(latest.researchDevelopmentMUSD)}</div>
              {rdPctOfRevenue(latest.revenueMUSD, latest.researchDevelopmentMUSD) !=
                null && (
                <p className="muted" style={{ fontSize: "0.78rem", margin: "0.35rem 0 0" }}>
                  {fmtNum(
                    rdPctOfRevenue(latest.revenueMUSD, latest.researchDevelopmentMUSD)!,
                    2
                  )}
                  % מההכנסות
                </p>
              )}
            </div>
            <div className="card">
              <div className="label">מכירה ושיווק</div>
              <div className="value">{fmtNum(latest.marketingSalesMUSD)}</div>
            </div>
            <div className="card">
              <div className="label">הנהלה וכלליות</div>
              <div className="value">{fmtNum(latest.generalAdminMUSD)}</div>
            </div>
          </div>
        </>
      ) : null}

      <h2>תובנות</h2>
      <p className="muted">
        <strong>ניסוח ידני</strong> — מערך <code>insights</code> באותו קובץ JSON.{" "}
        <strong>אוטומטי</strong> — משפטים קצרים שנגזרים מהסדרה (CAGR הכנסות, שנה עם
        צמיחה חזקה בהכנסות, שינוי ברווח נקי ממכירות, מגמה ביחס מלאי להכנסות). אינו
        מחליף ניתוח מהדוחות המלאים.
      </p>
      {(data.insights && data.insights.length > 0) || autoInsights.length > 0 ? (
        <div className="insights-box">
          {data.insights && data.insights.length > 0 && (
            <>
              <h3 className="insights-subh">מהקובץ (עריכה ידנית)</h3>
              <ul className="insights-list">
                {data.insights.map((t, i) => (
                  <li key={`ins-manual-${i}`}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {autoInsights.length > 0 && (
            <>
              <h3 className="insights-subh">אוטומטי מהמספרים</h3>
              <ul className="insights-list insights-list--auto">
                {autoInsights.map((t, i) => (
                  <li key={`ins-auto-${i}`}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <p className="muted">
          אין תובנות ידניות; אין מספיק נתוני הכנסות לחישוב תובנות אוטומטיות.
        </p>
      )}

      <h2>ניסוי מודל: המרת התקשרויות למכירות</h2>
      <p className="muted">
        המודל מחשב תחילה התקשרויות משוערות לפי זהות צבר:{" "}
        <code>Orders_t = Revenue_t + (Backlog_t - Backlog_(t-1))</code>, ואז מתאים עקומת המרה רב־שנתית
        (0–4 שנים; ואם אין מספיק עומק היסטורי המודל יורד אוטומטית ל־0–3 או 0–2) כך שסכום המשקלים = 100%.
      </p>
      <p className="muted small" style={{ marginTop: "-0.35rem" }}>
        <strong>הערה:</strong> גרף המודל והתחזית מוצגים רק בדף זה (תע״א), לא בדפי אלביט/רפא״ל.
      </p>
      {conversionModel ? (
        <>
          <div className="card-grid">
            <div className="card">
              <div className="label">אופק עקומה בפועל</div>
              <div className="value">0–{conversionModel.curve.horizon}</div>
            </div>
            <div className="card">
              <div className="label">זמן המרה ממוצע</div>
              <div className="value">{fmtNum(conversionModel.curve.avgLagYears, 2)} שנים</div>
            </div>
            <div className="card">
              <div className="label">שגיאת התאמה (MAPE)</div>
              <div className="value">
                {conversionModel.curve.mapePct != null ? `${fmtNum(conversionModel.curve.mapePct, 1)}%` : "—"}
              </div>
            </div>
            {conversionModel.curve.weights.map((w, i) => (
              <div className="card" key={`w-${i}`}>
                <div className="label">שנה {i}</div>
                <div className="value">{fmtNum(w * 100, 1)}%</div>
                <p className="muted" style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}>
                  חלק מהתקשרויות שמוכר כמכירות אחרי {i} שנים
                </p>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginBottom: "0.75rem" }}>
            <strong>הבדלה חשובה:</strong> הטבלה הראשונה מציגה שנים שכבר דווחו בדוח — זו{" "}
            <em>התאמת המודל בדגימה</em> (בפועל מול מה שהמודל היה נותן באותה שנה). הטבלה השנייה והגרף מציגים{" "}
            <em>תחזית</em> לשנים שעדיין אין להן דוח מכירות ({conversionModel.forecast.forecastYear}–
            {conversionModel.forecast.forecastEndYear}): שם אין עמודת «בפועל».
          </p>
          <h3 className="section-subh">התאמת המודל בדגימה (שנים שדווחו בדוח)</h3>
          <p className="muted small" style={{ marginBottom: "0.5rem" }}>
            רק שנים שיש בהן מספיק היסטוריית Orders להרצת המשקלים; «מכירות חזויות» כאן אינן תחזית עתידית אלא חישוב
            לאחור/במקביל לדיווח.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>שנה</th>
                  <th>מכירות בפועל (MUSD)</th>
                  <th>חזוי מודל באותה שנה (MUSD)</th>
                  <th>סטייה %</th>
                </tr>
              </thead>
              <tbody>
                {conversionModel.curve.fitRows.map((r) => {
                  const d = r.actual !== 0 ? ((r.predicted - r.actual) / r.actual) * 100 : null;
                  return (
                    <tr key={`fit-${r.year}`}>
                      <td>{r.year}</td>
                      <td>{fmtNum(r.actual, 0)}</td>
                      <td>{fmtNum(r.predicted, 0)}</td>
                      <td>{d != null ? `${fmtNum(d, 1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 className="section-subh">
            תחזית מכירות (אין עדיין דוח בפועל) — {conversionModel.forecast.forecastYear}–
            {conversionModel.forecast.forecastEndYear}
          </h3>
          <p className="muted small" style={{ marginBottom: "0.5rem" }}>
            לכל שנה עתידית משלימים <code>Orders</code> באקסטרפולציה לינארית מהשתי שנים הקודמות:{" "}
            <code>O<sub>y</sub> ≈ 2·O<sub>y−1</sub> − O<sub>y−2</sub></code>, ואז הכנסות חזויות כ־
            <code>Σ w<sub>k</sub>·O<sub>שנה−k</sub></code>. ככל שמתרחקים קדימה האקסטרפולציה רועשת יותר. ניסוי הסברתי
            בלבד.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>שנה</th>
                  <th>מכירות בפועל</th>
                  <th>הכנסות חזויות (MUSD)</th>
                  <th>Orders משוער (MUSD)</th>
                </tr>
              </thead>
              <tbody>
                {conversionModel.forecast.futureTableRows.map((r) => (
                  <tr key={`fut-${r.year}`}>
                    <td>{r.year}</td>
                    <td className="muted">— (אין דוח)</td>
                    <td>{fmtNum(r.revenuePredictedMUSD, 0)}</td>
                    <td>{fmtNum(r.ordersImpliedMUSD, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-grid" style={{ marginBottom: "0.75rem" }}>
            {conversionModel.forecast.futureTableRows.map((r) => (
              <Fragment key={`fcard-${r.year}`}>
                <div className="card">
                  <div className="label">הכנסות חזויות {r.year}</div>
                  <div className="value">
                    {r.revenuePredictedMUSD != null
                      ? `${fmtNum(r.revenuePredictedMUSD, 0)} מ״ד $`
                      : "—"}
                  </div>
                </div>
                <div className="card">
                  <div className="label">Orders משוער {r.year}</div>
                  <div className="value">{fmtNum(r.ordersImpliedMUSD, 0)} מ״ד $</div>
                </div>
              </Fragment>
            ))}
          </div>
          <div className="conversion-forecast-chart conversion-forecast-chart--block">
            <h3 className="section-subh">
              גרף: בפועל, התאמה ותחזית {conversionModel.forecast.forecastYear}–
              {conversionModel.forecast.forecastEndYear}
            </h3>
            <p className="muted small" style={{ marginBottom: "0.5rem" }}>
              קו כתום — חזוי המודל בשנים שיש בהן דוח מכירות; קו צהוב מקווקו — אותו מודל על טווח התחזית (מ־
              {conversionModel.forecast.lastActualYear} ואילך). גם בלי גרף, המספרים מופיעים בטבלת התחזית למעלה.
            </p>
            <ConversionForecastLineChart
              rows={conversionModel.forecast.chartRows}
              forecastRangeLabel={`${conversionModel.forecast.forecastYear}–${conversionModel.forecast.forecastEndYear}`}
            />
          </div>
          <div className="insights-box">
            <h3 className="insights-subh">הנחות עבודה של המודל</h3>
            <ul className="insights-list">
              <li>מודל אגרגטיבי ברמת חברה-שנה (לא ברמת חוזה בודד), ולכן הוא מאקרו ולא תחליף ל-PMO.</li>
              <li>התקשרויות נגזרות בעקיפין מהצבר; שינויים חשבונאיים/שערי מטבע יכולים להשפיע על האמידה.</li>
              <li>העקומה מותאמת בחיפוש דיסקרטי (צעדי 5%) כדי לשמור על פרשנות יציבה ופשוטה.</li>
              <li>ה-MAPE נמדד על השנים שבהן יש נתונים מלאים לדלילי העקומה שנבחרו.</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="insights-box" role="status">
          <p className="muted" style={{ marginBottom: "0.5rem" }}>
            אין מספיק נתונים כדי לאמוד עקומת המרה (או שחסר צבר/הכנסות בחלק מהשנים).
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            <strong>פירוט:</strong> {conversionModelBlockedReason(data.metrics)}
          </p>
        </div>
      )}

      <h2>מגמות לאורך שנים</h2>
      <p className="muted">{data.currencyNote}</p>
      {chartHasData ? (
        <div className="chart-wrap chart-wrap--tall">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#9aa8bc" }}
                label={{
                  value: "מיליון USD",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#9aa8bc",
                  fontSize: 11,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#9aa8bc" }}
                label={{
                  value: "%",
                  angle: 90,
                  position: "insideRight",
                  fill: "#9aa8bc",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                labelStyle={{ color: "#e8eef7" }}
                formatter={(
                  value: number | undefined,
                  name: string,
                  item: { dataKey?: string }
                ) => {
                  if (value == null || Number.isNaN(value)) return ["—", name];
                  if (
                    item?.dataKey === "grossMarginPct" ||
                    item?.dataKey === "operatingMarginPct" ||
                    item?.dataKey === "netMarginPct" ||
                    item?.dataKey === "ebitdaMarginPct"
                  ) {
                    return [`${fmtNum(value, 2)}%`, name];
                  }
                  return [fmtNum(value, 1), name];
                }}
              />
              <Legend wrapperStyle={{ direction: "rtl" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="הכנסות (מיליון USD)"
                stroke="#4f9eff"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="backlog"
                name="מלאי הזמנות (מיליון USD)"
                stroke="#3dd6c3"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="netIncome"
                name="רווח נקי (מיליון USD)"
                stroke="#f0c674"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="operatingIncome"
                name="רווח תפעולי (מיליון USD)"
                stroke="#c792ea"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ebitda"
                name="EBITDA (מיליון USD)"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="grossMarginPct"
                name="רווח גולמי (% מההכנסות)"
                stroke="#82aaff"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="operatingMarginPct"
                name="רווח תפעולי ממכירות (%)"
                stroke="#e6b35c"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="netMarginPct"
                name="רווח נקי ממכירות (%)"
                stroke="#ff9f6e"
                strokeWidth={2}
                strokeDasharray="3 2"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ebitdaMarginPct"
                name="EBITDA ממכירות (%)"
                stroke="#d4a5ff"
                strokeWidth={2}
                strokeDasharray="2 2"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted">אין עדיין נקודות לגרף — מלא ערכים בקובץ המטריקות.</p>
      )}

      {(cashFlowChartHasData ||
        balanceChartHasData ||
        investChartHasData ||
        cashQualityChartHasData) && (
        <>
          <h3 className="section-subh">מגמות: תזרים, מאזן והשקעה</h3>
          <p className="muted small">
            כל הערכים במיליון USD. תזרים השקעה ומימון לעיתים שליליים לפי דיווח.
          </p>
          {cashFlowChartHasData && (
            <>
              <h4 className="chart-section-title">תזרים מזומנים</h4>
              <div className="chart-wrap chart-wrap--medium">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={cashFlowChartRows}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                    <YAxis tick={{ fill: "#9aa8bc" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a2332",
                        border: "1px solid #334155",
                      }}
                      formatter={(v: number) => fmtNum(v, 0)}
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                    <Line
                      type="monotone"
                      dataKey="operating"
                      name="תזרים תפעולי"
                      stroke="#f78c6c"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="investing"
                      name="תזרים השקעה"
                      stroke="#5cb87a"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="financing"
                      name="תזרים מימון"
                      stroke="#6b9fe8"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {cashQualityChartHasData && (
            <>
              <h4 className="chart-section-title">איכות תזרים: חופשי מול המרה לרווח</h4>
              <p className="muted small">
                שמאל: תזרים חופשי פשוט (תפעולי − CapEx). ימין: יחס תזרים תפעולי לרווח נקי.
              </p>
              <div className="chart-wrap chart-wrap--medium">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={cashQualityChartRows}
                    margin={{ top: 8, right: 14, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#9aa8bc" }}
                      label={{
                        value: "מיליון USD",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9aa8bc",
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#9aa8bc" }}
                      label={{
                        value: "יחס",
                        angle: 90,
                        position: "insideRight",
                        fill: "#9aa8bc",
                        fontSize: 10,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1a2332",
                        border: "1px solid #334155",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "תפעולי÷רווח נקי") return [fmtNum(value, 2), name];
                        return [fmtNum(value, 0), name];
                      }}
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="fcf"
                      name="תזרים חופשי (פשוט)"
                      stroke="#7ee3d6"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ocfNi"
                      name="תפעולי÷רווח נקי"
                      stroke="#f0c674"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {balanceChartHasData && (
            <>
              <h4 className="chart-section-title">מאזן</h4>
              <div className="chart-wrap chart-wrap--medium">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={balanceChartRows}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                    <YAxis tick={{ fill: "#9aa8bc" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a2332",
                        border: "1px solid #334155",
                      }}
                      formatter={(v: number) => fmtNum(v, 0)}
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                    <Line
                      type="monotone"
                      dataKey="assets"
                      name="סה״כ נכסים"
                      stroke="#4f9eff"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="liabilities"
                      name="סה״כ התחייבויות"
                      stroke="#f0c674"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      name="הון עצמי"
                      stroke="#3dd6c3"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {investChartHasData && (
            <>
              <h4 className="chart-section-title">השקעה והוצאות תפעוליות נבחרות</h4>
              <div className="chart-wrap chart-wrap--medium">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={investChartRows}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                    <YAxis tick={{ fill: "#9aa8bc" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a2332",
                        border: "1px solid #334155",
                      }}
                      formatter={(v: number) => fmtNum(v, 0)}
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                    <Line
                      type="monotone"
                      dataKey="capex"
                      name="השקעות בקבועים (CapEx)"
                      stroke="#c792ea"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="rd"
                      name="מחקר ופיתוח"
                      stroke="#e6b35c"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="marketing"
                      name="מכירה ושיווק"
                      stroke="#4f9eff"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="generalAdmin"
                      name="הנהלה וכלליות"
                      stroke="#f07178"
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      <h2>טבלת נתונים לפי שנה</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>שנה</th>
              <th>הכנסות</th>
              <th>מלאי הזמנות</th>
              <th>מלאי÷הכנסות</th>
              <th>רווח נקי</th>
              <th>רווח נקי ממכירות %</th>
              <th>רווח תפעולי</th>
              <th>EBITDA</th>
              <th>EBITDA ממכירות %</th>
              <th>רווח גולמי %</th>
              <th>רווח תפעולי ממכירות %</th>
              <th>תזרים תפעולי</th>
              <th>תזרים חופשי (פשוט)</th>
              <th>תפעולי÷רווח נקי</th>
              <th>תזרים השקעה</th>
              <th>תזרים מימון</th>
              <th>נכסים</th>
              <th>התחייבויות</th>
              <th>הון</th>
              <th>CapEx</th>
              <th>מו״פ</th>
              <th>מכירה ושיווק</th>
              <th>הנהלה וכלליות</th>
              <th>מו״פ %הכנסות</th>
              <th>עובדים</th>
              <th>הערה</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((m) => (
              <tr key={m.year}>
                <td>{m.year}</td>
                <td>{fmtNum(m.revenueMUSD)}</td>
                <td>{fmtNum(m.backlogMUSD)}</td>
                <td>
                  {backlogToRevenueRatio(m.backlogMUSD, m.revenueMUSD) != null
                    ? fmtNum(
                        backlogToRevenueRatio(m.backlogMUSD, m.revenueMUSD)!,
                        2
                      )
                    : "—"}
                </td>
                <td>{fmtNum(m.netIncomeMUSD)}</td>
                <td>
                  {netMarginPct(m.revenueMUSD, m.netIncomeMUSD) != null
                    ? `${fmtNum(netMarginPct(m.revenueMUSD, m.netIncomeMUSD)!, 2)}%`
                    : "—"}
                </td>
                <td>{fmtNum(m.operatingIncomeMUSD)}</td>
                <td>{fmtNum(m.ebitdaMUSD)}</td>
                <td>
                  {ebitdaMarginPct(m.revenueMUSD, m.ebitdaMUSD) != null
                    ? `${fmtNum(ebitdaMarginPct(m.revenueMUSD, m.ebitdaMUSD)!, 2)}%`
                    : "—"}
                </td>
                <td>
                  {m.grossMarginPct != null ? `${fmtNum(m.grossMarginPct, 1)}%` : "—"}
                </td>
                <td>
                  {operatingMarginPct(m.revenueMUSD, m.operatingIncomeMUSD) != null
                    ? `${fmtNum(
                        operatingMarginPct(m.revenueMUSD, m.operatingIncomeMUSD)!,
                        2
                      )}%`
                    : "—"}
                </td>
                <td>{fmtNum(m.operatingCashFlowMUSD)}</td>
                <td>{fmtNum(freeCashFlowMUSD(m.operatingCashFlowMUSD, m.capexMUSD))}</td>
                <td>
                  {ocfToNetIncomeRatio(m.operatingCashFlowMUSD, m.netIncomeMUSD) != null
                    ? fmtNum(ocfToNetIncomeRatio(m.operatingCashFlowMUSD, m.netIncomeMUSD)!, 2)
                    : "—"}
                </td>
                <td>{fmtNum(m.investingCashFlowMUSD)}</td>
                <td>{fmtNum(m.financingCashFlowMUSD)}</td>
                <td>{fmtNum(m.totalAssetsMUSD)}</td>
                <td>{fmtNum(m.totalLiabilitiesMUSD)}</td>
                <td>{fmtNum(m.equityMUSD)}</td>
                <td>{fmtNum(m.capexMUSD)}</td>
                <td>{fmtNum(m.researchDevelopmentMUSD)}</td>
                <td>{fmtNum(m.marketingSalesMUSD)}</td>
                <td>{fmtNum(m.generalAdminMUSD)}</td>
                <td>
                  {rdPctOfRevenue(m.revenueMUSD, m.researchDevelopmentMUSD) != null
                    ? `${fmtNum(
                        rdPctOfRevenue(m.revenueMUSD, m.researchDevelopmentMUSD)!,
                        2
                      )}%`
                    : "—"}
                </td>
                <td>{fmtNum(m.employees, 0)}</td>
                <td className="muted" style={{ fontSize: "0.85rem" }}>
                  {m.notes ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {segmentKeys.length > 0 && (
        <>
          <h2>פילוח הכנסות לפי מגזר (מיליון USD)</h2>
          <p className="muted small">
            נתונים מ־<code className="file-path">revenueBySegmentMUSD</code> בקובץ המטריקות. מפתחות העמודות
            תואמים לשמות בדוח (או slug יציב שהגדרתם).
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>שנה</th>
                  {segmentKeys.map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => (
                  <tr key={m.year}>
                    <td>{m.year}</td>
                    {segmentKeys.map((k) => (
                      <td key={k}>{fmtNum(m.revenueBySegmentMUSD?.[k] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>מגמות: שנה מול שנה ולפי נושא</h2>
      <IaiBreakdownDemos metrics={data.metrics} />

      <h2>קבצי דוח בתיקייה</h2>
      <p className="muted">
        הנתיבים המלאים יחסית לתיקיית <strong>דוחות כספיים</strong> (לא מוטמעים בדפדפן).
      </p>
      <table>
        <thead>
          <tr>
            <th>קובץ</th>
            <th>שנים בשם</th>
            <th>גודל</th>
          </tr>
        </thead>
        <tbody>
          {data.files.map((f) => (
            <tr key={f.fileName}>
              <td>
                <div className="file-path">
                  {data.company.reportsFolder}/{f.fileName}
                </div>
              </td>
              <td>{f.yearsInName.length ? f.yearsInName.join(", ") : "—"}</td>
              <td>{fmtBytes(f.sizeBytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
