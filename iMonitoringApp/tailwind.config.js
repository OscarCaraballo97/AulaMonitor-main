
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}", 
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'kwd-light': '#edf2f9',
        'kwd-dark': '#152e4d',
        'kwd-darker': '#12263f',
        'kwd-blue': {
          DEFAULT: '#2563eb',
          100: '#DBEAFE',
          300: '#93C5FD', 
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563eb',
          700: '#1D4ED8',
          800: '#1e40af',
        },
        'kwd-red': '#dc2626',
        'kwd-green': '#16a34a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
      },
    },
  },
  plugins: [],
};