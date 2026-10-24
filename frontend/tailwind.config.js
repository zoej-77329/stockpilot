import colors from 'tailwindcss/colors';

// ---- COLOUR THEME: change this one word, save, and the whole app re-colours. ----
// Options: 'teal' | 'ocean' | 'royal' | 'plum'
const THEME = 'teal';

// Buttons use shades 500-700; shifting one step darker keeps white button text easy to read.
const deeper = (p) => ({ ...p, 400: p[500], 500: p[600], 600: p[700], 700: p[800], 800: p[900] });
const PRESETS = {
  teal:  { indigo: deeper(colors.teal),   violet: deeper(colors.cyan) },     // fresh, modern
  ocean: { indigo: deeper(colors.blue),   violet: deeper(colors.sky) },      // classic corporate blue
  royal: { indigo: colors.indigo,         violet: colors.violet },           // the original look
  plum:  { indigo: deeper(colors.purple), violet: deeper(colors.fuchsia) },  // bold, creative
};
const palette = PRESETS[THEME] || PRESETS.teal;
const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // The app's existing "indigo" and "violet" classes now follow the selected theme.
      colors: { indigo: palette.indigo, violet: palette.violet },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI Variable Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"Cascadia Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      // Softer, layered shadows: every existing shadow-sm / shadow / shadow-md / shadow-lg / shadow-xl / shadow-2xl gets the premium look.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 12px -2px rgb(15 23 42 / 0.06)',
        md: '0 2px 4px -1px rgb(15 23 42 / 0.05), 0 8px 20px -4px rgb(15 23 42 / 0.08)',
        lg: '0 4px 8px -2px rgb(15 23 42 / 0.06), 0 16px 32px -8px rgb(15 23 42 / 0.12)',
        xl: '0 8px 16px -4px rgb(15 23 42 / 0.08), 0 24px 48px -12px rgb(15 23 42 / 0.16)',
        '2xl': '0 24px 60px -12px rgb(15 23 42 / 0.35)',
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 10px 28px -10px rgb(15 23 42 / 0.10)',
        glow: `0 1px 2px rgb(15 23 42 / 0.25), 0 8px 18px -6px rgb(${rgbOf(palette.indigo[600])} / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.18)`,
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
