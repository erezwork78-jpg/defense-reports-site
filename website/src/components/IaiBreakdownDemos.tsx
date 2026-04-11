import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  backlogToRevenueRatio,
  cagrAnnualPct,
  ebitdaMarginPct,
  freeCashFlowMUSD,
  netMarginPct,
  ocfToNetIncomeRatio,
  operatingMarginPct,
  rdPctOfRevenue,
  rowsWithRevenue,
} from "../lib/iaiMetrics";
import type { MetricRow } from "../types/iai";

type DemoTab = "yoy" | "trends";

const TAB_LABELS: Record<DemoTab, string> = {
  yoy: "שנה מול שנה",
  trends: "מגמות לפי נושא",
};

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", {
    maximumFractionDigits: frac,
    minimumFractionDigits: frac,
  });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%`;
}

function cagrFromPoints(
  points: { year: number; v: number | null }[]
): number | null {
  const valid = points.filter((p) => p.v != null && !Number.isNaN(p.v!));
  if (valid.length < 2) return null;
  const a = valid[0];
  const b = valid[valid.length - 1];
  return cagrAnnualPct(a.v!, b.v!, a.year, b.year);
}

function buildYoy(
  metrics: MetricRow[],
  get: (m: MetricRow) => number | null
): { year: number; value: number; yoyPct: number | null }[] {
  const r = [...metrics]
    .filter((m) => get(m) != null && !Number.isNaN(get(m)!))
    .sort((a, b) => a.year - b.year);
  return r.map((m, i) => {
    const val = get(m)!;
    const prev = i > 0 ? get(r[i - 1]) : null;
    const yoy =
      prev != null && prev !== 0 ? ((val - prev) / Math.abs(prev)) * 100 : null;
    return { year: m.year, value: val, yoyPct: yoy };
  });
}

type TrendDef = {
  id: string;
  title: string;
  unit: string;
  color: string;
  points: { year: number; v: number | null }[];
  fmt: "num" | "pct" | "ratio";
  /** CAGR בין השנה הראשונה והאחרונה בטווח (כשהערכים חיוביים) */
  cagr: number | null;
};

function buildTrendPanels(metrics: MetricRow[]): TrendDef[] {
  const r = rowsWithRevenue(metrics);
  const years = r.map((x) => x.year);

  const series = (
    label: string,
    unit: string,
    color: string,
    vals: (number | null)[],
    fmt: "num" | "pct" | "ratio"
  ): TrendDef | null => {
    const points = years.map((year, i) => ({ year, v: vals[i] ?? null }));
    if (!points.some((p) => p.v != null)) return null;
    return {
      id: label,
      title: label,
      unit,
      color,
      points,
      fmt,
      cagr: cagrFromPoints(points),
    };
  };

  const out: TrendDef[] = [];
  const push = (t: TrendDef | null) => {
    if (t) out.push(t);
  };

  push(
    series("הכנסות", "מיליון USD", "#4f9eff", r.map((m) => m.revenueMUSD), "num")
  );
  push(
    series(
      "מלאי הזמנות",
      "מיליון USD",
      "#3dd6c3",
      r.map((m) => m.backlogMUSD),
      "num"
    )
  );
  push(
    series(
      "רווח תפעולי (EBIT)",
      "מיליון USD",
      "#c792ea",
      r.map((m) => m.operatingIncomeMUSD),
      "num"
    )
  );
  push(
    series(
      "רווח תפעולי ממכירות",
      "%",
      "#e6b35c",
      r.map((m) => operatingMarginPct(m.revenueMUSD, m.operatingIncomeMUSD)),
      "pct"
    )
  );
  push(
    series(
      "רווח גולמי",
      "% מההכנסות",
      "#82aaff",
      r.map((m) => m.grossMarginPct),
      "pct"
    )
  );
  push(
    series(
      "רווח נקי",
      "מיליון USD",
      "#f0c674",
      r.map((m) => m.netIncomeMUSD),
      "num"
    )
  );
  push(
    series(
      "רווח נקי ממכירות",
      "%",
      "#ff9f6e",
      r.map((m) => netMarginPct(m.revenueMUSD, m.netIncomeMUSD)),
      "pct"
    )
  );
  push(
    series(
      "יחס מלאי הזמנות להכנסות",
      "מלאי ÷ הכנסות",
      "#9cdcfe",
      r.map((m) => backlogToRevenueRatio(m.backlogMUSD, m.revenueMUSD)),
      "ratio"
    )
  );
  push(
    series(
      "EBITDA",
      "מיליון USD",
      "#a78bfa",
      r.map((m) => m.ebitdaMUSD),
      "num"
    )
  );
  push(
    series(
      "EBITDA ממכירות",
      "%",
      "#d4a5ff",
      r.map((m) => ebitdaMarginPct(m.revenueMUSD, m.ebitdaMUSD)),
      "pct"
    )
  );
  push(
    series(
      "תזרים מזומנים תפעולי",
      "מיליון USD",
      "#f78c6c",
      r.map((m) => m.operatingCashFlowMUSD),
      "num"
    )
  );
  push(
    series(
      "תזרים השקעה",
      "מיליון USD",
      "#5cb87a",
      r.map((m) => m.investingCashFlowMUSD),
      "num"
    )
  );
  push(
    series(
      "תזרים מימון",
      "מיליון USD",
      "#6b9fe8",
      r.map((m) => m.financingCashFlowMUSD),
      "num"
    )
  );
  push(
    series(
      "סה״כ נכסים",
      "מיליון USD",
      "#7eb8ff",
      r.map((m) => m.totalAssetsMUSD),
      "num"
    )
  );
  push(
    series(
      "סה״כ התחייבויות",
      "מיליון USD",
      "#ffd88a",
      r.map((m) => m.totalLiabilitiesMUSD),
      "num"
    )
  );
  push(
    series(
      "הון עצמי",
      "מיליון USD",
      "#5ee0c5",
      r.map((m) => m.equityMUSD),
      "num"
    )
  );
  push(
    series(
      "השקעות בקבועים (CapEx)",
      "מיליון USD",
      "#c792ea",
      r.map((m) => m.capexMUSD),
      "num"
    )
  );
  push(
    series(
      "מחקר ופיתוח",
      "מיליון USD",
      "#e6b35c",
      r.map((m) => m.researchDevelopmentMUSD),
      "num"
    )
  );
  push(
    series(
      "מו״פ % מההכנסות",
      "%",
      "#ddb07f",
      r.map((m) => rdPctOfRevenue(m.revenueMUSD, m.researchDevelopmentMUSD)),
      "pct"
    )
  );
  push(
    series(
      "מכירה ושיווק",
      "מיליון USD",
      "#4f9eff",
      r.map((m) => m.marketingSalesMUSD ?? null),
      "num"
    )
  );
  push(
    series(
      "הנהלה וכלליות",
      "מיליון USD",
      "#f07178",
      r.map((m) => m.generalAdminMUSD ?? null),
      "num"
    )
  );
  push(
    series(
      "תזרים חופשי (פשוט)",
      "מיליון USD",
      "#7ee3d6",
      r.map((m) => freeCashFlowMUSD(m.operatingCashFlowMUSD, m.capexMUSD)),
      "num"
    )
  );
  push(
    series(
      "תזרים תפעולי ÷ רווח נקי",
      "יחס",
      "#f0c674",
      r.map((m) => ocfToNetIncomeRatio(m.operatingCashFlowMUSD, m.netIncomeMUSD)),
      "ratio"
    )
  );

  return out;
}

function yoyCagr(data: { year: number; value: number }[]): number | null {
  if (data.length < 2) return null;
  return cagrAnnualPct(
    data[0].value,
    data[data.length - 1].value,
    data[0].year,
    data[data.length - 1].year
  );
}

function YoyCombo({
  title,
  data,
  valueLabel,
  barName,
  lineName,
  barColor,
}: {
  title: string;
  data: { year: number; value: number; yoyPct: number | null }[];
  valueLabel: string;
  barName: string;
  lineName: string;
  barColor: string;
}) {
  if (data.length === 0) {
    return (
      <div className="yoy-block">
        <h3 className="yoy-block__title">{title}</h3>
        <p className="muted small">אין נתונים מספיקים.</p>
      </div>
    );
  }
  const cagr = yoyCagr(data);
  const chartData = data.map((d) => ({
    year: d.year,
    value: d.value,
    yoyPct: d.yoyPct,
  }));
  const isValuePct = valueLabel === "%";
  const isValueRatio = valueLabel === "יחס";
  const fmtBarLabel = (v: number) => {
    if (isValuePct) return fmtPct(v);
    if (isValueRatio) return fmtNum(v, 2);
    return fmtNum(v, 0);
  };
  const fmtYoyLabel = (v: number | undefined) =>
    v != null && !Number.isNaN(v) ? fmtPct(v) : "";
  return (
    <div className="yoy-block">
      <div className="yoy-block__head">
        <h3 className="yoy-block__title">{title}</h3>
        {cagr != null && (
          <span
            className="yoy-block__cagr"
            title="CAGR — שיעור צמיחה שנתי ממוצע בין השנה הראשונה והאחרונה בטווח (לפי ערכי העמודות)"
          >
            CAGR: {fmtNum(cagr, 1)}%
          </span>
        )}
      </div>
      <div className="chart-wrap chart-wrap--yoy">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 28, right: 14, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#9aa8bc" }}
              label={{
                value: valueLabel,
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
                value: "שינוי %",
                angle: -90,
                position: "insideRight",
                fill: "#9aa8bc",
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
              labelStyle={{ color: "#e8eef7" }}
              formatter={(
                value: number,
                _name: string,
                item: { dataKey?: string }
              ) => {
                if (item?.dataKey === "yoyPct") {
                  return [fmtPct(value), lineName];
                }
                if (valueLabel === "%") {
                  return [fmtPct(value), barName];
                }
                if (valueLabel === "יחס") {
                  return [fmtNum(value, 2), barName];
                }
                return [fmtNum(value, 0), barName];
              }}
            />
            <Legend wrapperStyle={{ direction: "rtl", fontSize: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="value"
              name={barName}
              fill={barColor}
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="value"
                position="top"
                fill="#e8eef7"
                fontSize={10}
                formatter={(v: number) => fmtBarLabel(v)}
              />
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yoyPct"
              name={lineName}
              stroke="#3dd6c3"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3dd6c3" }}
            >
              <LabelList
                dataKey="yoyPct"
                position="top"
                fill="#7ee3d6"
                fontSize={10}
                formatter={(v: number | undefined) => fmtYoyLabel(v)}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** גרף קו קומפקטי — רק השלמה ויזואלית; הערכים המדויקים בטבלה ליד */
function TrendLineMini({ panel }: { panel: TrendDef }) {
  const ok = panel.points.filter((p) => p.v != null && !Number.isNaN(p.v!));
  if (ok.length < 2) {
    return (
      <div className="trend-mini trend-mini--empty">
        <p className="muted small">אין מספיק נקודות</p>
      </div>
    );
  }
  const formatted = panel.points.map((p) => ({
    year: p.year,
    v: p.v,
  }));
  const fmtVal = (v: number) => {
    if (panel.fmt === "pct") return fmtPct(v);
    if (panel.fmt === "ratio") return fmtNum(v, 2);
    return fmtNum(v, 0);
  };
  return (
    <div className="trend-line-mini">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formatted}
          margin={{ top: 6, right: 4, left: 0, bottom: 2 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="#2a3545" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#7d8fa8", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            height={28}
          />
          <YAxis hide domain={["auto", "auto"]} width={0} />
          <Tooltip
            contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
            formatter={(v: number) => [fmtVal(v), panel.title]}
            labelFormatter={(y) => `שנה ${y}`}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={panel.color}
            strokeWidth={1.75}
            dot={{ r: 2.5, fill: panel.color }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTopicCard({ panel }: { panel: TrendDef }) {
  return (
    <div className="trend-card">
      <div className="trend-card__head-row">
        <span className="trend-card__title">{panel.title}</span>
        {panel.cagr != null && (
          <span
            className="trend-card__cagr"
            title="שיעור צמיחה שנתי ממוצע (CAGR) בין השנה הראשונה והאחרונה בטווח, לפי אותם ערכים כמו בטבלה"
          >
            CAGR {fmtNum(panel.cagr, 1)}%
          </span>
        )}
      </div>
      <p className="trend-card__unit muted small">{panel.unit}</p>
      <div className="trend-card__layout">
        <table className="trend-mini-table">
          <thead>
            <tr>
              <th>שנה</th>
              <th>ערך</th>
            </tr>
          </thead>
          <tbody>
            {panel.points.map((p) => (
              <tr key={p.year}>
                <td>{p.year}</td>
                <td>
                  {p.v == null
                    ? "—"
                    : panel.fmt === "pct"
                      ? fmtPct(p.v)
                      : panel.fmt === "ratio"
                        ? fmtNum(p.v, 2)
                        : fmtNum(p.v, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="trend-chart-wrap" aria-hidden>
          <TrendLineMini panel={panel} />
        </div>
      </div>
    </div>
  );
}

export function IaiBreakdownDemos({ metrics }: { metrics: MetricRow[] }) {
  const [tab, setTab] = useState<DemoTab>("yoy");

  const trendPanels = useMemo(() => buildTrendPanels(metrics), [metrics]);

  const yoyRevenue = useMemo(
    () => buildYoy(metrics, (m) => m.revenueMUSD),
    [metrics]
  );
  const yoyNet = useMemo(
    () => buildYoy(metrics, (m) => m.netIncomeMUSD),
    [metrics]
  );
  const yoyOperating = useMemo(
    () => buildYoy(metrics, (m) => m.operatingIncomeMUSD),
    [metrics]
  );
  const yoyOpMargin = useMemo(
    () =>
      buildYoy(metrics, (m) =>
        operatingMarginPct(m.revenueMUSD, m.operatingIncomeMUSD)
      ),
    [metrics]
  );
  const yoyNetMargin = useMemo(
    () => buildYoy(metrics, (m) => netMarginPct(m.revenueMUSD, m.netIncomeMUSD)),
    [metrics]
  );
  const yoyBacklogRatio = useMemo(
    () =>
      buildYoy(metrics, (m) =>
        backlogToRevenueRatio(m.backlogMUSD, m.revenueMUSD)
      ),
    [metrics]
  );
  const yoyEbitda = useMemo(
    () => buildYoy(metrics, (m) => m.ebitdaMUSD),
    [metrics]
  );
  const yoyFcf = useMemo(
    () =>
      buildYoy(metrics, (m) => freeCashFlowMUSD(m.operatingCashFlowMUSD, m.capexMUSD)),
    [metrics]
  );
  const yoyOcfNi = useMemo(
    () =>
      buildYoy(metrics, (m) => ocfToNetIncomeRatio(m.operatingCashFlowMUSD, m.netIncomeMUSD)),
    [metrics]
  );
  const yoyMarketing = useMemo(
    () => buildYoy(metrics, (m) => m.marketingSalesMUSD ?? null),
    [metrics]
  );
  const yoyRd = useMemo(
    () => buildYoy(metrics, (m) => m.researchDevelopmentMUSD),
    [metrics]
  );
  const yoyGeneralAdmin = useMemo(
    () => buildYoy(metrics, (m) => m.generalAdminMUSD ?? null),
    [metrics]
  );

  return (
    <section className="breakdown-demos">
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        <strong>שנה מול שנה</strong> — על כל עמודה מופיע הערך המספרי, ועל הקו שינוי
        באחוזים מול השנה הקודמת; <strong>CAGR</strong> הוא צמיחה שנתית ממוצעת בין
        השנה הראשונה והאחרונה בטווח. <strong>מגמות לפי נושא</strong> — טבלת שנים
        ליד גרף קצר (לא רחב) כדי לקרוא מספרים בבירור.
      </p>
      <div className="demo-tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as DemoTab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "demo-tab active" : "demo-tab"}
            onClick={() => setTab(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="demo-panel" role="tabpanel">
        {tab === "trends" && (
          <>
            <p className="muted small">
              הטבלה משמאל מציגה את כל השנים והערכים; הגרף מימין — קומפקטי (רוחב מוגבל)
              רק כדי לראות כיוון. אם תרצו, ניתן בהמשך להסתיר את הגרף ולהשאיר רק טבלה.
            </p>
            <div className="trend-grid">
              {trendPanels.map((p) => (
                <TrendTopicCard key={p.id} panel={p} />
              ))}
            </div>
          </>
        )}

        {tab === "yoy" && (
          <>
            <p className="muted small">
              עמודה = רמת הערך (מיליון USD, אחוז, או יחס מלאי÷הכנסות), קו = שינוי שנתי
              % מול שנה קודמת; מעל כל עמודה/נקודה תוויות. <strong>CAGR</strong> בכותרת
              = צמיחה שנתית ממוצעת בין השנה הראשונה לאחרונה בטווח.
            </p>
            <YoyCombo
              title="הכנסות"
              data={yoyRevenue}
              valueLabel="מיליון USD"
              barName="הכנסות (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#4f9eff"
            />
            <YoyCombo
              title="רווח נקי"
              data={yoyNet}
              valueLabel="מיליון USD"
              barName="רווח נקי (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#f0c674"
            />
            <YoyCombo
              title="רווח תפעולי (EBIT)"
              data={yoyOperating}
              valueLabel="מיליון USD"
              barName="רווח תפעולי (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#c792ea"
            />
            <YoyCombo
              title="רווח תפעולי ממכירות"
              data={yoyOpMargin}
              valueLabel="%"
              barName="רווח תפעולי ממכירות (%)"
              lineName="שינוי שנתי %"
              barColor="#e6b35c"
            />
            <YoyCombo
              title="רווח נקי ממכירות"
              data={yoyNetMargin}
              valueLabel="%"
              barName="רווח נקי ממכירות (%)"
              lineName="שינוי שנתי %"
              barColor="#ff9f6e"
            />
            <YoyCombo
              title="יחס מלאי הזמנות להכנסות"
              data={yoyBacklogRatio}
              valueLabel="יחס"
              barName="מלאי ÷ הכנסות"
              lineName="שינוי שנתי %"
              barColor="#9cdcfe"
            />
            <YoyCombo
              title="EBITDA"
              data={yoyEbitda}
              valueLabel="מיליון USD"
              barName="EBITDA (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#a78bfa"
            />
            <YoyCombo
              title="תזרים חופשי (פשוט)"
              data={yoyFcf}
              valueLabel="מיליון USD"
              barName="תזרים חופשי (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#7ee3d6"
            />
            <YoyCombo
              title="תזרים תפעולי ÷ רווח נקי"
              data={yoyOcfNi}
              valueLabel="יחס"
              barName="תפעולי÷רווח נקי"
              lineName="שינוי שנתי %"
              barColor="#f0c674"
            />
            <YoyCombo
              title="מכירה ושיווק"
              data={yoyMarketing}
              valueLabel="מיליון USD"
              barName="מכירה ושיווק (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#4f9eff"
            />
            <YoyCombo
              title="מחקר ופיתוח"
              data={yoyRd}
              valueLabel="מיליון USD"
              barName="מחקר ופיתוח (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#e6b35c"
            />
            <YoyCombo
              title="הנהלה וכלליות"
              data={yoyGeneralAdmin}
              valueLabel="מיליון USD"
              barName="הנהלה וכלליות (מיליון USD)"
              lineName="שינוי שנתי %"
              barColor="#f07178"
            />
          </>
        )}
      </div>
    </section>
  );
}
