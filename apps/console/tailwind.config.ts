import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { indigo: '#6366F1', violet: '#8B5CF6', cyan: '#22D3EE' },
      },
    },
  },
  plugins: [],
} satisfies Config;
