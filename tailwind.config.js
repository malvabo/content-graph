/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      transitionTimingFunction: {
        'fluid-spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      borderWidth: {
        'hairline': '0.5px',
      },
      boxShadow: {
        'fluid-glass': '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        'fluid-pressed': '0 1px 4px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
