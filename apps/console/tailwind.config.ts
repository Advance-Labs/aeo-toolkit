import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * Instrument palette, shared with runs-on.dev and advancelabs.dev.
         *
         * The action colour is WHITE, not green. Green is reserved for live state — a running
         * audit, a passing check, a value that just changed. Spending it on every button is what
         * made the old palette read as decoration rather than signal.
         *
         * `brand.cyan` used to be defined here as `#A8F326`, which is acid green, not cyan. Every
         * `text-brand-cyan` in the codebase rendered green. The names now say what the values are.
         */
        paper: '#101010',
        // Cards sit BELOW the page, not above it. Depth comes from recession, not from glow.
        card: '#080808',
        rule: '#212121',
        'rule-strong': '#2e2e2e',
        ink: {
          DEFAULT: '#f3f3f3',
          muted: '#9c9c9c',
          faint: '#6b6b6b',
          // Retained: the old surface scale is still referenced by chart and graph code.
          950: '#05060f',
          900: '#0a0c1b',
          850: '#0e1124',
          800: '#141833',
          700: '#1c2142',
        },
        /** The one accent. Live state only — never a default button fill. */
        pulse: '#98ff38',
        /** Secondary emphasis. Never a call to action. */
        annotate: '#b6a4fd',
        /**
         * Legacy aliases. `brand.cyan` is kept pointing at the green it always was so nothing
         * breaks mid-migration, but new code should use `pulse` (state) or `ink` (text).
         */
        brand: {
          indigo: '#7C3AED',
          violet: '#B6A4FD',
          cyan: '#A8F326',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        content: '72rem',
      },
      letterSpacing: {
        meta: '0.08em',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Continuous horizontal scroll for the answer-engine marquee (one wordmark set wide).
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        marquee: 'marquee 32s linear infinite',
      },
      /*
       * REMOVED, and deliberately not replaced:
       *   gradient-pan  an animated gradient headline is the strongest "generated site" tell
       *   aurora-1/2    the blurred colour blobs behind the hero
       *   float         decorative bob with no state behind it
       *   shimmer       ditto
       *   star-movement orbiting border sweeps (StarBorder)
       *   radial-glow   the purple/green hero wash
       *   shadow glow   glow-as-depth; depth is a rule now
       * Motion has to report something real. None of these did.
       */
    },
  },
  plugins: [],
} satisfies Config;
