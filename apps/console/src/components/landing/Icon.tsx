import type { IconKey } from './data';

/**
 * Inline, dependency-free SVG icon set for the landing page. Each glyph inherits
 * `currentColor` so the parent controls tint, and uses a consistent 24px viewBox
 * with rounded strokes to match the design system's soft, modern feel.
 */
export function Icon({
  name,
  className,
}: {
  name: IconKey;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconKey, React.ReactElement> = {
  // Score gauge / speedometer.
  gauge: (
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 14l4-4" />
      <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  // Shield with check — trust / E-E-A-T.
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6l7-3Z" />
      <path d="m9 11.5 2 2 4-4.5" />
    </>
  ),
  // Document with lines — llms.txt.
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 12h5M9.5 15.5h5M9.5 8.5h2" />
    </>
  ),
  // Chat bubble — GA4/GSC chat.
  chat: (
    <>
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </>
  ),
  // Connected nodes — backlink graph.
  graph: (
    <>
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="17" cy="17" r="2" />
      <circle cx="7" cy="16" r="2" />
      <path d="M8 8l8.2 7M8 7.5l8-1M8 15l9 1.5M7 14V9" />
    </>
  ),
  // Sparkle — AI visibility / generative.
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.6 11l2.4 1-2.4 1L12 15.5 10.4 13 8 12l2.4-1L12 8.5Z" />
    </>
  ),
};
