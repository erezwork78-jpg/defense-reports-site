import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";
import type { OrgFinanceCompany, OrgFinancePayload } from "../types/orgFinanceQuestions";

type MetricYear = {
  year: number;
  researchDevelopmentMUSD: number | null;
  capexMUSD: number | null;
};

type CompanyMetricsFile = {
  company: { slug: string; nameHe: string };
  metrics: MetricYear[];
};

function unitLabel(unit: OrgFinanceCompany["metricsUnit"]): string {
  switch (unit) {
    case "MSEK":
      return "MSEK";
    case "MUSD_FROM_EUR":
      return "MUSD (המרה)";
    default:
      return "MUSD";
  }
}

function formatMetric(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(v);
}

export function OrgFinanceQuestionsPage() {
  const [data, setData] = useState<OrgFinancePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [metrics, setMetrics] = useState<MetricYear[] | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/org-finance-questions.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<OrgFinancePayload>;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          if (payload.companies.length > 0) {
            setSlug((s) => s || payload.companies[0]!.slug);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("לא ניתן לטעון את קובץ הנתונים.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const company: OrgFinanceCompany | undefined = useMemo(
    () => data?.companies.find((c) => c.slug === slug),
    [data, slug]
  );

  useEffect(() => {
    if (slug === "") return;
    let cancelled = false;
    setMetrics(null);
    setMetricsError(null);
    fetch(`/data/${slug}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CompanyMetricsFile>;
      })
      .then((payload) => {
        if (cancelled) return;
        const rows = (payload.metrics ?? [])
          .map((m) => ({
            year: m.year,
            researchDevelopmentMUSD: m.researchDevelopmentMUSD,
            capexMUSD: m.capexMUSD,
          }))
          .sort((a, b) => a.year - b.year);
        setMetrics(rows);
      })
      .catch(() => {
        if (!cancelled) setMetricsError("לא ניתן לטעון מטריקות שנתיות לחברה זו.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <>
      <SiteNav />
      <div className="org-finance-page" dir="rtl" lang="he">
        <header className="org-finance-header">
          <p className="badge">ניסוי 5 חברות</p>
          <h1>{data?.title ?? "שאלות ארגון כספים"}</h1>
          {data?.intro != null && data.intro !== "" && <p className="muted org-finance-intro">{data.intro}</p>}
          <p className="org-finance-disclaimer">{data?.disclaimer}</p>
        </header>

        {loadError != null && <p className="muted">{loadError}</p>}

        {data != null && (
          <>
            <div className="compare-toolbar">
              <label htmlFor="org-finance-company" className="compare-toolbar__label">
                חברה:
              </label>
              <select
                id="org-finance-company"
                className="compare-toolbar__select compare-toolbar__select--wide"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {data.companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nameHe}
                  </option>
                ))}
              </select>
              {company != null && (
                <Link to={`/company/${company.slug}`} className="org-finance-company-link muted">
                  לדף המטריקות של {company.nameHe} →
                </Link>
              )}
            </div>

            {company != null && (
              <>
                <section className="org-finance-block card" aria-labelledby="org-q1">
                  <h2 id="org-q1">1) מימון וחוב — מיקוד 2025</h2>
                  <p className="org-finance-lead">{company.debt2025.headlineHe}</p>
                  <ul className="org-finance-bullets">
                    {company.debt2025.bulletsHe.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <h3 className="org-finance-h3">שימוש במינוף (כפי שמופיע בדוחות)</h3>
                  <p className="org-finance-text">{company.debt2025.purposeHe}</p>
                </section>

                <section className="org-finance-block card" aria-labelledby="org-q2">
                  <h2 id="org-q2">2) מו״פ ו־CAPEX — 2025 והקשר לפעילויות</h2>
                  <ul className="org-finance-lines">
                    {company.rndCapex2025.summaryLinesHe.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <h3 className="org-finance-h3">תמיכה במוצרים ובפעילויות</h3>
                  <p className="org-finance-text">{company.rndCapex2025.allocationHe}</p>
                </section>

                <section className="org-finance-block card" aria-labelledby="org-years">
                  <h2 id="org-years">מו״פ ו־CAPEX לפי שנה (2020–2025)</h2>
                  {company.metricsUnitNoteHe != null && company.metricsUnitNoteHe !== "" && (
                    <p className="muted org-finance-unit-note">{company.metricsUnitNoteHe}</p>
                  )}
                  {metricsError != null && <p className="muted">{metricsError}</p>}
                  {metrics != null && metrics.length > 0 && (
                    <div className="org-finance-table-wrap">
                      <table
                        className="org-finance-table"
                        aria-label={`מו״פ ו־CAPEX לפי שנה, יחידות ${unitLabel(company.metricsUnit)}`}
                      >
                        <thead>
                          <tr>
                            <th scope="col">שנה</th>
                            <th scope="col">מו״פ ({unitLabel(company.metricsUnit)})</th>
                            <th scope="col">CAPEX ({unitLabel(company.metricsUnit)})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.map((row) => (
                            <tr key={row.year}>
                              <td>{row.year}</td>
                              <td>{formatMetric(row.researchDevelopmentMUSD)}</td>
                              <td>{formatMetric(row.capexMUSD)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {metrics != null && metrics.length === 0 && (
                    <p className="muted">אין שורות מטריקות בקובץ החברה.</p>
                  )}
                </section>

                {company.sourcesHe.length > 0 && (
                  <section className="org-finance-sources" aria-label="מקורות">
                    <p className="org-finance-sources__title">מקורות עיקריים</p>
                    <ul className="org-finance-sources__list">
                      {company.sourcesHe.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}

        <p className="org-finance-foot muted">
          עריכת טקסט השאלות: <code className="file-path">public/data/org-finance-questions.json</code>
        </p>
      </div>
    </>
  );
}
