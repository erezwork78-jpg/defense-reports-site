import { useEffect, useMemo, useState } from "react";
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
import baeBundled from "../../public/data/bae.json";
import { MetricsDataDisclaimer } from "../components/MetricsDataDisclaimer";
import { SiteNav } from "../components/SiteNav";

/** כש־fetch ל־/data/bae.json נכשל (file://, שרת בלי public), מציגים את העותק מהבילד */
const BAE_DATA_FALLBACK = baeBundled as IaiPayload;

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

export function BaeCompanyPage() {
  const [data, setData] = useState<IaiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** true אם לא הצלחנו לטעון מ־/data/bae.json ומשתמשים בעותק מהבילד */
  const [fromBundledFallback, setFromBundledFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/bae.json", { cache: "no-store" })
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
          setData(BAE_DATA_FALLBACK);
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
        <p className="badge">דוחות כספיים — BAE Systems</p>
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
          מוצגים נתונים מעותק מוטמע (לא נטען הקובץ <span className="file-path">/data/bae.json</span>).
          הרץ <code>npm run dev</code> מתוך תיקיית <code>website</code> או שרת סטטי שמגיש את תיקיית{" "}
          <code>dist</code> כולה — כדי לראות את הקובץ העדכני אחרי <code>npm run data:bae</code>.
        </div>
      )}

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
          <span className="file-path">public/data/bae-metrics.json</span> והרץ{" "}
          <code>npm run data:bae</code>.
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
                stroke="#f0ab43"
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

      <h2>מגמות: שנה מול שנה ולפי נושא</h2>
      <IaiBreakdownDemos metrics={data.metrics} />

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
                      stroke="#f0ab43"
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

      <MetricsDataDisclaimer slug="bae" />
    </>
  );
}
