/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        beam: {
          50:  '#EAF4FF', 100: '#C9E2FF', 200: '#9CCBFF',
          300: '#6FB1FF', 400: '#5BA8FF', 500: '#2F86E8',
          600: '#1F6BCC', 700: '#154E99', 800: '#0D3768', 900: '#081F3D',
        },
        ocean: {
          base: '#07091A', canvas: '#0A0F1F', 1: '#101728',
          2: '#15203A', 3: '#1B2B4D', inset: '#080C1A',
        },
        fg: { 1: '#F4F6FB', 2: '#C6CFE2', 3: '#8C99B5', 4: '#5C6884' },
        critical: { bg: 'rgba(255,92,92,0.10)', line: 'rgba(255,92,92,0.30)', fg: '#FF6B6B', solid: '#E64545' },
        high:     { bg: 'rgba(255,155,71,0.10)', line: 'rgba(255,155,71,0.30)', fg: '#FFA463', solid: '#E6822A' },
        watch:    { bg: 'rgba(255,209,102,0.10)', line: 'rgba(255,209,102,0.30)', fg: '#FFD166' },
        healthy:  { bg: 'rgba(61,220,151,0.10)', line: 'rgba(61,220,151,0.30)', fg: '#3DDC97', solid: '#22B97A' },
      },
      fontFamily: {
        sans:    ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-serif)', 'Times New Roman', 'serif'],
      },
      borderRadius: { DEFAULT: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        card:     '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 1px 2px 0 rgba(0,0,0,0.40), 0 8px 24px -6px rgba(0,0,0,0.40)',
        beam:     '0 0 0 1px rgba(91,168,255,0.30), 0 8px 32px -4px rgba(91,168,255,0.25)',
        critical: '0 0 0 1px rgba(255,92,92,0.40), 0 8px 32px -4px rgba(255,92,92,0.20)',
      },
    },
  },
  plugins: [],
};
