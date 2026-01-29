/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom Codelane color palette
        codelane: {
          bg: {
            primary: '#0f0f10',
            secondary: '#1a1a1b',
            tertiary: '#252526',
          },
          border: {
            subtle: '#2d2d2d',
            default: '#3e3e42',
          },
          text: {
            primary: '#e4e4e7',
            secondary: '#a1a1aa',
            muted: '#71717a',
          },
          accent: {
            blue: '#3b82f6',
            green: '#22c55e',
            yellow: '#eab308',
            red: '#ef4444',
            purple: '#a855f7',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
