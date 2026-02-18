/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neutral: {
          900: 'var(--bg-color)',
          800: 'var(--card-bg)',
          700: 'var(--border-color)',
        }
      }
    },
  },
  plugins: [],
}
