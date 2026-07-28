import { RefObject } from "react";
import { downloadChartAsPng } from "../lib/downloadChartAsPng";

export function ChartDownloadButton({
  containerRef,
  fileName,
}: {
  containerRef: RefObject<HTMLDivElement>;
  fileName: string;
}) {
  return (
    <button
      type="button"
      className="chart-download-btn"
      onClick={() => downloadChartAsPng(containerRef.current, fileName)}
      title="הורדת הגרף כתמונת PNG"
    >
      ⬇ הורד כתמונה
    </button>
  );
}
