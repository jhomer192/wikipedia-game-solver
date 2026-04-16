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
        ink: {
          950: '#05070d',
          900: '#0a0d17',
          800: '#10131f',
          700: '#1a1f31',
          600: '#262c42',
        },
        accent: {
          400: '#7dd3fc',
          500: '#38bdf8',
          600: '#0ea5e9',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(56,189,248,0.45)',
      },
    },
  },
  plugins: [],
}
