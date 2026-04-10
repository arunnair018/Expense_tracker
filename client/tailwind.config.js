/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#080d1c',
          800: '#0d1529',
          700: '#111827',
          600: '#1a2540',
        },
      },
    },
  },
  plugins: [],
};
