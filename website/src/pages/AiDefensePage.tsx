import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";
import type { AiDefenseCompany, AiDefensePayload, AiDefenseYearEntry } from "../types/aiDefenseNarratives";

function TextOrPlaceholder({ value }: { value: string | null }) {
  if (value != null && value.trim() !== "") {
    return <p className="ai-defense__text">{value}</p>;
  }
  return (
    <p className="muted ai-defense__empty">טרם נוסף לקובץ הנתונים — יש למלא מתוך הדוח.</p>
  );
}

function YearBlock({ entry }: { entry: AiDefenseYearEntry }) {
  return (
    <article className="ai-defense-year card" aria-labelledby={`ai-y-${entry.year}`}>
      <h3 id={`ai-y-${entry.year}`} className="ai-defense-year__title">
        שנת דיווח {entry.year}
      </h3>
      <section className="ai-defense-year__section" aria-labelledby={`ai-y-${entry.year}-say`}>
        <h4 id={`ai-y-${entry.year}-say`} className="ai-defense-year__h4">
          מה כתוב בדוח
        </h4>
        <TextOrPlaceholder value={entry.whatTheySay} />
      </section>
      <section className="ai-defense-year__section" aria-labelledby={`ai-y-${entry.year}-prod`}>
        <h4 id={`ai-y-${entry.year}-prod`} className="ai-defense-year__h4">
          מוצרים ופתרונות
        </h4>
        <TextOrPlaceholder value={entry.productImpact} />
      </section>
      <section className="ai-defense-year__section" aria-labelledby={`ai-y-${entry.year}-ops`}>
        <h4 id={`ai-y-${entry.year}-ops`} className="ai-defense-year__h4">
          תפעול וארגון
        </h4>
        <TextOrPlaceholder value={entry.operationsImpact} />
      </section>
      <div className="ai-defense-forward" role="region" aria-label="ניסוח עתידי מהדוח">
        <p className="ai-defense-forward__label">ניסוח עתידי מהדוח (דברי החברה בלבד)</p>
        <TextOrPlaceholder value={entry.forwardLookingFromReport} />
      </div>
      {entry.sources.length > 0 && (
        <div className="ai-defense-sources">
          <p className="ai-defense-sources__title">מקורות</p>
          <ul className="ai-defense-sources__list">
            {entry.sources.map((s, i) => (
              <li key={i}>
                <span className="ai-defense-sources__doc">{s.document}</span>
                {s.sectionOrPage != null && s.sectionOrPage !== "" && (
                  <span className="muted"> — {s.sectionOrPage}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function AiDefensePage() {
  const [data, setData] = useState<AiDefensePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/data/ai-narratives-defense.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AiDefensePayload>;
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

  const company: AiDefenseCompany | undefined = useMemo(
    () => data?.companies.find((c) => c.slug === slug),
    [data, slug]
  );

  return (
    <>
      <SiteNav />
      <div className="ai-defense-page" dir="rtl" lang="he">
        <header className="ai-defense-header">
          <p className="badge">דוחות</p>
          <h1>{data?.title ?? "בינה מלאכותית בדוחות יצרני ביטחון"}</h1>
          {data?.intro != null && data.intro !== "" && <p className="muted ai-defense-intro">{data.intro}</p>}
          <p className="ai-defense-disclaimer">{data?.disclaimer}</p>
        </header>

        {loadError != null && <p className="muted">{loadError}</p>}

        {data != null && (
          <>
            <div className="compare-toolbar">
              <label htmlFor="ai-defense-company" className="compare-toolbar__label">
                חברה:
              </label>
              <select
                id="ai-defense-company"
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
                <Link to={`/company/${company.slug}`} className="ai-defense-company-link muted">
                  לדף המטריקות של {company.nameHe} →
                </Link>
              )}
            </div>

            {company != null && (
              <>
                <section className="ai-defense-trend card" aria-labelledby="ai-trend">
                  <h2 id="ai-trend">מגמה איכותנית (2023–2025)</h2>
                  {company.qualitativeTrend != null && company.qualitativeTrend.trim() !== "" ? (
                    <p className="ai-defense__text">{company.qualitativeTrend}</p>
                  ) : (
                    <p className="muted ai-defense__empty">
                      טרם נוסף סיכום מגמה — לאחר מילוי שלוש השנות יש לנסח כאן השוואה מילולית בין 2023, 2024
                      ו־2025.
                    </p>
                  )}
                </section>

                <div className="ai-defense-timeline">
                  {company.years
                    .slice()
                    .sort((a, b) => a.year - b.year)
                    .map((y) => (
                      <YearBlock key={y.year} entry={y} />
                    ))}
                </div>
              </>
            )}
          </>
        )}

        <p className="muted ai-defense-foot">
          נתונים בקובץ <code className="file-path">public/data/ai-narratives-defense.json</code> — עריכה ידנית
          מתוך דוחות 2023–2025.
        </p>
      </div>
    </>
  );
}
