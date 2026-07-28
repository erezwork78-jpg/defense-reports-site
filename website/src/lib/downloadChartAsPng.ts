/**
 * ממיר את ה-SVG הראשון בתוך container (גרף Recharts) לתמונת PNG ומוריד אותה.
 * הרקע נצבע כמו רקע האתר (--bg) כדי שהתמונה תיראה כמו שהגרף נראה בפועל.
 */
export function downloadChartAsPng(
  container: HTMLElement | null,
  fileName: string,
  backgroundColor = "#0f1419"
): void {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;

  const scale = 2; // רזולוציה גבוהה יותר להטמעה במצגת
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.scale(scale, scale);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, "image/png");
  };
  img.src = url;
}
