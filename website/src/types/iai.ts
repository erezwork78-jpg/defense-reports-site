export interface IaiCompany {
  slug: string;
  nameHe: string;
  nameEn: string;
  reportsFolder: string;
}

export interface MetricRow {
  year: number;
  revenueMUSD: number | null;
  backlogMUSD: number | null;
  netIncomeMUSD: number | null;
  /** רווח תפעולי (EBIT), מיליון USD */
  operatingIncomeMUSD: number | null;
  /** רווח גולמי כאחוז מההכנסות (0–100) */
  grossMarginPct: number | null;
  /** תזרים מזומנים מפעילות שוטפת, מיליון USD */
  operatingCashFlowMUSD: number | null;
  /** תזרים מזומנים מפעילות השקעה (לרוב שלילי), מיליון USD */
  investingCashFlowMUSD: number | null;
  /** תזרים מזומנים מפעילות מימון, מיליון USD */
  financingCashFlowMUSD: number | null;
  /** סה״כ נכסים — מאזן, מיליון USD */
  totalAssetsMUSD: number | null;
  /** סה״כ התחייבויות — מאזן, מיליון USD */
  totalLiabilitiesMUSD: number | null;
  /** הון עצמי — מאזן, מיליון USD */
  equityMUSD: number | null;
  /** השקעות בקבועים (CapEx), מיליון USD — לפי דוח תזרים/הערות */
  capexMUSD: number | null;
  /** הוצאות מחקר ופיתוח, מיליון USD */
  researchDevelopmentMUSD: number | null;
  /** הוצאות שיווק ומכירה (אם פורסם בדוח), מיליון USD */
  marketingSalesMUSD?: number | null;
  /** הוצאות הנהלה וכלליות (אם פורסם בדוח), מיליון USD */
  generalAdminMUSD?: number | null;
  /**
   * פילוח הכנסות לפי מגזר/קו מוצר (מיליון USD). מפתחות יציבים (slug); למלא מדוח כשזמין.
   */
  revenueBySegmentMUSD?: Record<string, number> | null;
  /**
   * פילוח מכירות לפי אזור (% מסך ההכנסות השנתי). אופציונלי לפי זמינות בדוחות.
   * מומלץ שהסכום יתקרב ל־100 בכל שנה.
   */
  salesByRegionPct?: {
    israel?: number | null;
    northAmerica?: number | null;
    europe?: number | null;
    asiaPacific?: number | null;
    restOfWorld?: number | null;
  };
  /** EBITDA, מיליון USD — מדוח כספי; אם null יש למלא מהדוח */
  ebitdaMUSD: number | null;
  employees: number | null;
  notes?: string;
}

export interface FileRow {
  fileName: string;
  yearsInName: number[];
  sizeBytes: number;
  extension: string;
}

export interface IaiPayload {
  company: IaiCompany;
  currencyNote: string;
  /** תובנות מנוסח ידני — נטענות מ־iai-metrics.json (מפתח insights) */
  insights?: string[];
  metrics: MetricRow[];
  files: FileRow[];
  generatedAt?: string;
}
