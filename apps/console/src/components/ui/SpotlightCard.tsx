import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A surface card: recessed below the page, bounded by a hairline that brightens on hover.
 *
 * This used to paint a 320px radial glow that followed the cursor. Two problems with that, and
 * neither was taste:
 *
 * 1. The glow was `rgba(99,102,241)` indigo into `rgba(34,211,238)` cyan — not this product's
 *    colours at all, but the default palette of every AI-startup template. It was the single
 *    biggest reason the site read as generated.
 * 2. It tracked the cursor by calling `setState` in `onMouseMove`, so every pointer movement
 *    re-rendered the card AND its entire subtree. With 61 of these on the site, some wrapping
 *    whole result panels, that is a real cost for an effect nobody asked for.
 *
 * Depth now comes from the card being DARKER than the page (`card` #080808 on `paper` #101010)
 * plus a 1px rule — the runs-on.dev / Instrument language. Hover brightens the rule and nothing
 * else. No JS, no state, no re-render: this is a server component again.
 *
 * The name is kept because it is imported in 18 files and the role is unchanged; only the
 * treatment moved. If you are adding a new surface, prefer this over a hand-rolled div so the
 * border and radius stay consistent.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-rule bg-card',
        'transition-colors duration-200 hover:border-rule-strong',
        className,
      )}
    >
      {children}
    </div>
  );
}
