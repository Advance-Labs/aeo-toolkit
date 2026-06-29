import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (see /brand).
        brand: {
          indigo: '#6366F1',
          violet: '#8B5CF6',
          cyan: '#22D3EE',
        },
        // Surface scale for the dark theme.
        ink: {
          950: '#05060f',
          900: '#0a0c1b',
          850: '#0e1124',
          800: '#141833',
          700: '#1c2142',
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
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.10) 40%, transparent 70%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px rgba(99,102,241,0.45)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.18), 0 18px 50px -18px rgba(34,211,238,0.40)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'aurora-1': {
          '0%,100%': { transform: 'translate(-10%, -10%) scale(1)' },
          '50%': { transform: 'translate(10%, 6%) scale(1.25)' },
        },
        'aurora-2': {
          '0%,100%': { transform: 'translate(8%, 4%) scale(1.1)' },
          '50%': { transform: 'translate(-6%, -8%) scale(0.95)' },
        },
        // Continuous horizontal scroll for the answer-engine marquee (one wordmark set wide).
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        // Orbiting border sweeps for StarBorder (adapted from React Bits).
        'star-movement-bottom': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(-100%, 0%)', opacity: '0' },
        },
        'star-movement-top': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(100%, 0%)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        'gradient-pan': 'gradient-pan 6s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'aurora-1': 'aurora-1 18s ease-in-out infinite',
        'aurora-2': 'aurora-2 22s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'star-movement-bottom': 'star-movement-bottom 6s linear infinite alternate',
        'star-movement-top': 'star-movement-top 6s linear infinite alternate',
      },
    },
  },
  plugins: [],
} satisfies Config;
