/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: '#22c55e',
        shuttle: '#f59e0b',
        dark: {
          bg: '#0f0f1a',
          card: '#1a1a2e',
          border: '#2d2d4e',
          muted: '#3d3d5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
