import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteNav } from "../components/SiteNav";
import {
  backlogToRevenueRatio,
  cagrAnnualPct,
  ebitdaMarginPct,
  freeCashFlowMUSD,
  netMarginPct,
  ocfToNetIncomeRatio,
  operatingMarginPct,
  rdPctOfRevenue,
} from "../lib/iaiMetrics";
import type { IaiPayload, MetricRow } from "../types/iai";

const EMPTY_PAYLOAD = (slug: string, nameHe: string): IaiPayload =>
  ({
    company: { slug, nameHe, nameEn: slug, reportsFolder: "" },
    currencyNote: "",
    insights: [],
    metrics: [],
  }) as IaiPayload;

type CompareCompanySlug =
  | "iai"
  | "elbit"
  | "rafael"
  | "lockheed"
  | "rtx"
  | "leonardo"
  | "bae"
  | "rheinmetall"
  | "thales"
  | "gd"
  | "northrop"
  | "l3harris"
  | "boeing"
  | "embraer"
  | "saab";

const COMPARE_COMPANY_META: {
  slug: CompareCompanySlug;
  nameHe: string;
  shortName: string;
  color: string;
  radarTagClass: string;
}[] = [
  { slug: "iai", nameHe: "תעשייה אווירית", shortName: "תע״א", color: "#4f9eff", radarTagClass: "compare-radar-tooltip__tag--iai" },
  { slug: "elbit", nameHe: "אלביט מערכות", shortName: "אלביט", color: "#3dd6c3", radarTagClass: "compare-radar-tooltip__tag--elbit" },
  { slug: "rafael", nameHe: "רפאל", shortName: "רפאל", color: "#f0ab43", radarTagClass: "compare-radar-tooltip__tag--rafael" },
  { slug: "lockheed", nameHe: "לוקהיד מרטין", shortName: "לוקהיד", color: "#e879a8", radarTagClass: "compare-radar-tooltip__tag--lockheed" },
  { slug: "rtx", nameHe: "RTX", shortName: "RTX", color: "#a78bfa", radarTagClass: "compare-radar-tooltip__tag--rtx" },
  { slug: "leonardo", nameHe: "לאונרדו", shortName: "לאונרדו", color: "#22d3ee", radarTagClass: "compare-radar-tooltip__tag--leonardo" },
  { slug: "bae", nameHe: "BAE Systems", shortName: "BAE", color: "#fb923c", radarTagClass: "compare-radar-tooltip__tag--bae" },
  { slug: "rheinmetall", nameHe: "Rheinmetall", shortName: "Rheinmetall", color: "#84cc16", radarTagClass: "compare-radar-tooltip__tag--rheinmetall" },
  { slug: "thales", nameHe: "Thales", shortName: "Thales", color: "#818cf8", radarTagClass: "compare-radar-tooltip__tag--thales" },
  { slug: "gd", nameHe: "ג׳נרל דיינמיקס", shortName: "GD", color: "#f472b6", radarTagClass: "compare-radar-tooltip__tag--gd" },
  { slug: "northrop", nameHe: "נורת׳רופ גראמן", shortName: "נורת׳רופ", color: "#34d399", radarTagClass: "compare-radar-tooltip__tag--northrop" },
  { slug: "l3harris", nameHe: "L3Harris", shortName: "L3Harris", color: "#fcd34d", radarTagClass: "compare-radar-tooltip__tag--l3harris" },
  { slug: "boeing", nameHe: "בואינג", shortName: "Boeing", color: "#38bdf8", radarTagClass: "compare-radar-tooltip__tag--boeing" },
  { slug: "embraer", nameHe: "אמבראיר", shortName: "Embraer", color: "#2dd4bf", radarTagClass: "compare-radar-tooltip__tag--embraer" },
  { slug: "saab", nameHe: "סאאב", shortName: "Saab", color: "#facc15", radarTagClass: "compare-radar-tooltip__tag--saab" },
];

const ALL_COMPARE_SLUGS: CompareCompanySlug[] = COMPARE_COMPANY_META.map((c) => c.slug);

function orderSelectedSlugs(slugs: CompareCompanySlug[]): CompareCompanySlug[] {
  return ALL_COMPARE_SLUGS.filter((s) => slugs.includes(s));
}

function intersectOverlapYears(metricsList: { metrics: MetricRow[] }[]): number[] {
  if (metricsList.length === 0) return [];
  let s = new Set(metricsList[0].metrics.map((m) => m.year));
  for (let i = 1; i < metricsList.length; i++) {
    const next = new Set(metricsList[i].metrics.map((m) => m.year));
    s = new Set([...s].filter((y) => next.has(y)));
  }
  return [...s].sort((a, b) => b - a);
}

/** כל השנים שמופיעות אצל לפחות אחת מהחברות — כדי שלא ייעלמו 2025 בגלל חברה אחת בלי דוח */
function unionCompareYears(metricsList: { metrics: MetricRow[] }[]): number[] {
  const s = new Set<number>();
  for (const m of metricsList) {
    for (const row of m.metrics) s.add(row.year);
  }
  return [...s].sort((a, b) => b - a);
}

/** הגדרות מדדים להשוואה דינמית, מטריצה ופיזור */
const METRIC_DEFS: {
  id: string;
  label: string;
  frac: number;
  isPct?: boolean;
  isRatio?: boolean;
}[] = [
  { id: "revenueMUSD", label: "הכנסות", frac: 0 },
  { id: "backlogMUSD", label: "צבר הזמנות", frac: 0 },
  { id: "backlogToRevenue", label: "צבר÷הכנסות", frac: 2, isRatio: true },
  { id: "netIncomeMUSD", label: "רווח נקי", frac: 0 },
  { id: "operatingIncomeMUSD", label: "רווח תפעולי", frac: 0 },
  { id: "ebitdaMUSD", label: "EBITDA", frac: 0 },
  { id: "grossMarginPct", label: "רווח גולמי %", frac: 1, isPct: true },
  { id: "operatingMarginPct", label: "רווח תפעולי ממכירות %", frac: 2, isPct: true },
  { id: "netMarginPct", label: "רווח נקי ממכירות %", frac: 2, isPct: true },
  { id: "ebitdaMarginPct", label: "EBITDA ממכירות %", frac: 2, isPct: true },
  { id: "operatingCashFlowMUSD", label: "תזרים תפעולי", frac: 0 },
  { id: "freeCashFlowMUSD", label: "תזרים חופשי (פשוט)", frac: 0 },
  { id: "ocfToNetIncome", label: "תזרים תפעולי÷רווח נקי", frac: 2, isRatio: true },
  { id: "investingCashFlowMUSD", label: "תזרים השקעות", frac: 0 },
  { id: "financingCashFlowMUSD", label: "תזרים מימון", frac: 0 },
  { id: "totalAssetsMUSD", label: "סה״כ נכסים", frac: 0 },
  { id: "totalLiabilitiesMUSD", label: "סה״כ התחייבויות", frac: 0 },
  { id: "equityMUSD", label: "הון עצמי", frac: 0 },
  { id: "capexMUSD", label: "השקעות בקבועים (CapEx)", frac: 0 },
  { id: "researchDevelopmentMUSD", label: "מחקר ופיתוח", frac: 0 },
  { id: "marketingSalesMUSD", label: "שיווק ומכירה", frac: 0 },
  { id: "generalAdminMUSD", label: "הנהלה וכלליות", frac: 0 },
  { id: "rdPctOfRevenue", label: "מו״פ ממכירות %", frac: 2, isPct: true },
  { id: "employees", label: "עובדים", frac: 0 },
];

/** הסבר קצר למה כל מדד רלוונטי לניתוח (McKinsey-style, ברמת תזכורת) */
const DEFAULT_METRIC_MEANING =
  "מדד זה נשלף מקבצי המטריקות; כדאי לפרש אותו בהקשר לדוח המקורי, להערות ולשינויים חד־פעמיים.";

const METRIC_MEANING: Record<string, string> = {
  revenueMUSD:
    "הכנסות משקפות את היקף הפעילות המדווח. זה בדרך־כלל נקודת הפתיחה לקנה מידה — אך לא מספיק לבד להערכת רווחיות או איכות מזומנים.",
  backlogMUSD:
    "צבר הזמנות משקף עבודה עתידית שטרם הוכרה כהכנסה; גבוה יחסית לעומת הכנסות שנתיות מצביע לרוב על עומס ביצוע או צמיחה צפויה, תלוי בדינמיקת הזמנות חדשות.",
  backlogToRevenue:
    "יחס צבר להכנסות מסכם כמה שנות פעילות «ננעלו» בהזמנות פתוחות ביחס למחזור — מדד עמידות ועומס עתידי, לא רווחיות.",
  netIncomeMUSD:
    "רווח נקי הוא מה שנשאר אחרי כל ההוצאות והמסים; חשוב להבין אם הוא יציב או מושפע מאירועים חד־פעמיים.",
  operatingIncomeMUSD:
    "רווח תפעולי (EBIT) משקף את רווחיות הפעילות לפני מימון ומסים — לרוב ליבת הביצועים התפעוליים.",
  ebitdaMUSD:
    "EBITDA מקרב את יכולת הפעילות לייצר מזומן לפני פחת וריבית — שימושי להשוואה בין חברות, אך לא תחליף לתזרים.",
  grossMarginPct:
    "רווח גולמי באחוזים מודד כמה מהמכירה נשאר אחרי עלות המכר — מעיד על מחיר, תעריף ויעילות עלות ישירה.",
  operatingMarginPct:
    "רווח תפעולי ממכירות מודד כמה מההכנסה נשארת אחרי עלות והוצאות תפעול — יעילות תפעולית ליבה.",
  netMarginPct:
    "רווח נקי ממכירות מסכם את כל השכבות — תחרותיות סופית אחרי מימון, מסים ושאר הוצאות.",
  ebitdaMarginPct:
    "EBITDA ממכירות משווה את היכולת התפעולית־מבנית לפני פחת לעומת הכנסות — שימושי להשוואת מבנה עלויות.",
  operatingCashFlowMUSD:
    "תזרים תפעולי משקף מזומן שנוצר מהפעילות השוטפת — קרוב לרווח אך יכול להסטה בגלל הון חוזר, תזמון ופרויקטים.",
  freeCashFlowMUSD:
    "תזרים חופשי פשוט (תפעולי פחות CapEx) מקרב כמה מזומן נשאר אחרי השקעה בנכסים — בסיס לדיון בחוזק פיננסי ובצמיחה.",
  ocfToNetIncome:
    "יחס תזרים תפעולי לרווח נקי מודד עד כמה הרווח «מתממש» במזומן; ערך נמוך מ־1 לעיתים מצביע על הפרשי תזמון או פריטים לא־מזומניים.",
  investingCashFlowMUSD:
    "תזרים השקעות משקף רכישות/מכירות נכסים והשקעות; לרוב שלילי בצמיחה — חשוב לראות האם זה מתואם לאסטרטגיה.",
  financingCashFlowMUSD:
    "תזרים מימון משקף הלוואות, פירעונות וחלוקות לבעלים; עוזר להבין איך החברה מממנת את עצמה.",
  totalAssetsMUSD:
    "סה״כ נכסים משקף את בסיס המאזן; צריך לראות יחד עם התחייבויות ואיכות הנכסים, לא כיעד בפני עצמו.",
  totalLiabilitiesMUSD:
    "סה״כ התחייבויות מודד חובות וחיובים עתידיים; להשוות מול נכסים, תזרים ומבנה פירעון.",
  equityMUSD:
    "הון עצמי הוא השארית במאזן; משקף עומס פיננסי היסטורי ויכולת לספוג הפסדים יחסית לנכסים.",
  capexMUSD:
    "CapEx הוא השקעה בנכסים קבועים; גבוה יחסית יכול לתמוך בצמיחה אך ללחוץ על מזומן בטווח הקצר.",
  researchDevelopmentMUSD:
    "הוצאות מו״פ משקפות השקעה בחדשנות ובמוצר עתידי — חשוב לבחון גם יחס להכנסות ואת פירותיהן בצבר ובשוליים.",
  marketingSalesMUSD:
    "הוצאות שיווק ומכירה משקפות מאמץ לזכות בהזמנות ובנתח שוק — להשוות לצמיחה בהכנסות וליעילות.",
  generalAdminMUSD:
    "הוצאות הנהלה וכלליות משקפות עלות מבנה ארגוני ותשתית — לרוב רצוי שיישארו יציבות יחסית כשהחברה גדלה.",
  rdPctOfRevenue:
    "מו״פ כאחוז מההכנסות מנרמל את עוצמת ההשקעה בחדשנות ביחס למחזור — מועיל להשוואה בין חברות בגדלים שונים.",
  employees:
    "מספר עובדים משקף היקף כוח אדם; אפשר לשלב עם הכנסות לעובד כדי לראות פרודוקטיביות גסה.",
};

const REGION_DEFS = [
  { key: "israel", label: "ישראל" },
  { key: "northAmerica", label: "צפון אמריקה" },
  { key: "europe", label: "אירופה" },
  { key: "asiaPacific", label: "אסיה-פסיפיק" },
  { key: "restOfWorld", label: "שאר העולם" },
] as const;

type RegionKey = (typeof REGION_DEFS)[number]["key"];

/** צבעים לערימה — סדר קבוע לקריאות מגמה */
const REGION_STACK_COLORS: Record<RegionKey, string> = {
  israel: "rgba(79, 158, 255, 0.9)",
  northAmerica: "rgba(167, 139, 250, 0.92)",
  europe: "rgba(244, 114, 182, 0.88)",
  asiaPacific: "rgba(61, 214, 195, 0.9)",
  restOfWorld: "rgba(251, 191, 36, 0.92)",
};

function fullRegionPctMap(reg: MetricRow["salesByRegionPct"]): Record<RegionKey, number> | null {
  if (!reg) return null;
  const out = {} as Record<RegionKey, number>;
  for (const { key } of REGION_DEFS) {
    const v = reg[key];
    if (v == null || Number.isNaN(v)) return null;
    out[key] = v;
  }
  return out;
}

type RegionYearPoint = { year: number; regions: Record<RegionKey, number> };

type TrendExpenseSlice = { rd: number | null; marketing: number | null; ga: number | null };

type MarketTrendRow = {
  year: number;
  bySlug: Record<
    CompareCompanySlug,
    { expenses: TrendExpenseSlice; regions: MetricRow["salesByRegionPct"] | undefined }
  >;
};

function emptyTrendBySlug(): MarketTrendRow["bySlug"] {
  const o = {} as MarketTrendRow["bySlug"];
  for (const slug of ALL_COMPARE_SLUGS) {
    o[slug] = { expenses: { rd: null, marketing: null, ga: null }, regions: undefined };
  }
  return o;
}

function regionSeriesFromTrendRows(rows: MarketTrendRow[], slug: CompareCompanySlug): RegionYearPoint[] {
  const xs: RegionYearPoint[] = [];
  for (const r of rows) {
    const m = fullRegionPctMap(r.bySlug[slug].regions);
    if (!m) continue;
    xs.push({ year: r.year, regions: m });
  }
  return xs.sort((a, b) => a.year - b.year);
}

function stackRowsFromSeries(series: RegionYearPoint[]): Record<string, number | string>[] {
  return series.map(({ year, regions }) => {
    const row: Record<string, number | string> = { year };
    for (const { key } of REGION_DEFS) row[key] = regions[key];
    return row;
  });
}

type DomesticExportPoint = { year: number; domestic: number; export: number };

function domesticExportFromRow(row: MetricRow | undefined): { domestic: number; export: number } | null {
  if (!row) return null;
  const customDomestic = (row as unknown as { salesDomesticPct?: number }).salesDomesticPct;
  const customExport = (row as unknown as { salesExportPct?: number }).salesExportPct;
  if (
    customDomestic != null &&
    customExport != null &&
    !Number.isNaN(customDomestic) &&
    !Number.isNaN(customExport)
  ) {
    return { domestic: customDomestic, export: customExport };
  }
  const reg = row.salesByRegionPct;
  if (!reg || reg.israel == null || Number.isNaN(reg.israel)) return null;
  const exportPct = 100 - reg.israel;
  if (Number.isNaN(exportPct)) return null;
  return { domestic: reg.israel, export: exportPct };
}

function fmtPctInsight(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/** מגמה ארוכה: מהשנה המוקדמת ביותר עם נתונים לעומת המאוחרת ביותר */
function regionLongHorizonLines(companyLabel: string, series: RegionYearPoint[]): string[] {
  if (series.length < 2) return [];
  const f = series[0];
  const l = series[series.length - 1];
  const items = REGION_DEFS.map(({ key, label }) => ({
    label,
    d: l.regions[key] - f.regions[key],
    a: f.regions[key],
    b: l.regions[key],
  })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const head = `${companyLabel}: בין ${f.year} ל־${l.year} — כל האזורים ממוינים לפי גודל השינוי בנקודות אחוז מסך המכירות (מהחזק לחלש):`;
  const body = items.map(({ label: lab, d, a, b }) => {
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const sign = d > 0 ? "+" : "";
    return `${lab} ${arrow} ${sign}${fmtPctInsight(d)} (${fmtPctInsight(a)}% → ${fmtPctInsight(b)}%)`;
  });
  return [head, ...body];
}

/** שנה אחרונה מול הקודמת (אם קיימות שתיהן) */
function regionYoyLines(companyLabel: string, series: RegionYearPoint[]): string[] {
  if (series.length < 2) return [];
  const prev = series[series.length - 2];
  const last = series[series.length - 1];
  if (last.year <= prev.year) return [];
  const items = REGION_DEFS.map(({ key, label }) => ({
    label,
    d: last.regions[key] - prev.regions[key],
    a: prev.regions[key],
    b: last.regions[key],
  })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const head = `${companyLabel}: ${prev.year} → ${last.year} (שנה אחרונה):`;
  const body = items.map(({ label: lab, d, a, b }) => {
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const sign = d > 0 ? "+" : "";
    return `${lab} ${arrow} ${sign}${fmtPctInsight(d)} (${fmtPctInsight(a)}% → ${fmtPctInsight(b)}%)`;
  });
  return [head, ...body];
}

type ExpensePoint = { year: number; rd: number | null; marketing: number | null; ga: number | null };

function buildExpensePoints(rows: MarketTrendRow[], slug: CompareCompanySlug): ExpensePoint[] {
  return rows.map((r) => ({
    year: r.year,
    rd: r.bySlug[slug].expenses.rd,
    marketing: r.bySlug[slug].expenses.marketing,
    ga: r.bySlug[slug].expenses.ga,
  }));
}

function expenseInsightLines(companyLabel: string, points: ExpensePoint[]): string[] {
  const valid = points.filter((p) => p.rd != null || p.marketing != null || p.ga != null);
  if (valid.length < 2) return [];
  const first = valid[0];
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const defs: { key: "rd" | "marketing" | "ga"; label: string }[] = [
    { key: "rd", label: "מו״פ" },
    { key: "marketing", label: "מכירה ושיווק" },
    { key: "ga", label: "הנהלה וכלליות" },
  ];
  const long = defs
    .map((d) => {
      const a = first[d.key];
      const b = last[d.key];
      if (a == null || b == null) return null;
      return { label: d.label, d: b - a, a, b };
    })
    .filter((x): x is { label: string; d: number; a: number; b: number } => x != null)
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const yoy = defs
    .map((d) => {
      const a = prev[d.key];
      const b = last[d.key];
      if (a == null || b == null) return null;
      return { label: d.label, d: b - a, a, b };
    })
    .filter((x): x is { label: string; d: number; a: number; b: number } => x != null)
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const fmt = (n: number) => fmtNum(n, 0);
  const headLong = `${companyLabel}: שינוי רב־שנתי בהוצאות (${first.year}→${last.year}, מיליון $).`;
  const headYoy = `${companyLabel}: שינוי בשנה האחרונה (${prev.year}→${last.year}, מיליון $).`;
  const linesLong = long.map((x) => {
    const arrow = x.d > 0 ? "↑" : x.d < 0 ? "↓" : "→";
    const sign = x.d > 0 ? "+" : "";
    return `${x.label} ${arrow} ${sign}${fmt(x.d)} (${fmt(x.a)} → ${fmt(x.b)})`;
  });
  const linesYoy = yoy.map((x) => {
    const arrow = x.d > 0 ? "↑" : x.d < 0 ? "↓" : "→";
    const sign = x.d > 0 ? "+" : "";
    return `${x.label} ${arrow} ${sign}${fmt(x.d)} (${fmt(x.a)} → ${fmt(x.b)})`;
  });
  return [headLong, ...linesLong, headYoy, ...linesYoy];
}

function metricDef(id: string) {
  return METRIC_DEFS.find((d) => d.id === id) ?? METRIC_DEFS[0];
}

function getMetricValue(row: MetricRow | undefined, id: string): number | null {
  if (!row) return null;
  switch (id) {
    case "revenueMUSD":
      return row.revenueMUSD;
    case "backlogMUSD":
      return row.backlogMUSD;
    case "backlogToRevenue":
      return backlogToRevenueRatio(row.backlogMUSD, row.revenueMUSD);
    case "netIncomeMUSD":
      return row.netIncomeMUSD;
    case "operatingIncomeMUSD":
      return row.operatingIncomeMUSD;
    case "ebitdaMUSD":
      return row.ebitdaMUSD;
    case "grossMarginPct":
      return row.grossMarginPct;
    case "operatingMarginPct":
      return operatingMarginPct(row.revenueMUSD, row.operatingIncomeMUSD);
    case "netMarginPct":
      return netMarginPct(row.revenueMUSD, row.netIncomeMUSD);
    case "ebitdaMarginPct":
      return ebitdaMarginPct(row.revenueMUSD, row.ebitdaMUSD);
    case "operatingCashFlowMUSD":
      return row.operatingCashFlowMUSD;
    case "freeCashFlowMUSD":
      return freeCashFlowMUSD(row.operatingCashFlowMUSD, row.capexMUSD);
    case "ocfToNetIncome":
      return ocfToNetIncomeRatio(row.operatingCashFlowMUSD, row.netIncomeMUSD);
    case "investingCashFlowMUSD":
      return row.investingCashFlowMUSD;
    case "financingCashFlowMUSD":
      return row.financingCashFlowMUSD;
    case "totalAssetsMUSD":
      return row.totalAssetsMUSD;
    case "totalLiabilitiesMUSD":
      return row.totalLiabilitiesMUSD;
    case "equityMUSD":
      return row.equityMUSD;
    case "capexMUSD":
      return row.capexMUSD;
    case "researchDevelopmentMUSD":
      return row.researchDevelopmentMUSD;
    case "marketingSalesMUSD":
      return row.marketingSalesMUSD ?? null;
    case "generalAdminMUSD":
      return row.generalAdminMUSD ?? null;
    case "rdPctOfRevenue":
      return rdPctOfRevenue(row.revenueMUSD, row.researchDevelopmentMUSD);
    case "employees":
      return row.employees;
    default:
      return null;
  }
}

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", {
    maximumFractionDigits: frac,
    minimumFractionDigits: frac,
  });
}

function fmtMetricCell(v: number | null | undefined, def: (typeof METRIC_DEFS)[number]): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (def.isPct) return `${fmtNum(v, def.frac)}%`;
  if (def.isRatio) return fmtNum(v, def.frac);
  return fmtNum(v, def.frac);
}

function rowForYear(metrics: MetricRow[], year: number): MetricRow | undefined {
  return metrics.find((m) => m.year === year);
}

function collectSeries(
  metrics: MetricRow[],
  yearsAsc: number[],
  metricId: string
): { year: number; v: number }[] {
  const out: { year: number; v: number }[] = [];
  for (const y of yearsAsc) {
    const row = rowForYear(metrics, y);
    const v = getMetricValue(row, metricId);
    if (v != null && !Number.isNaN(v)) out.push({ year: y, v });
  }
  return out;
}

/** זווית דיון ייעוצית למדד — לא תיאור מספרי */
const METRIC_ANALYSIS_LENS: Record<string, string> = {
  revenueMUSD:
    "בדיון הנהלה: כדאי לקשר את פערי הקצב לפילוח גיאוגרפי/מוצרי ולספר הזמנות — לא רק ל׳מי גדול יותר׳.",
  backlogMUSD:
    "המשמעות האסטרטגית טמונה ביחס בין צבר לביצוע: צבר עמוס מול הכנסות יכול להצביע על עומס או על צינור עתידי חזק.",
  backlogToRevenue:
    "כאן נבחנת עמידות פעילות מול עומס עתידי; שינוי ביחס מחייב הבנה אם מדובר בצמיחת הזמנות, בביצוע, או בשניהם.",
  netIncomeMUSD:
    "רווח נקי משווה תוצאה סופית — כדאי לבודד אירועים חד־פעמיים והשפעת מימון ומס לפני מסקנות תחרותיות.",
  operatingIncomeMUSD:
    "EBIT משקף ביצועים תפעוליים ׳נקיים׳ יחסית; פערי מגמה מול הכנסות מרמזים על מבנה עלות או תעריף שונה.",
  ebitdaMUSD:
    "EBITDA מסייע להשוואת כושר הפקת מזומן תפעולי לפני פחת; פערים מהותיים כאן לרוב מעידים על מבנה עסקי שונה.",
  grossMarginPct:
    "פערים במרווח הגולמי מצביעים לרוב על שילוב שונה של מחיר, מיקס מוצרים או עלות ישירה — לבחון לפני מסקנות על ׳יעילות כללית׳.",
  operatingMarginPct:
    "מרווח תפעולי משלב תעריף ויעילות תפעולית; כשהמגמות בין החברות נפרדות, כדאי לפרק לעלות ישירה מול תפעול ומול מו״פ/שיווק.",
  netMarginPct:
    "מרווח נקי מסכם את כל השכבות; אם הוא לא זז יחד עם התפעולי, כדאי לבדוק מימון, מס ופריטים חד־פעמיים.",
  ebitdaMarginPct:
    "מדד מבני לשאלת ׳כמה מהמחזור נשאר לפני פחת׳; מתאים להשוואת מודל עסקי כשהמחזורים שונים במידה.",
  operatingCashFlowMUSD:
    "תזרים תפעולי חושף תזמון והון חוזר; פער מול רווח נקי או מול המתחרה מחייב לעיתים בדיקת פרויקטים ומדיניות עבודה מול לקוחות.",
  freeCashFlowMUSD:
    "תזרים חופשי מקרב את השאלה כמה נשאר אחרי השקעה בנכסים — לרלוונטי לדיון על חוזק מאזני מול צמיחה.",
  ocfToNetIncome:
    "יחס נמוך מדי מרמז לעיתים על רווח ׳ניירי׳ או על תזמון; גבוה מדי לעיתים על שינויים בהון חוזר — כדאי לאמת מול הדוחות.",
  investingCashFlowMUSD:
    "תזרים השקעות משקף אסטרטגיית צמיחה ורכישות; השוואה בין חברות דורשת הקשר ל־CapEx ולפעילות M&A, לא שיפוט אוטומטי על ׳טוב/רע׳.",
  financingCashFlowMUSD:
    "מבנה המימון והחזר החוב משפיעים על התזרים הזה; פערים משקפים לרוב בחירות הון שונות, לא בהכרח ביצועים תפעוליים.",
  totalAssetsMUSD:
    "נכסים הם בסיס פעילות; יש לקרוא יחד עם מינוף ותזרים — פערי מגמה לבדם לא מספיקים להערכת סיכון.",
  totalLiabilitiesMUSD:
    "התחייבויות משקפות מינוף ומבנה מאזן; השוואה דורשת הקשר להון עצמי וליכולת פירעון, לא רק לגודל המספר.",
  equityMUSD:
    "הון עצמי משקף צבירה היסטורית והפסדים; שינויים יחסיים בין חברות עשויים לנבוע מחלוקות, הנפקות או מדיניות רווחים.",
  capexMUSD:
    "CapEx מצביע על קצב השקעה בעתיד פרודוקטיביות; פערים מהותיים לרוב משקפים שלב צמיחה או מיקס נכסים שונה.",
  researchDevelopmentMUSD:
    "מו״פ הוא הימור על מוצר עתידי; השוואה צריכה לשאול אם ההשקעה מתורגמת לצבר/להכנסות — לא רק את גובה השורה.",
  marketingSalesMUSD:
    "שיווק ומכירה משקפים מאמץ לזכייה בשוק; כדאי לבחון יחס להכנסות ולשינוי בצבר, לא רק את רמת ההוצאה.",
  generalAdminMUSD:
    "הנהלה וכלליות משקפות יעילות מבנית; אם המדד ׳רץ׳ מהר מדי ביחס להכנסות, זה לרוב סימן לבדיקת שכבות ניהול ותשתית.",
  rdPctOfRevenue:
    "אחוז מו״פ מנרמל את עוצמת החדשנות; פער יציב לטווח ארוך מצביע לעיתים על מודל מוצר או סיכון טכנולוגי שונה.",
  employees:
    "עובדים מול הכנסות נותנים פרודוקטיביות גסה; פערים משקפים לעיתים מיקס פעילות (בשירות מול ייצור) ולא רק ׳יעילות׳.",
};

function seriesDelta(pts: { year: number; v: number }[]): number | null {
  if (pts.length < 2) return null;
  return pts[pts.length - 1].v - pts[0].v;
}

function buildParamTrendAnalysisMulti(
  metricId: string,
  companies: { slug: CompareCompanySlug; nameHe: string; data: IaiPayload }[],
  overlapYears: number[]
): string {
  const lens = METRIC_ANALYSIS_LENS[metricId] ?? DEFAULT_METRIC_MEANING;
  const ys = [...overlapYears].sort((a, b) => a - b);
  if (companies.length < 2) {
    return "בחרו לפחות שתי חברות כדי לקבל חוות דעת השוואתית על מגמת המדד.";
  }

  const series = companies.map((c) => ({
    slug: c.slug,
    name: c.nameHe,
    pts: collectSeries(c.data.metrics, ys, metricId),
  }));

  if (!series.some((s) => s.pts.length > 0)) {
    return "אין ערכים בטווח השנים שנבחר — לא ניתן לגזור תובנה השוואתית מהגרף.";
  }

  const parts: string[] = [];
  const yLast = ys[ys.length - 1];

  const atLast = companies
    .map((c) => ({
      name: c.nameHe,
      v: getMetricValue(rowForYear(c.data.metrics, yLast), metricId),
    }))
    .filter((x) => x.v != null && !Number.isNaN(x.v as number)) as { name: string; v: number }[];

  if (atLast.length >= 2) {
    const sorted = [...atLast].sort((a, b) => b.v - a.v);
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    const eps = Math.max(...sorted.map((x) => Math.abs(x.v)), 1) * 0.02;
    const tight = sorted.every((x) => Math.abs(x.v - sorted[0].v) <= eps);
    if (tight) {
      parts.push(
        `בשנה ${yLast} הערכים קרובים מאוד בין החברות הנבחרות במדד — התחרות צמודה; כדאי לפרק למרכיבים בדוח (מבנה, מחזור, שער).`
      );
    } else if (sorted.length === 2) {
      parts.push(
        `בשנה ${yLast} ${hi.name} מובילה ביחס ל־${lo.name} במדד — נקודת פתיחה לדיון על מקור היתרון והאם הוא נשמר במגמה.`
      );
    } else {
      parts.push(
        `בשנה ${yLast}: ${hi.name} בראש והנמוך ביותר הוא ${lo.name} — יש פיזור משמעותי בין ${atLast.length} חברות; חשוב לבדוק מטבע דיווח, שלבי מחזור ואירועים חד־פעמיים לפני מסקנות.`
      );
    }
  }

  const deltas = series
    .map((s) => {
      const d = seriesDelta(s.pts);
      return d == null ? null : { name: s.name, d };
    })
    .filter((x): x is { name: string; d: number } => x != null);

  if (deltas.length >= 2) {
    const up = deltas.filter((x) => x.d > 0).length;
    const down = deltas.filter((x) => x.d < 0).length;
    const allFlat = deltas.every((x) => Math.abs(x.d) < 1e-6);
    if (allFlat) {
      parts.push(
        "הסדרות כמעט יציבות בטווח — המדד לא זז משמעותית; התובנה נמצאת בשכבות אחרות (צבר, תזרים, הערות)."
      );
    } else if (up === deltas.length) {
      parts.push(
        "כל החברות הנבחרות במגמת שיפור במדד בטווח — כדאי לבחון אם מדובר במחזור משותף או במסלולי צמיחה שונים באותו כיוון."
      );
    } else if (down === deltas.length) {
      parts.push(
        "כל החברות הנבחרות במגמת ירידה במדד — שווה לבדוק גורם מערכתי או שנה חריגה לפני מסקנת מבנה."
      );
    } else if (up > 0 && down > 0) {
      parts.push(
        "מגמות מפוצלות בין החברות — לא אותו סיפור מחזורי; חוות דעת מחייבת פירוק לפי דוח (מס, מיקס, פרויקטים) ולא השוואת קו יחיד."
      );
    }
  }

  const alignedFull = ys
    .map((y) => {
      const vals = companies.map((c) => getMetricValue(rowForYear(c.data.metrics, y), metricId));
      if (vals.some((v) => v == null || Number.isNaN(v as number))) return null;
      return { y, vals: vals as number[] };
    })
    .filter((x): x is { y: number; vals: number[] } => x != null);

  if (alignedFull.length >= 2) {
    const spread = (vs: number[]) => Math.max(...vs) - Math.min(...vs);
    const s0 = spread(alignedFull[0].vals);
    const s1 = spread(alignedFull[alignedFull.length - 1].vals);
    if (s1 < s0 * 0.92) {
      parts.push(
        "הפיזור בין החברות במדד צומצם לאורך הטווח — התקרבות יחסית; ייתכן שילוב של מחזור, התאמות דיווח או התכנסות ביצועים."
      );
    } else if (s1 > s0 * 1.08) {
      parts.push(
        "הפיזור בין החברות במדד גדל — נפתחים פערים יחסיים; כדאי לבחון מי האיץ מול מי נשאר יציב."
      );
    }
  }

  parts.push(lens);
  return parts.join(" ");
}

function normMany(vals: (number | null | undefined)[]): number[] | null {
  const nums = vals.map((v) => (v != null && !Number.isNaN(v) ? v : null));
  if (nums.some((v) => v == null)) return null;
  const vs = nums as number[];
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  if (hi === lo) return vs.map(() => 50);
  return vs.map((v) => ((v - lo) / (hi - lo)) * 100);
}

type RadarDatum = {
  metric: string;
} & Record<string, number | string>;

function fmtMusdCell(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${fmtNum(v, 0)} מ״ד $`;
}

function clampScore(x: number): number {
  return Math.max(1, Math.min(5, x));
}

function scoreFromMargin(v: number | null): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return clampScore(1 + v / 3.5);
}

function scoreFromRatio(v: number | null): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return clampScore(1 + v * 2);
}

function revenueTrendPhrase(cagr: number | null): string | null {
  if (cagr == null || !Number.isFinite(cagr)) return null;
  if (cagr >= 8) return "צמיחת הכנסות חזקה";
  if (cagr >= 3) return "צמיחת הכנסות יציבה";
  if (cagr >= 0) return "שינוי מתון או צמיחה איטית בהכנסות";
  return "מגמת ירידה או התכווצות בהכנסות";
}

function buildCompareInsightParagraphsMulti(
  companies: { slug: CompareCompanySlug; nameHe: string; data: IaiPayload }[],
  overlapYears: number[]
): string[] | null {
  if (companies.length < 2) return null;
  const ys = [...overlapYears].sort((a, b) => a - b);
  const yLast = ys[ys.length - 1];
  const yFirst = ys[0];
  const labels = companies.map((c) => c.nameHe).join("، ");
  const parts: string[] = [];
  parts.push(
    `להלן ניסיון לענות על השאלה מה הנתונים מלמדים — פרשנות אוטומטית של שדות ה־JSON עבור ${labels}; אינה ייעוץ השקעות ואינה מחליפה דוחות מקוריים. חלון הנתונים: ${yFirst}–${yLast}.`
  );

  const lastRows = companies.map((c) => ({
    name: c.nameHe,
    row: rowForYear(c.data.metrics, yLast),
  }));

  const revRank = lastRows
    .map((x) => ({ name: x.name, rev: x.row?.revenueMUSD ?? null }))
    .filter((x): x is { name: string; rev: number } => x.rev != null && x.rev > 0)
    .sort((a, b) => b.rev - a.rev);
  if (revRank.length >= 2) {
    const hi = revRank[0];
    const lo = revRank[revRank.length - 1];
    if (hi.rev > lo.rev * 1.05) {
      parts.push(
        `ב־${yLast} הדיווח על הכנסות מוביל הוא ${hi.name} (~${fmtNum(hi.rev, 0)} מ״ד $) לעומת ${lo.name} (~${fmtNum(lo.rev, 0)} מ״ד $) בתחתית הקבוצה — פער משמעותי בסדר גודל המכירות.`
      );
    } else {
      parts.push(`ב־${yLast} הכנסות החברות הנבחרות דומות יחסית בסדר גודל.`);
    }
  }

  const nmRank = lastRows
    .map((x) => ({
      name: x.name,
      nm: netMarginPct(x.row?.revenueMUSD, x.row?.netIncomeMUSD),
    }))
    .filter((x): x is { name: string; nm: number } => x.nm != null && !Number.isNaN(x.nm))
    .sort((a, b) => b.nm - a.nm);
  if (nmRank.length >= 2 && Math.abs(nmRank[0].nm - nmRank[nmRank.length - 1].nm) >= 0.8) {
    parts.push(
      `רווח נקי יחסית להכנסות: ${nmRank[0].name} מובילה (~${nmRank[0].nm.toFixed(1)}%) לעומת ${nmRank[nmRank.length - 1].name} (~${nmRank[nmRank.length - 1].nm.toFixed(1)}%).`
    );
  }

  if (ys.length >= 2) {
    const cagrs: { name: string; c: number }[] = [];
    for (const c of companies) {
      const rF = rowForYear(c.data.metrics, yFirst);
      const rL = rowForYear(c.data.metrics, yLast);
      if (
        rF?.revenueMUSD == null ||
        rL?.revenueMUSD == null ||
        rF.revenueMUSD <= 0 ||
        rL.revenueMUSD <= 0
      )
        continue;
      const cagr = cagrAnnualPct(rF.revenueMUSD, rL.revenueMUSD, yFirst, yLast);
      if (cagr == null || !Number.isFinite(cagr)) continue;
      cagrs.push({ name: c.nameHe, c: cagr });
      const tp = revenueTrendPhrase(cagr);
      if (tp) parts.push(`${c.nameHe} (${yFirst}→${yLast}): ${tp} — CAGR הכנסות ~${cagr.toFixed(1)}% לשנה.`);
    }
    if (cagrs.length >= 2) {
      const sorted = [...cagrs].sort((a, b) => b.c - a.c);
      const a = sorted[0];
      const b = sorted[sorted.length - 1];
      if (Math.abs(a.c - b.c) >= 1.5) {
        parts.push(
          `פיזור צמיחה: ${a.name} עם CAGR מהיר יותר (~${a.c.toFixed(1)}%) לעומת ${b.name} (~${b.c.toFixed(1)}%) על חלון החפיפה.`
        );
      }
    }
  }

  parts.push(
    `מסקנה גסה: אין מדד יחיד — הכנסות, רווחיות, צבר ותזרים מספרים סיפורים שונים; השוו להערות בדוחות המקוריים.`
  );
  return parts;
}

/**
 * פרשנות מילולית: מגמות מול העבר של כל חברה, השוואה ישירה בשנה האחרונה, וסיכום זהיר.
 * מבוסס על שדות JSON בלבד — לא תחליף לקריאת דוח מלא.
 */
function buildCompareInsightParagraphs(
  iai: IaiPayload,
  elbit: IaiPayload,
  overlapYears: number[]
): string[] {
  const ys = [...overlapYears].sort((a, b) => a - b);
  const yLast = ys[ys.length - 1];
  const yFirst = ys[0];
  const iF = rowForYear(iai.metrics, yFirst);
  const iL = rowForYear(iai.metrics, yLast);
  const eF = rowForYear(elbit.metrics, yFirst);
  const eL = rowForYear(elbit.metrics, yLast);
  const parts: string[] = [];

  parts.push(
    `להלן ניסיון לענות על השאלה מה הנתונים מלמדים — לא רק לסכם מספרים, אלא לפרש מגמות והשוואות. זו פרשנות אוטומטית של שדות ה־JSON בלבד; אינה ייעוץ השקעות ואינה מחליפה את הדוחות המקוריים. חלון הנתונים: ${yFirst}–${yLast}.`
  );

  const revI = iL?.revenueMUSD;
  const revE = eL?.revenueMUSD;
  const netI = iL?.netIncomeMUSD;
  const netE = eL?.netIncomeMUSD;

  if (revI != null && revE != null && revI > 0 && revE > 0) {
    if (revE > revI * 1.03) {
      parts.push(
        `מול השנייה ב־${yLast}: אלביט דיווחה על הכנסות גבוהות משמעותית מתע״א — כלומר בספרים, מחזור מכירות דיווח גדול יותר (בהנחה ששיטות הכרה דומות במידה סבירה).`
      );
    } else if (revI > revE * 1.03) {
      parts.push(
        `מול השנייה ב־${yLast}: תע״א דיווחה על הכנסות גבוהות יותר מאלביט — יתרון בהיקף פעילות הדיווח.`
      );
    } else {
      parts.push(
        `מול השנייה ב־${yLast}: היקף ההכנסות בשני הדוחות דומה בסדר גודל — אין פער דרמטי בין החברות בקנה מידה מכירות.`
      );
    }
  }

  if (revI != null && revE != null && netI != null && netE != null) {
    const revLead = revE > revI ? "elbit" : revI > revE ? "iai" : null;
    const netLead = netE > netI ? "elbit" : netI > netE ? "iai" : null;
    if (revLead && netLead && revLead !== netLead) {
      if (revLead === "elbit" && netLead === "iai") {
        parts.push(
          `נקודה מרכזית: ב־${yLast} הכנסות אלביט גבוהות יותר, אך הרווח הנקי המדווח של תע״א גבוה יותר — כלומר אין התאמה אוטומטית בין ״מי גדולה יותר״ לבין ״מי הרוויחה יותר בדולרים״; כדאי להסביר את הפער דרך שוליים, פריטים חד־פעמיים והערות בדוח.`
        );
      } else {
        parts.push(
          `נקודה מרכזית: ב־${yLast} הכנסות תע״א גבוהות יותר, אך הרווח הנקי המדווח של אלביט גבוה יותר — שווה לבדוק בהערות לדוח מה מניע את הפער (שוליים, מבנה, אירועים).`
        );
      }
    }
  }

  const nmI = netMarginPct(revI, netI);
  const nmE = netMarginPct(revE, netE);
  if (nmI != null && nmE != null) {
    if (Math.abs(nmI - nmE) < 0.6) {
      parts.push(
        `רווחיות נקייה יחסית להכנסות דומה: שולי רווח נקי בערך ~${nmI.toFixed(1)}% אצל תע״א מול ~${nmE.toFixed(1)}% אצל אלביט — שתיהן ממירות מכירות לרווח נקי ברמה דומה בשנה הזו.`
      );
    } else if (nmI > nmE) {
      parts.push(
        `לעומת זאת, שולי הרווח הנקי של תע״א גבוהים יותר (~${nmI.toFixed(1)}% מול ~${nmE.toFixed(1)}%) — כלומר יחסית להכנסות, נשאר יותר רווח נקי אצל תע״א ב־${yLast}.`
      );
    } else {
      parts.push(
        `שולי הרווח הנקי של אלביט גבוהים יותר (~${nmE.toFixed(1)}% מול ~${nmI.toFixed(1)}%) — כלומר יעילות נקייה טובה יותר יחסית להכנסות ב־${yLast} בהשוואה לתע״א.`
      );
    }
  }

  const omI = operatingMarginPct(revI, iL?.operatingIncomeMUSD);
  const omE = operatingMarginPct(revE, eL?.operatingIncomeMUSD);
  if (omI != null && omE != null && Math.abs(omI - omE) >= 1) {
    parts.push(
      omI > omE
        ? `ברווח התפעולי ממכירות, תע״א מובילה ב־${yLast} (~${omI.toFixed(1)}% מול ~${omE.toFixed(1)}%) — הליבה התפעולית משאירה יותר מהמכירות אחרי עלות תפעול (לפני מימון ומסים).`
        : `ברווח התפעולי ממכירות, אלביט מובילה ב־${yLast} (~${omE.toFixed(1)}% מול ~${omI.toFixed(1)}%).`
    );
  }

  const ocfI = iL?.operatingCashFlowMUSD;
  const ocfE = eL?.operatingCashFlowMUSD;
  if (ocfI != null && ocfE != null && ocfE !== 0) {
    const ratio = ocfI / ocfE;
    if (ratio > 1.5) {
      parts.push(
        `תזרים מזומנים מפעילות שוטפת ב־${yLast} גבוה בהרבה אצל תע״א לעומת אלביט (לפי המספרים בקובץ). פער כזה יכול לנבוע ממחזור הון חוזר, עיתוי גבייה, פרויקטים או שוני במבנה — כדאי לקרוא את הערות התזרים בדוח ולא לפרש כ״בריאות״ בלי הקשר.`
      );
    } else if (ratio < 0.67) {
      parts.push(
        `תזרים תפעולי גבוה יותר אצל אלביט לעומת תע״א ב־${yLast} — שווה להצליב עם שינוי בהון חוזר והשקעות בדוח המלא.`
      );
    }
  }

  const brI = backlogToRevenueRatio(iL?.backlogMUSD, revI);
  const brE = backlogToRevenueRatio(eL?.backlogMUSD, revE);
  if (brI != null && brE != null) {
    if (brI > brE * 1.12) {
      parts.push(
        `יחס צבר־הזמנות להכנסות גבוה יותר אצל תע״א — נראות לעבודה עתידית גדולה יותר ביחס למחזור שנתי (בהנחה שחישוב הצבר דומה).`
      );
    } else if (brE > brI * 1.12) {
      parts.push(
        `יחס צבר־הזמנות להכנסות גבוה יותר אצל אלביט — פרופיל דומה של ויזיביליות עתידית יחסית חזקה.`
      );
    }
  }

  if (ys.length >= 2 && iF && iL && eF && eL) {
    const cI =
      iF.revenueMUSD != null &&
      iL.revenueMUSD != null &&
      iF.revenueMUSD > 0 &&
      iL.revenueMUSD > 0
        ? cagrAnnualPct(iF.revenueMUSD, iL.revenueMUSD, yFirst, yLast)
        : null;
    const cE =
      eF.revenueMUSD != null &&
      eL.revenueMUSD != null &&
      eF.revenueMUSD > 0 &&
      eL.revenueMUSD > 0
        ? cagrAnnualPct(eF.revenueMUSD, eL.revenueMUSD, yFirst, yLast)
        : null;

    const nmIF = netMarginPct(iF.revenueMUSD, iF.netIncomeMUSD);
    const nmIL = netMarginPct(iL.revenueMUSD, iL.netIncomeMUSD);
    const nmEF = netMarginPct(eF.revenueMUSD, eF.netIncomeMUSD);
    const nmEL = netMarginPct(eL.revenueMUSD, eL.netIncomeMUSD);

    const tpI = revenueTrendPhrase(cI);
    if (tpI != null && cI != null) {
      parts.push(
        `תע״א ביחס לעצמה (${yFirst}→${yLast}): ${tpI} — קצב CAGR על הכנסות כ־${cI.toFixed(1)}% בשנה בממוצע.`
      );
    }
    const dNmI = nmIF != null && nmIL != null ? nmIL - nmIF : null;
    if (dNmI != null && Math.abs(dNmI) >= 0.35) {
      parts.push(
        dNmI > 0
          ? `באותה תקופה שולי הרווח הנקי של תע״א התרחבו בכ־${dNmI.toFixed(1)} נקודות אחוז — הרווחיות הנקייה יחסית להכנסות השתפרה.`
          : `באותה תקופה שולי הרווח הנקי של תע״א צנחו בכ־${Math.abs(dNmI).toFixed(1)} נקודות אחוז.`
      );
    }

    const tpE = revenueTrendPhrase(cE);
    if (tpE != null && cE != null) {
      parts.push(
        `אלביט ביחס לעצמה (${yFirst}→${yLast}): ${tpE} — קצב CAGR על הכנסות כ־${cE.toFixed(1)}% בשנה בממוצע.`
      );
    }
    const dNmE = nmEF != null && nmEL != null ? nmEL - nmEF : null;
    if (dNmE != null && Math.abs(dNmE) >= 0.35) {
      parts.push(
        dNmE > 0
          ? `באותה תקופה שולי הרווח הנקי של אלביט התרחבו בכ־${dNmE.toFixed(1)} נקודות אחוז.`
          : `באותה תקופה שולי הרווח הנקי של אלביט צנחו בכ־${Math.abs(dNmE).toFixed(1)} נקודות אחוז.`
      );
    }

    if (cI != null && cE != null && Math.abs(cI - cE) >= 1.2) {
      parts.push(
        cI > cE
          ? `כשמשווים את שני קצוות החלון, צמיחת ההכנסות של תע״א (CAGR) מהירה יותר מזו של אלביט — כלומר בקנה מידה, תע״א האיצה יותר לאורך תקופת החפיפה.`
          : `כשמשווים את שני קצוות החלון, צמיחת ההכנסות של אלביט (CAGR) מהירה יותר — בקנה מידה, אלביט האיצה יותר לאורך תקופת החפיפה.`
      );
    }
  }

  parts.push(
    `מסקנה גסה: אין מדד יחיד לשאלה מי מתפקדת טוב יותר — הכנסות, רווחיות, צבר ותזרים מספרים סיפורים שונים, ולעיתים סותרים. השתמשו בגרף הפרמטרים ובטבלה המסכמת כדי לראות כל מדד לאורך זמן, והשוו להערות המקור בדוחות.`
  );

  return parts;
}

function RadarCompareTooltip(props: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RadarDatum }>;
  slugs: CompareCompanySlug[];
}) {
  const { active, payload, slugs } = props;
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="compare-radar-tooltip">
      <p className="compare-radar-tooltip__title">{d.metric}</p>
      {slugs.map((slug) => {
        const meta = COMPARE_COMPANY_META.find((c) => c.slug === slug);
        const score = d[slug];
        const abs = d[`${slug}Abs`];
        if (typeof score !== "number" || typeof abs !== "string") return null;
        return (
          <p key={slug} className="compare-radar-tooltip__line">
            <span className={`compare-radar-tooltip__tag ${meta?.radarTagClass ?? ""}`}>{meta?.shortName ?? slug}</span>
            ציון יחסי (0–100): <strong>{fmtNum(score, 1)}</strong>
            <span className="muted"> — בפועל: {abs}</span>
          </p>
        );
      })}
      <p className="compare-radar-tooltip__hint">
        <strong>למה לפעמים 0?</strong> בכל ציר, החברה עם הערך <em>הנמוך יותר</em> מקבלת 0 והגבוהה 100 — זו
        השוואה יחסית בין הנבחרות בשנה שנבחרה, לא סכום כספי ולא &quot;אין נתונים&quot;. כשהערכים שווים — 50 לכל אחת.
      </p>
    </div>
  );
}

type SelectedCompany = (typeof COMPARE_COMPANY_META)[number] & { data: IaiPayload };

function emptyPayloadRecord(): Record<CompareCompanySlug, IaiPayload | null> {
  return Object.fromEntries(ALL_COMPARE_SLUGS.map((s) => [s, null])) as Record<
    CompareCompanySlug,
    IaiPayload | null
  >;
}

export function ComparePage() {
  const [payloadBySlug, setPayloadBySlug] = useState<Record<CompareCompanySlug, IaiPayload | null>>(
    emptyPayloadRecord
  );
  const [selectedSlugs, setSelectedSlugs] = useState<CompareCompanySlug[]>(() => [...ALL_COMPARE_SLUGS]);
  const [selectedMetricId, setSelectedMetricId] = useState("revenueMUSD");
  const [scatterXId, setScatterXId] = useState("revenueMUSD");
  const [scatterYId, setScatterYId] = useState("netIncomeMUSD");

  const toggleSlug = (slug: CompareCompanySlug) => {
    setSelectedSlugs((prev) => {
      const next = orderSelectedSlugs(prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
      if (next.length === 0) return [...ALL_COMPARE_SLUGS];
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const paths: Record<CompareCompanySlug, string> = {
      iai: "/data/iai.json",
      elbit: "/data/elbit.json",
      rafael: "/data/rafael.json",
      lockheed: "/data/lockheed.json",
      rtx: "/data/rtx.json",
      leonardo: "/data/leonardo.json",
      bae: "/data/bae.json",
      rheinmetall: "/data/rheinmetall.json",
      thales: "/data/thales.json",
      gd: "/data/gd.json",
      northrop: "/data/northrop.json",
      l3harris: "/data/l3harris.json",
      boeing: "/data/boeing.json",
      embraer: "/data/embraer.json",
      saab: "/data/saab.json",
    };
    Promise.all(
      ALL_COMPARE_SLUGS.map((slug) =>
        fetch(paths[slug], { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(slug);
          return r.json() as Promise<IaiPayload>;
        })
      )
    )
      .then((list) => {
        if (!cancelled) {
          const next = emptyPayloadRecord();
          ALL_COMPARE_SLUGS.forEach((slug, i) => {
            next[slug] = list[i];
          });
          setPayloadBySlug(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayloadBySlug(
            Object.fromEntries(
              COMPARE_COMPANY_META.map((c) => [c.slug, EMPTY_PAYLOAD(c.slug, c.nameHe)])
            ) as Record<CompareCompanySlug, IaiPayload | null>
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allPayloadsReady = ALL_COMPARE_SLUGS.every((s) => payloadBySlug[s] != null);

  const selectedCompanies = useMemo((): SelectedCompany[] => {
    if (!allPayloadsReady) return [];
    return orderSelectedSlugs(selectedSlugs).map((slug) => {
      const meta = COMPARE_COMPANY_META.find((c) => c.slug === slug)!;
      return { ...meta, data: payloadBySlug[slug]! };
    });
  }, [allPayloadsReady, selectedSlugs, payloadBySlug]);

  const overlapYears = useMemo(() => {
    if (selectedCompanies.length < 2) return [];
    return unionCompareYears(selectedCompanies.map((c) => c.data));
  }, [selectedCompanies]);

  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    if (year == null && overlapYears.length) setYear(overlapYears[0]);
  }, [overlapYears, year]);

  useEffect(() => {
    if (year != null && overlapYears.length > 0 && !overlapYears.includes(year)) {
      setYear(overlapYears[0]);
    }
  }, [overlapYears, year]);

  const canCompare = selectedCompanies.length >= 2;

  const paramTrendRows = useMemo(() => {
    if (!canCompare || !overlapYears.length) return [];
    const ys = overlapYears.slice().sort((a, b) => a - b);
    return ys.map((y) => {
      const row: Record<string, number | null> & { year: number } = { year: y };
      for (const c of selectedCompanies) {
        const r = rowForYear(c.data.metrics, y);
        row[c.slug] = getMetricValue(r, selectedMetricId);
      }
      return row;
    });
  }, [canCompare, selectedCompanies, overlapYears, selectedMetricId]);

  const paramNarrative = useMemo(() => {
    if (!canCompare || overlapYears.length === 0) return null;
    const meaning = METRIC_MEANING[selectedMetricId] ?? DEFAULT_METRIC_MEANING;
    const companiesArg = selectedCompanies.map((c) => ({ slug: c.slug, nameHe: c.nameHe, data: c.data }));
    const analysis = buildParamTrendAnalysisMulti(selectedMetricId, companiesArg, overlapYears);
    return { meaning, analysis };
  }, [canCompare, selectedCompanies, overlapYears, selectedMetricId]);

  const scatterBySlug = useMemo(() => {
    const map = Object.fromEntries(
      ALL_COMPARE_SLUGS.map((s) => [s, [] as { x: number; y: number; year: number }[]])
    ) as Record<CompareCompanySlug, { x: number; y: number; year: number }[]>;
    if (!canCompare || !overlapYears.length) return map;
    const ys = overlapYears.slice().sort((a, b) => a - b);
    for (const c of selectedCompanies) {
      const out: { x: number; y: number; year: number }[] = [];
      for (const y of ys) {
        const row = rowForYear(c.data.metrics, y);
        const vx = getMetricValue(row, scatterXId);
        const vy = getMetricValue(row, scatterYId);
        if (vx != null && vy != null && !Number.isNaN(vx) && !Number.isNaN(vy)) {
          out.push({ x: vx, y: vy, year: y });
        }
      }
      map[c.slug] = out;
    }
    return map;
  }, [canCompare, selectedCompanies, overlapYears, scatterXId, scatterYId]);

  const matrixRows = useMemo(() => {
    if (!canCompare || !overlapYears.length) return [];
    const ys = overlapYears.slice().sort((a, b) => b - a);
    return ys.map((y) => {
      const cells: Record<string, Partial<Record<CompareCompanySlug, string>>> = {};
      for (const def of METRIC_DEFS) {
        const cell: Partial<Record<CompareCompanySlug, string>> = {};
        for (const c of selectedCompanies) {
          const r = rowForYear(c.data.metrics, y);
          const v = getMetricValue(r, def.id);
          cell[c.slug] = fmtMetricCell(v, def);
        }
        cells[def.id] = cell;
      }
      return { year: y, cells };
    });
  }, [canCompare, selectedCompanies, overlapYears]);

  const rowsForSelectedYear = useMemo(() => {
    if (year == null || !canCompare) return null;
    const m = new Map<CompareCompanySlug, MetricRow | undefined>();
    for (const c of selectedCompanies) {
      m.set(c.slug, rowForYear(c.data.metrics, year));
    }
    return m;
  }, [year, canCompare, selectedCompanies]);

  const groupedMain = useMemo(() => {
    if (!rowsForSelectedYear) return [];
    type BarRow = { name: string } & Record<CompareCompanySlug, number | null>;
    const out: BarRow[] = [];
    const add = (name: string, pick: (r: MetricRow) => number | null | undefined) => {
      const row = { name } as BarRow;
      let any = false;
      for (const c of selectedCompanies) {
        const r = rowsForSelectedYear.get(c.slug);
        const v = r == null ? null : pick(r);
        const num = v != null && !Number.isNaN(v) ? v : null;
        row[c.slug] = num;
        if (num != null) any = true;
      }
      if (any) out.push(row);
    };
    add("הכנסות", (r) => r.revenueMUSD);
    add("רווח נקי", (r) => r.netIncomeMUSD);
    add("רווח תפעולי", (r) => r.operatingIncomeMUSD);
    add("EBITDA", (r) => r.ebitdaMUSD);
    add("תזרים חופשי (פשוט)", (r) => freeCashFlowMUSD(r.operatingCashFlowMUSD, r.capexMUSD));
    return out;
  }, [rowsForSelectedYear, selectedCompanies]);

  const groupedBacklog = useMemo(() => {
    if (!rowsForSelectedYear) return [];
    type BarRow = { name: string } & Record<CompareCompanySlug, number | null>;
    const row = { name: "צבר הזמנות" } as BarRow;
    let any = false;
    for (const c of selectedCompanies) {
      const r = rowsForSelectedYear.get(c.slug);
      const v = r?.backlogMUSD;
      const num = v != null && !Number.isNaN(v) ? v : null;
      row[c.slug] = num;
      if (num != null) any = true;
    }
    return any ? [row] : [];
  }, [rowsForSelectedYear, selectedCompanies]);

  const horizontalBars = useMemo(() => groupedMain, [groupedMain]);

  const radarData = useMemo((): RadarDatum[] => {
    if (!rowsForSelectedYear) return [];
    const addAxis = (label: string, extract: (r: MetricRow) => number | null | undefined) => {
      const vals = selectedCompanies.map((c) => {
        const r = rowsForSelectedYear.get(c.slug);
        return r == null ? null : extract(r);
      });
      const n = normMany(vals);
      if (!n) return null;
      const datum: RadarDatum = { metric: label };
      selectedCompanies.forEach((c, idx) => {
        datum[c.slug] = Math.round(n[idx] * 10) / 10;
        datum[`${c.slug}Abs`] = fmtMusdCell(vals[idx]);
      });
      return datum;
    };
    const axes: RadarDatum[] = [];
    const push = (d: RadarDatum | null) => {
      if (d) axes.push(d);
    };
    push(addAxis("הכנסות", (r) => r.revenueMUSD));
    push(addAxis("רווח נקי", (r) => r.netIncomeMUSD));
    push(addAxis("EBITDA", (r) => r.ebitdaMUSD));
    push(addAxis("צבר הזמנות", (r) => r.backlogMUSD));
    push(addAxis("תזרים תפעולי", (r) => r.operatingCashFlowMUSD));
    push(
      addAxis("תזרים חופשי (פשוט)", (r) => freeCashFlowMUSD(r.operatingCashFlowMUSD, r.capexMUSD))
    );
    return axes;
  }, [rowsForSelectedYear, selectedCompanies]);

  const snapshotTableRows = useMemo(() => {
    if (!rowsForSelectedYear) return [];
    type Row = { key: string; bySlug: Record<CompareCompanySlug, number | null> };
    const defs: { key: string; get: (r: MetricRow) => number | null | undefined }[] = [
      { key: "הכנסות", get: (r) => r.revenueMUSD },
      { key: "צבר הזמנות", get: (r) => r.backlogMUSD },
      { key: "רווח נקי", get: (r) => r.netIncomeMUSD },
      { key: "רווח תפעולי", get: (r) => r.operatingIncomeMUSD },
      { key: "EBITDA", get: (r) => r.ebitdaMUSD },
      { key: "תזרים תפעולי", get: (r) => r.operatingCashFlowMUSD },
      {
        key: "תזרים חופשי (פשוט)",
        get: (r) => freeCashFlowMUSD(r.operatingCashFlowMUSD, r.capexMUSD),
      },
    ];
    const out: Row[] = [];
    for (const { key, get } of defs) {
      const bySlug = {} as Record<CompareCompanySlug, number | null>;
      for (const c of selectedCompanies) {
        const r = rowsForSelectedYear.get(c.slug);
        const v = r == null ? null : get(r);
        bySlug[c.slug] = v != null && !Number.isNaN(v) ? v : null;
      }
      if (selectedCompanies.some((c) => bySlug[c.slug] != null)) out.push({ key, bySlug });
    }
    return out;
  }, [rowsForSelectedYear, selectedCompanies]);

  const pairwiseDeltaLabel =
    selectedCompanies.length === 2
      ? `${selectedCompanies[0].shortName} − ${selectedCompanies[1].shortName}`
      : null;

  const compareInsights = useMemo(() => {
    if (!allPayloadsReady || overlapYears.length === 0 || selectedCompanies.length < 2) return null;
    const slugSet = new Set(selectedSlugs);
    if (slugSet.size === 2 && slugSet.has("iai") && slugSet.has("elbit")) {
      const iai = payloadBySlug.iai!;
      const elbit = payloadBySlug.elbit!;
      return buildCompareInsightParagraphs(iai, elbit, overlapYears);
    }
    const comps = selectedCompanies.map((c) => ({ slug: c.slug, nameHe: c.nameHe, data: c.data }));
    return buildCompareInsightParagraphsMulti(comps, overlapYears);
  }, [allPayloadsReady, payloadBySlug, overlapYears, selectedCompanies, selectedSlugs]);

  const executiveBrief = useMemo(() => {
    if (!canCompare || selectedCompanies.length < 2) return null;
    const strictYears = intersectOverlapYears(selectedCompanies.map((c) => c.data));
    if (strictYears.length < 2) return null;
    const ys = strictYears.sort((a, b) => a - b);
    const yFirst = ys[0];
    const yLast = ys[ys.length - 1];

    const mkCard = (
      name: string,
      growth: number | null,
      profit: number | null,
      cash: number | null,
      resilience: number | null
    ) => {
      const sGrowth = growth == null || Number.isNaN(growth) ? null : clampScore(1 + growth / 2.5);
      const sProfit = scoreFromMargin(profit);
      const sCash = scoreFromMargin(cash);
      const sRes = scoreFromRatio(resilience);
      const vals = [sGrowth, sProfit, sCash, sRes].filter((v): v is number => v != null);
      const overall = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        name,
        overall,
        items: [
          { k: "Growth", v: sGrowth, raw: growth, rawFmt: growth != null ? `${growth.toFixed(1)}% CAGR` : "—" },
          { k: "Profitability", v: sProfit, raw: profit, rawFmt: profit != null ? `${profit.toFixed(1)}% NM` : "—" },
          { k: "Cash Conversion", v: sCash, raw: cash, rawFmt: cash != null ? `${cash.toFixed(1)}% OCF/Revenue` : "—" },
          { k: "Resilience", v: sRes, raw: resilience, rawFmt: resilience != null ? `${resilience.toFixed(2)} Backlog/Revenue` : "—" },
        ],
      };
    };

    const cards = selectedCompanies.map((c) => {
      const rF = rowForYear(c.data.metrics, yFirst);
      const rL = rowForYear(c.data.metrics, yLast);
      if (!rF || !rL) return null;
      const growth =
        rF.revenueMUSD != null &&
        rL.revenueMUSD != null &&
        rF.revenueMUSD > 0 &&
        rL.revenueMUSD > 0
          ? cagrAnnualPct(rF.revenueMUSD, rL.revenueMUSD, yFirst, yLast)
          : null;
      const profit = netMarginPct(rL.revenueMUSD, rL.netIncomeMUSD);
      const cash = rL.revenueMUSD ? ((rL.operatingCashFlowMUSD ?? 0) / rL.revenueMUSD) * 100 : null;
      const resilience = backlogToRevenueRatio(rL.backlogMUSD, rL.revenueMUSD);
      return mkCard(c.shortName, growth, profit, cash, resilience);
    });
    if (cards.some((x) => x == null)) return null;
    return { yearsLabel: `${yFirst}-${yLast}`, cards: cards as NonNullable<(typeof cards)[number]>[] };
  }, [canCompare, selectedCompanies]);

  const marketTrendRows = useMemo((): MarketTrendRow[] => {
    if (!allPayloadsReady || overlapYears.length === 0) return [];
    const ys = [...overlapYears].sort((a, b) => a - b);
    return ys.map((y) => {
      const bySlug = emptyTrendBySlug();
      for (const slug of ALL_COMPARE_SLUGS) {
        const pl = payloadBySlug[slug];
        const m = pl ? rowForYear(pl.metrics, y) : undefined;
        bySlug[slug] = {
          expenses: {
            rd: m?.researchDevelopmentMUSD ?? null,
            marketing: m?.marketingSalesMUSD ?? null,
            ga: m?.generalAdminMUSD ?? null,
          },
          regions: m?.salesByRegionPct,
        };
      }
      return { year: y, bySlug };
    });
  }, [allPayloadsReady, overlapYears, payloadBySlug]);

  const expenseInsightsBySlug = useMemo(() => {
    const out: Partial<Record<CompareCompanySlug, string[]>> = {};
    for (const c of COMPARE_COMPANY_META) {
      const lines = expenseInsightLines(c.nameHe, buildExpensePoints(marketTrendRows, c.slug));
      if (lines.length > 0) out[c.slug] = lines;
    }
    return out;
  }, [marketTrendRows]);

  const hasRegionData = marketTrendRows.some((r) =>
    ALL_COMPARE_SLUGS.some((slug) => r.bySlug[slug].regions != null)
  );

  const regionSeriesBySlug = useMemo(() => {
    const o = {} as Record<CompareCompanySlug, RegionYearPoint[]>;
    for (const slug of ALL_COMPARE_SLUGS) {
      o[slug] = regionSeriesFromTrendRows(marketTrendRows, slug);
    }
    return o;
  }, [marketTrendRows]);

  const stackRowsBySlug = useMemo(() => {
    const o = {} as Record<CompareCompanySlug, ReturnType<typeof stackRowsFromSeries>>;
    for (const slug of ALL_COMPARE_SLUGS) {
      o[slug] = stackRowsFromSeries(regionSeriesBySlug[slug]);
    }
    return o;
  }, [regionSeriesBySlug]);

  const regionInsightsBySlug = useMemo(() => {
    const o = {} as Record<CompareCompanySlug, { long: string[]; yoy: string[] }>;
    for (const c of COMPARE_COMPANY_META) {
      const series = regionSeriesBySlug[c.slug];
      o[c.slug] = {
        long: regionLongHorizonLines(c.nameHe, series),
        yoy: regionYoyLines(c.nameHe, series),
      };
    }
    return o;
  }, [regionSeriesBySlug]);

  const hasRegionStackCharts = ALL_COMPARE_SLUGS.some((slug) => stackRowsBySlug[slug].length >= 2);

  const radarSlugsForTooltip = useMemo(() => selectedCompanies.map((c) => c.slug), [selectedCompanies]);
  const radarMissingSelected = useMemo(
    () =>
      selectedCompanies.filter((c) => !radarData.some((d) => typeof d[c.slug] === "number")),
    [selectedCompanies, radarData]
  );
  const domesticExportSeries = useMemo(() => {
    const out = Object.fromEntries(ALL_COMPARE_SLUGS.map((s) => [s, [] as DomesticExportPoint[]])) as Record<
      CompareCompanySlug,
      DomesticExportPoint[]
    >;
    if (!canCompare || !overlapYears.length) return out;
    for (const c of selectedCompanies) {
      const rows: DomesticExportPoint[] = [];
      for (const y of [...overlapYears].sort((a, b) => a - b)) {
        const row = rowForYear(c.data.metrics, y);
        const de = domesticExportFromRow(row);
        if (!de) continue;
        rows.push({ year: y, domestic: de.domestic, export: de.export });
      }
      out[c.slug] = rows;
    }
    return out;
  }, [canCompare, overlapYears, selectedCompanies]);

  const coverageRows = useMemo(() => {
    if (!canCompare || !overlapYears.length) return [];
    return selectedCompanies.map((c) => {
      const missingInRows = new Set<string>();
      const yearsWithoutRow: number[] = [];
      for (const y of overlapYears) {
        const row = rowForYear(c.data.metrics, y);
        if (!row) {
          yearsWithoutRow.push(y);
          continue;
        }
        for (const def of METRIC_DEFS) {
          const v = getMetricValue(row, def.id);
          if (v == null || Number.isNaN(v)) missingInRows.add(def.label);
        }
      }
      return {
        slug: c.slug,
        shortName: c.shortName,
        yearsWithoutRow: yearsWithoutRow.sort((a, b) => a - b),
        missing: [...missingInRows],
      };
    });
  }, [canCompare, overlapYears, selectedCompanies]);

  const selDef = metricDef(selectedMetricId);
  const xDef = metricDef(scatterXId);
  const yDef = metricDef(scatterYId);

  if (!allPayloadsReady) {
    return (
      <>
        <SiteNav />
        <p className="muted">טוען נתונים להשוואה…</p>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <header>
        <p className="badge">דף השוואה</p>
        <h1>השוואת חברות</h1>
        <p className="muted">
          נתונים מ־<code className="file-path">iai.json</code>, <code className="file-path">elbit.json</code>,{" "}
          <code className="file-path">rafael.json</code>, <code className="file-path">lockheed.json</code>,{" "}
          <code className="file-path">rtx.json</code>, <code className="file-path">leonardo.json</code>,{" "}
          <code className="file-path">bae.json</code>,           <code className="file-path">rheinmetall.json</code>,{" "}
          <code className="file-path">thales.json</code>, <code className="file-path">gd.json</code>,{" "}
          <code className="file-path">northrop.json</code>, <code className="file-path">l3harris.json</code>,{" "}
          <code className="file-path">boeing.json</code>, <code className="file-path">embraer.json</code>,{" "}
          <code className="file-path">saab.json</code> — בוחרים חברות,
          רואים חפיפת שנים משותפת, השוואה לפי פרמטרים,
          מטריצה, פיזור, ואז (בסרגל השנה) עמודות, רדאר וטבלת ערכים.
        </p>
        <div className="compare-company-picker" role="group" aria-label="בחירת חברות להשוואה">
          <span className="compare-toolbar__label">חברות להשוואה:</span>
          {COMPARE_COMPANY_META.map((c) => (
            <label key={c.slug} className="compare-company-picker__item">
              <input
                type="checkbox"
                checked={selectedSlugs.includes(c.slug)}
                onChange={() => toggleSlug(c.slug)}
              />
              {c.nameHe}
            </label>
          ))}
          <button type="button" className="compare-company-picker__btn" onClick={() => setSelectedSlugs([...ALL_COMPARE_SLUGS])}>
            בחר הכל
          </button>
          <button
            type="button"
            className="compare-company-picker__btn"
            onClick={() => setSelectedSlugs(orderSelectedSlugs(["iai", "elbit"]))}
          >
            רק תע״א ואלביט
          </button>
        </div>
        {!canCompare && (
          <p className="muted">סמנו לפחות שתי חברות כדי להפעיל השוואות וגרפים.</p>
        )}
        {canCompare && overlapYears.length > 0 && (
          <div className="compare-param-narrative">
            <p className="compare-param-narrative__p">
              <span className="compare-param-narrative__k">בדיקת כיסוי פרמטרים:</span> טווח שנים באתר{" "}
              {Math.min(...overlapYears)}–{Math.max(...overlapYears)} (איחוד כל החברות הנבחרות — שנה בלי דוח אצל
              חברה מסוימת תופיע כ־— בגרפים).
            </p>
            {coverageRows.map((r) => (
              <p key={r.slug} className="compare-param-narrative__p">
                <span className="compare-param-narrative__k">{r.shortName}:</span>{" "}
                {r.yearsWithoutRow.length > 0 && (
                  <span>
                    אין שורת נתונים לשנים {r.yearsWithoutRow.join(", ")}.{" "}
                  </span>
                )}
                {r.missing.length === 0
                  ? r.yearsWithoutRow.length === 0
                    ? "קיים בכל הפרמטרים בכל השנים."
                    : "בשאר השנים — קיים בכל הפרמטרים."
                  : `בשנים שיש שורה — חסר בפרמטרים: ${r.missing.join(" | ")}`}
              </p>
            ))}
          </div>
        )}
        {compareInsights && compareInsights.length > 0 && (
          <div className="compare-insights">
            <h2 className="compare-insights__h">מה הנתונים מלמדים?</h2>
            <p className="compare-insights__sub muted">
              פרשנות מילולית (מגמות, השוואה ישירה, מסקנה זהירה) — לא ייעוץ השקעות.
            </p>
            {compareInsights.map((paragraph, i) => (
              <p key={i} className="compare-insights__p">
                {paragraph}
              </p>
            ))}
          </div>
        )}
        {executiveBrief && (
          <section className="compare-exec">
            <h2 className="compare-exec__h">Executive Brief (McKinsey-style)</h2>
            <p className="compare-exec__sub muted">
              דירוג יחסי 1-5 לפי ארבעה צירים: Growth, Profitability, Cash Conversion, Resilience
              (חלון {executiveBrief.yearsLabel}).
            </p>
            <div className="compare-exec__grid">
              {executiveBrief.cards.map((c) => (
                <article key={c.name} className="compare-exec-card">
                  <h3 className="compare-exec-card__title">{c.name}</h3>
                  <p className="compare-exec-card__overall">
                    ציון כולל: {c.overall != null ? c.overall.toFixed(1) : "—"} / 5
                  </p>
                  <ul className="compare-exec-card__list">
                    {c.items.map((it) => (
                      <li key={it.k}>
                        <span>{it.k}</span>
                        <strong>{it.v != null ? it.v.toFixed(1) : "—"}</strong>
                        <span className="muted">({it.rawFmt})</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}
      </header>

      {canCompare && overlapYears.length > 0 && (
        <>
          <section className="compare-demo" aria-labelledby="compare-param">
            <h2 id="compare-param">השוואה לפי פרמטרים (כל השנים הזמינות)</h2>
            <p className="muted compare-demo__desc">
              בוחרים מדד אחד — רואים את החברות הנבחרות לאורך זמן (קו) וטבלה לפי שנה. שנה שמופיעה רק אצל חלק מהחברות
              תציג מקף אצל מי שאין לו דוח לשנה זו.
            </p>
            <div className="compare-toolbar compare-toolbar--inline">
              <label htmlFor="compare-metric" className="compare-toolbar__label">
                פרמטר:
              </label>
              <select
                id="compare-metric"
                className="compare-toolbar__select compare-toolbar__select--wide"
                value={selectedMetricId}
                onChange={(e) => setSelectedMetricId(e.target.value)}
              >
                {METRIC_DEFS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            {paramNarrative && (
              <div className="compare-param-narrative" aria-live="polite">
                <p className="compare-param-narrative__p">
                  <span className="compare-param-narrative__k">משמעות:</span> {paramNarrative.meaning}
                </p>
                <p className="compare-param-narrative__p">
                  <span className="compare-param-narrative__k">ניתוח הגרף:</span> {paramNarrative.analysis}
                </p>
              </div>
            )}
            <div className="chart-wrap chart-wrap--medium">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paramTrendRows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                  <YAxis tick={{ fill: "#9aa8bc" }} />
                  <Tooltip
                    contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                    formatter={(v: number) => fmtMetricCell(v, selDef)}
                    labelFormatter={(l) => `שנה ${l}`}
                  />
                  <Legend wrapperStyle={{ direction: "rtl" }} />
                  {selectedCompanies.map((c) => (
                    <Line
                      key={c.slug}
                      type="monotone"
                      dataKey={c.slug}
                      name={c.shortName}
                      stroke={c.color}
                      strokeWidth={2}
                      dot
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-scroll compare-param-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>שנה</th>
                    {selectedCompanies.map((c) => (
                      <th key={c.slug}>{c.shortName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paramTrendRows
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        {selectedCompanies.map((c) => (
                          <td key={c.slug}>{fmtMetricCell(row[c.slug] as number | null, selDef)}</td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="compare-demo" aria-labelledby="compare-market-trends">
            <h2 id="compare-market-trends">פרמטר חדש: מגמות בשווקים</h2>
            <p className="muted compare-demo__desc">
              שני ממדים לאורך זמן: (1) תובנות אוטומטיות על הוצאות תפעוליות נבחרות (מו״פ, מכירה ושיווק, הנהלה וכלליות),
              (2) תמהיל שווקים — גרף ערימה שמראה איך משתנה חלק כל אזור מסך המכירות, ורשימה שממיינת אוטומטית מי «עלה»
              ומי «ירד» (לפי גודל השינוי). אלביט — 20-F; תע״א — ביאורים ודוח 2025 (סעיף 2.5.2 לשנה שהסתיימה ב־31.12.2025).
            </p>

            <h3 className="chart-section-title">תובנות אוטומטיות: הוצאות תפעוליות נבחרות</h3>
            <div className="market-region-insights-grid">
              {COMPARE_COMPANY_META.filter(
                (c) => selectedSlugs.includes(c.slug) && (expenseInsightsBySlug[c.slug]?.length ?? 0) > 0
              ).map((c) => (
                <article key={c.slug} className="market-region-insights-card">
                  <h4 className="market-region-insights-card__title">{c.shortName} — מו״פ / שיווק / הנהלה</h4>
                  <ul className="market-region-insights-list">
                    {(expenseInsightsBySlug[c.slug] ?? []).map((line, i) => (
                      <li
                        key={`${c.slug}-exp-${i}`}
                        className={line.includes(":") ? "market-region-insights-list__lead" : undefined}
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <h3 className="chart-section-title">איפה מוכרים? (פילוח אזורי)</h3>
            {hasRegionData ? (
              <>
                <p className="muted compare-market-note compare-market-note--tight">
                  גובה העמודה בכל שנה = 100% מהמכירות; כל שכבת צבע היא חלק האזור. הרשימות ממיינות את האזורים לפי עוצמת
                  השינוי (מהגדול לקטן).
                </p>
                {hasRegionStackCharts ? (
                  <div className="market-region-stack-grid">
                    {COMPARE_COMPANY_META.filter(
                      (c) => selectedSlugs.includes(c.slug) && stackRowsBySlug[c.slug].length >= 2
                    ).map((c) => (
                      <div key={c.slug} className="market-region-stack-card">
                        <h4 className="market-region-stack-card__title">{c.shortName} — תמהיל שווקים</h4>
                        <div className="chart-wrap chart-wrap--market-stack">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stackRowsBySlug[c.slug]} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                              <YAxis
                                domain={[0, 100]}
                                tick={{ fill: "#9aa8bc" }}
                                tickFormatter={(v) => `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                                formatter={(v: number) => `${fmtNum(v, 1)}%`}
                                labelFormatter={(l) => `שנה ${l}`}
                              />
                              <Legend wrapperStyle={{ direction: "rtl", fontSize: "0.78rem" }} />
                              {REGION_DEFS.map(({ key, label }) => (
                                <Area
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  name={label}
                                  stackId={`${c.slug}Stack`}
                                  stroke={REGION_STACK_COLORS[key]}
                                  fill={REGION_STACK_COLORS[key]}
                                />
                              ))}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="market-region-insights-grid">
                  {COMPARE_COMPANY_META.filter(
                    (c) => selectedSlugs.includes(c.slug) && regionSeriesBySlug[c.slug].length >= 2
                  ).map((c) => {
                    const ins = regionInsightsBySlug[c.slug];
                    return (
                      <article key={c.slug} className="market-region-insights-card">
                        <h4 className="market-region-insights-card__title">מי עלה / מי ירד — {c.shortName}</h4>
                        <ul className="market-region-insights-list">
                          {ins.long.map((line, i) => (
                            <li
                              key={`${c.slug}-l-${i}`}
                              className={i === 0 ? "market-region-insights-list__lead" : undefined}
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                        {ins.yoy.length > 0 && (
                          <ul className="market-region-insights-list market-region-insights-list--yoy">
                            {ins.yoy.map((line, i) => (
                              <li
                                key={`${c.slug}-y-${i}`}
                                className={i === 0 ? "market-region-insights-list__lead" : undefined}
                              >
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>

                <details className="market-region-details">
                  <summary className="market-region-details__summary">טבלת אחוזים לפי שנה (גולמי)</summary>
                  <div className="table-scroll">
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th>שנה</th>
                          <th>חברה</th>
                          {REGION_DEFS.map((r) => (
                            <th key={r.key}>{r.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {marketTrendRows
                          .slice()
                          .sort((a, b) => b.year - a.year)
                          .flatMap((row) =>
                            COMPARE_COMPANY_META.filter((c) => row.bySlug[c.slug].regions != null).map((c) => {
                              const reg = row.bySlug[c.slug].regions;
                              return (
                                <tr key={`${row.year}-${c.slug}`}>
                                  <td>{row.year}</td>
                                  <td>{c.shortName}</td>
                                  {REGION_DEFS.map((r) => {
                                    const v = reg?.[r.key as RegionKey];
                                    return <td key={r.key}>{v != null ? `${fmtNum(v, 1)}%` : "—"}</td>;
                                  })}
                                </tr>
                              );
                            })
                          )}
                      </tbody>
                    </table>
                  </div>
                </details>
                {selectedCompanies
                  .filter((c) => selectedSlugs.includes(c.slug) && regionSeriesBySlug[c.slug].length === 0)
                  .map((c) => (
                    <p key={c.slug} className="muted compare-market-note">
                      ל{c.shortName} אין פילוח אזורי מלא לפי השדות הנדרשים (ישראל/צפון אמריקה/אירופה/אסיה-פסיפיק/שאר
                      העולם) בכל טווח השנים — לא מוצג גרף ערימה אזורי.
                    </p>
                  ))}
                <h3 className="chart-section-title">ישראל מול יצוא (שיקוף מהדוחות)</h3>
                <p className="muted compare-market-note compare-market-note--tight">
                  כשאין 5 אזורים מלאים, מוצגת חלוקה בסיסית ישראל/יצוא לפי מה שקיים בדוחות. ברפאל אלו ערכי טווח
                  ששוקפו כאמצע טווח לשנים זמינות.
                </p>
                <div className="market-region-stack-grid">
                  {selectedCompanies.map((c) => {
                    const rows = domesticExportSeries[c.slug];
                    if (!rows || rows.length < 1) return null;
                    return (
                      <div key={c.slug} className="market-region-stack-card">
                        <h4 className="market-region-stack-card__title">{c.shortName} — ישראל מול יצוא</h4>
                        <div className="chart-wrap chart-wrap--market-stack">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="year" tick={{ fill: "#9aa8bc" }} />
                              <YAxis domain={[0, 100]} tick={{ fill: "#9aa8bc" }} tickFormatter={(v) => `${v}%`} />
                              <Tooltip
                                contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                                formatter={(v: number) => `${fmtNum(v, 1)}%`}
                                labelFormatter={(l) => `שנה ${l}`}
                              />
                              <Legend wrapperStyle={{ direction: "rtl", fontSize: "0.78rem" }} />
                              <Area type="monotone" dataKey="domestic" name="ישראל" stackId={`${c.slug}-de`} stroke="#4f9eff" fill="#4f9eff" />
                              <Area type="monotone" dataKey="export" name="יצוא" stackId={`${c.slug}-de`} stroke="#f59e0b" fill="#f59e0b" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="muted compare-market-note">
                עדיין אין פילוח מכירות אזורי בקבצים. כדי להציג לאורך שנים, הוסיפו לכל שנה
                <code className="file-path">salesByRegionPct</code> עם השדות: israel, northAmerica, europe,
                asiaPacific, restOfWorld.
              </p>
            )}
          </section>

          {matrixRows.length > 0 && (
            <section className="compare-demo compare-demo--summary-matrix" aria-labelledby="compare-matrix">
              <h2 id="compare-matrix">השוואה לפי שנים — טבלה מסכמת</h2>
              <p className="muted compare-demo__desc">
                כל שנה בשורה, כל פרמטר בעמודה לכל חברה נבחרת. גלילה אופקית — עמודת השנה נשארת גלויה.
              </p>
              <div className="table-scroll compare-matrix-scroll">
                <table className="compare-table compare-matrix-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="compare-matrix-sticky-col">
                        שנה
                      </th>
                      {METRIC_DEFS.map((def) => (
                        <th key={def.id} colSpan={selectedCompanies.length} className="compare-matrix-metric-head">
                          {def.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {METRIC_DEFS.map((def) => (
                        <Fragment key={`${def.id}-sub`}>
                          {selectedCompanies.map((c) => (
                            <th key={`${def.id}-${c.slug}`} className="compare-matrix-sub">
                              {c.shortName}
                            </th>
                          ))}
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row) => (
                      <tr key={row.year}>
                        <td className="compare-matrix-sticky-col">{row.year}</td>
                        {METRIC_DEFS.map((def) => (
                          <Fragment key={`${row.year}-${def.id}`}>
                            {selectedCompanies.map((c) => (
                              <td key={c.slug}>{row.cells[def.id][c.slug] ?? "—"}</td>
                            ))}
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="compare-demo" aria-labelledby="compare-scatter">
            <h2 id="compare-scatter">פיזור: ציר X מול ציר Y</h2>
            <p className="muted compare-demo__desc">
              כל נקודה היא שנה אחת (מסומנת בטולטיפ). שני צירים נבחרים — למשל הכנסות מול רווח נקי, או
              צבר מול הכנסות.
            </p>
            <div className="compare-scatter-controls">
              <div className="compare-toolbar compare-toolbar--inline">
                <label htmlFor="scatter-x" className="compare-toolbar__label">
                  ציר X:
                </label>
                <select
                  id="scatter-x"
                  className="compare-toolbar__select compare-toolbar__select--wide"
                  value={scatterXId}
                  onChange={(e) => setScatterXId(e.target.value)}
                >
                  {METRIC_DEFS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="compare-toolbar compare-toolbar--inline">
                <label htmlFor="scatter-y" className="compare-toolbar__label">
                  ציר Y:
                </label>
                <select
                  id="scatter-y"
                  className="compare-toolbar__select compare-toolbar__select--wide"
                  value={scatterYId}
                  onChange={(e) => setScatterYId(e.target.value)}
                >
                  {METRIC_DEFS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="chart-wrap chart-wrap--scatter">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={xDef.label}
                    tick={{ fill: "#9aa8bc", fontSize: 11 }}
                    label={{ value: xDef.label, position: "bottom", fill: "#9aa8bc", fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={yDef.label}
                    tick={{ fill: "#9aa8bc", fontSize: 11 }}
                    label={{
                      value: yDef.label,
                      angle: -90,
                      position: "insideLeft",
                      fill: "#9aa8bc",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                    formatter={(v: number, name) => {
                      const axis = name === "x" ? xDef : yDef;
                      return [fmtMetricCell(v, axis), axis.label];
                    }}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { year?: number } | undefined;
                      return p?.year != null ? `שנה ${p.year}` : "";
                    }}
                  />
                  <Legend wrapperStyle={{ direction: "rtl" }} />
                  {selectedCompanies.map((c) => (
                    <Scatter key={c.slug} name={c.shortName} data={scatterBySlug[c.slug]} fill={c.color} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {canCompare && overlapYears.length > 0 && (
        <div className="compare-toolbar">
          <label htmlFor="compare-year" className="compare-toolbar__label">
            שנה לדוגמאות לפי שנה אחת (עמודות, רדאר, טבלת ערכים):
          </label>
          <select
            id="compare-year"
            className="compare-toolbar__select"
            value={year ?? ""}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {overlapYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {year != null && rowsForSelectedYear && (
        <>
          <section className="compare-demo" aria-labelledby="demo-3">
            <h2 id="demo-3">דוגמה 3: עמודות מקובצות (סכומים במיליוני דולר)</h2>
            <p className="muted compare-demo__desc">
              השוואה ויזואלית של מדדים באותו סדר גודל; צבר הזמנות בגרף נפרד כי הסקאלה גבוהה יותר.
            </p>
            <div className="chart-wrap chart-wrap--medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedMain}
                  margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#9aa8bc", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9aa8bc" }} />
                  <Tooltip
                    contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                    formatter={(v: number | string | undefined) =>
                      v == null || v === "" || Number.isNaN(Number(v)) ? "—" : fmtNum(Number(v), 0)
                    }
                  />
                  <Legend wrapperStyle={{ direction: "rtl" }} />
                  {selectedCompanies.map((c) => (
                    <Bar
                      key={c.slug}
                      dataKey={c.slug}
                      name={c.shortName}
                      fill={c.color}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey={c.slug}
                        position="top"
                        fill="#e8eef7"
                        fontSize={10}
                        formatter={(v: number | string | undefined) =>
                          v == null || v === "" || Number.isNaN(Number(v)) ? "" : fmtNum(Number(v), 0)
                        }
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {groupedBacklog.length > 0 && (
              <div className="chart-wrap chart-wrap--short">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedBacklog} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#9aa8bc" }} />
                    <YAxis tick={{ fill: "#9aa8bc" }} />
                    <Tooltip
                      contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                      formatter={(v: number | string | undefined) =>
                        v == null || v === "" || Number.isNaN(Number(v)) ? "—" : fmtNum(Number(v), 0)
                      }
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                    {selectedCompanies.map((c) => (
                      <Bar key={c.slug} dataKey={c.slug} name={c.shortName} fill={c.color} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey={c.slug}
                          position="top"
                          fill="#e8eef7"
                          fontSize={10}
                          formatter={(v: number | string | undefined) =>
                            v == null || v === "" || Number.isNaN(Number(v)) ? "" : fmtNum(Number(v), 0)
                          }
                        />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="compare-demo" aria-labelledby="demo-4">
            <h2 id="demo-4">דוגמה 4: עמודות אופקיות (אותם נתונים כמו בדוגמה 3)</h2>
            <p className="muted compare-demo__desc">חלופה לקריאת שמות מדדים ארוכים — המדד על ציר Y.</p>
            <div className="chart-wrap chart-wrap--tall compare-chart--horizontal">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={horizontalBars}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: "#9aa8bc" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: "#9aa8bc", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1a2332", border: "1px solid #334155" }}
                    formatter={(v: number) => fmtNum(v, 0)}
                  />
                  <Legend wrapperStyle={{ direction: "rtl" }} />
                  {selectedCompanies.map((c) => (
                    <Bar key={c.slug} dataKey={c.slug} name={c.shortName} fill={c.color} radius={[0, 4, 4, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="compare-demo" aria-labelledby="demo-5-radar">
            <h2 id="demo-5-radar">דוגמה 5: רדאר מנורמל (יחסי לשנה הנבחרת)</h2>
            <p className="muted compare-demo__desc">
              בכל ציר מוצגים ציונים בטווח 0–100 ביחס לחברות הנבחרות: הערך <em>הנמוך ביותר</em> במדד מקבל{" "}
              <strong>0</strong> והגבוה <strong>100</strong> — השוואה יחסית, לא סכום כספי. ערכים שווים → 50 לכל אחת.
              רחף מעל הגרף לראות את הסכומים בפועל.
            </p>
            {radarData.length > 0 && (
              <div className="chart-wrap chart-wrap--radar">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#9aa8bc", fontSize: 11 }} />
                    {selectedCompanies.map((c) => (
                      <Radar
                        key={c.slug}
                        name={c.shortName}
                        dataKey={c.slug}
                        stroke={c.color}
                        fill={c.color}
                        fillOpacity={0.35}
                      />
                    ))}
                    <Tooltip
                      content={(props) => (
                        <RadarCompareTooltip
                          active={props.active}
                          payload={props.payload}
                          slugs={radarSlugsForTooltip}
                        />
                      )}
                    />
                    <Legend wrapperStyle={{ direction: "rtl" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {radarMissingSelected.map((c) => (
              <p key={c.slug} className="muted compare-market-note">
                {c.shortName} נבחרה להשוואה אך אין לה ערכים זמינים לצירי הרדאר בשנה שנבחרה.
              </p>
            ))}
          </section>

          <section className="compare-demo" aria-labelledby="demo-6-delta">
            <h2 id="demo-6-delta">
              דוגמה 6: ערכים לשנה {year}
              {pairwiseDeltaLabel ? ` והפרש (${pairwiseDeltaLabel})` : ""}
            </h2>
            <p className="muted compare-demo__desc">
              {selectedCompanies.length === 2
                ? "עמודת ההפרש = החברה הראשונה ברשימת הבחירה פחות השנייה (מיליוני דולר)."
                : "כאשר נבחרות יותר משתי חברות — מוצגים ערכי המדד לכל חברה; אין עמודת הפרש יחידה."}
            </p>
            <div className="table-scroll">
              <table className="compare-table compare-table--delta">
                <thead>
                  <tr>
                    <th>מדד</th>
                    {selectedCompanies.map((c) => (
                      <th key={c.slug}>{c.shortName}</th>
                    ))}
                    {pairwiseDeltaLabel && <th>הפרש</th>}
                  </tr>
                </thead>
                <tbody>
                  {snapshotTableRows.map(({ key, bySlug }) => {
                    const a = selectedCompanies[0]?.slug;
                    const b = selectedCompanies[1]?.slug;
                    let d: number | null = null;
                    if (a && b && bySlug[a] != null && bySlug[b] != null) {
                      d = bySlug[a]! - bySlug[b]!;
                    }
                    return (
                      <tr key={key}>
                        <td>{key}</td>
                        {selectedCompanies.map((c) => (
                          <td key={c.slug}>{bySlug[c.slug] != null ? fmtNum(bySlug[c.slug], 0) : "—"}</td>
                        ))}
                        {pairwiseDeltaLabel && (
                          <td
                            className={
                              d == null
                                ? ""
                                : d < 0
                                  ? "compare-delta--neg"
                                  : d > 0
                                    ? "compare-delta--pos"
                                    : "compare-delta--zero"
                            }
                          >
                            {d != null ? fmtNum(d, 0) : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

    </>
  );
}
