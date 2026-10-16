/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111418',
        concrete: '#EDEEE9',
        paper: '#FBFAF6',
        signal: '#FF5B14',
        soft: '#3A3F47',
        muted: '#6B7079',
        'on-dark': '#C9CBC4',
        done: '#1E8C4E',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        hard: '9px 9px 0 #111418',
        'hard-sm': '5px 5px 0 #111418',
        'hard-signal': '9px 9px 0 #FF5B14',
      },
      borderRadius: {
        DEFAULT: '0',
        none: '0',
      },
    },
  },
  plugins: [],
};
