/** נתוני דף «שאלות ארגון כספים» — נטען מ־/data/org-finance-questions.json */

export type OrgFinanceMetricsUnit = "MUSD" | "MSEK" | "MUSD_FROM_EUR";

export type OrgFinanceCompany = {
  slug: string;
  nameHe: string;
  /** יחידת מצגת למו״פ/CAPEX בטבלת השנים (מתוך קבצי המטריקות באתר) */
  metricsUnit: OrgFinanceMetricsUnit;
  /** הערה על מטבע/המרה — אופציונלי */
  metricsUnitNoteHe?: string;
  debt2025: {
    headlineHe: string;
    bulletsHe: string[];
    purposeHe: string;
  };
  rndCapex2025: {
    summaryLinesHe: string[];
    allocationHe: string;
  };
  sourcesHe: string[];
};

export type OrgFinancePayload = {
  schemaVersion: number;
  title: string;
  intro: string;
  disclaimer: string;
  companies: OrgFinanceCompany[];
};
