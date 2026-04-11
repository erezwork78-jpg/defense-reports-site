type Props = { slug: string };

export function MetricsDataDisclaimer({ slug }: Props) {
  return (
    <div className="disclaimer">
      הנתונים המספריים והתובנות הידניות נשמרים ב־
      <span className="file-path">public/data/{slug}-metrics.json</span> (מפתחות{" "}
      <code>rows</code>, <code>insights</code>) — הוראות בעמוד <strong>README</strong>{" "}
      בתיקיית האתר. רשימת הקבצים נוצרת עם <code>npm run data:{slug}</code>.
    </div>
  );
}
