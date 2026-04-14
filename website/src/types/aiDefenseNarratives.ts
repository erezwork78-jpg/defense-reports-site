/** נתוני דף «בינה מלאכותית בדוחות» — נטען מ־/data/ai-narratives-defense.json */

export const AI_DEFENSE_YEARS = [2023, 2024, 2025] as const;
export type AiDefenseYear = (typeof AI_DEFENSE_YEARS)[number];

export type AiDefenseSource = {
  /** שם דוח / קובץ PDF או מזהה */
  document: string;
  /** סעיף, עמוד או הערה */
  sectionOrPage?: string;
};

export type AiDefenseYearEntry = {
  year: AiDefenseYear;
  /** מה החברה כותבת על AI / ML / אוטומציה חכמה וכו׳ — לפי הדוח */
  whatTheySay: string | null;
  /** השפעה על מוצרים / פתרונות — לפי הדוח */
  productImpact: string | null;
  /** השפעה על תפעול / ייצור / יעילות — לפי הדוח */
  operationsImpact: string | null;
  /**
   * ניסוחים עתידיים שמופיעים בדוח בלבד (כוונות, תוכניות).
   * לא תחזית של האתר.
   */
  forwardLookingFromReport: string | null;
  sources: AiDefenseSource[];
};

export type AiDefenseCompany = {
  slug: string;
  nameHe: string;
  /** השוואה איכותנית 2023→2025 — טקסט בלבד */
  qualitativeTrend: string | null;
  years: AiDefenseYearEntry[];
};

export type AiDefensePayload = {
  schemaVersion: number;
  title: string;
  intro: string;
  disclaimer: string;
  coverageYears: AiDefenseYear[];
  companies: AiDefenseCompany[];
};
