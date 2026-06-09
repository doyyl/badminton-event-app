/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#dc2626',
        'primary-dark': '#b91c1c',
        success: '#16a34a',
        warn: '#d97706',
        // legacy aliases — kept so existing refs still compile
        court: '#dc2626',
        shuttle: '#d97706',
        dark: {
          bg: '#f3f4f6',
          card: '#ffffff',
          border: '#e5e7eb',
          muted: '#f9fafb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
