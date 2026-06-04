import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

/** Shared 1200×630 Open Graph dimensions + content type for every `opengraph-image` route. */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

/** Copy for one social/AI share card. `eyebrow` is the tool tag, `title` the headline. */
export interface OgCard {
  eyebrow: string;
  title: string;
  subtitle: string;
}

/**
 * Branded Open Graph card renderer shared by the root and every tool route. Dark ink background,
 * brand indigo→violet→cyan gradient wash, the AEO tile mark, an eyebrow tag, a large headline, and
 * a subtitle. Every multi-child element sets `display: 'flex'` explicitly (a Satori requirement
 * under `next/og`). Keeping this in one place means all cards stay visually consistent.
 */
export function renderOgImage({ eyebrow, title, subtitle }: OgCard): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          backgroundColor: '#05060f',
          backgroundImage:
            'radial-gradient(900px 520px at 12% -8%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(820px 520px at 100% 110%, rgba(34,211,238,0.30), transparent 55%), radial-gradient(700px 480px at 70% 0%, rgba(139,92,246,0.30), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row: brand lockup + tool eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '92px',
              height: '92px',
              borderRadius: '22px',
              backgroundImage: 'linear-gradient(135deg, #818CF8 0%, #A78BFA 100%)',
              boxShadow: '0 24px 70px -20px rgba(99,102,241,0.7)',
            }}
          >
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <path
                d="M18.5 46.5 32 18 45.5 46.5"
                fill="none"
                stroke="#fff"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M24.2 34.6H39.8" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
              <path
                d="M44 9.2 45.1 13.4 49.3 14.5 45.1 15.6 44 19.8 42.9 15.6 38.7 14.5 42.9 13.4Z"
                fill="#22D3EE"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', fontSize: '40px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#F8FAFC' }}>AEO</span>
            <span style={{ color: '#94A3B8', fontWeight: 500 }}>&nbsp;Toolkit</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              alignItems: 'center',
              padding: '10px 22px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#22D3EE',
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Headline block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div
            style={{
              display: 'flex',
              color: '#fff',
              fontSize: '72px',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: '1010px',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', color: '#9aa3b8', fontSize: '30px', maxWidth: '940px' }}>
            {subtitle}
          </div>
        </div>

        {/* Footer accent bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              width: '220px',
              height: '8px',
              borderRadius: '999px',
              backgroundImage: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #22D3EE 100%)',
            }}
          />
          <div style={{ display: 'flex', color: '#6b7390', fontSize: '26px' }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
