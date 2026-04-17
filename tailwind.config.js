/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Legacy ink palette (kept for amber/rose/emerald/violet accents still in use)
        ink: {
          950: '#05070d',
          900: '#0a0d17',
          800: '#10131f',
          700: '#1a1f31',
          600: '#262c42',
        },
        // Theme-aware tokens
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          2: 'var(--accent-2)',
          3: 'var(--accent-3)',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px color-mix(in srgb, var(--accent) 45%, transparent)',
      },
    },
  },
  plugins: [],
}
