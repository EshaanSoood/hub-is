/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'bg-muted-subtle',
    'bg-info-subtle',
    'bg-success-subtle',
    'bg-warning-subtle',
    'bg-danger-subtle',
    'text-on-primary',
    'text-danger',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
