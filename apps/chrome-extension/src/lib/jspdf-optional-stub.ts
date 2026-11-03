// Build-time stand-in for jsPDF's optional renderers (canvg, html2canvas, dompurify).
// jsPDF only imports them for doc.html() and addSvgAsImage(); the popup calls neither.
// canvg drags in core-js, whose minified Object.create polyfill got 0.2.x and 0.3.0
// rejected as obfuscated code ("Red Titanium"). See vite.config.ts.
export default function unavailable(): never {
  throw new Error('This jsPDF renderer is not bundled in the extension.');
}
