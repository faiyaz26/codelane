/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Zed-inspired color palette using CSS variables for theming
        // Uses rgb() with <alpha-value> for opacity modifier support
        zed: {
          // Backgrounds (darkest to lightest)
          bg: {
            app: 'rgb(var(--zed-bg-app) / <alpha-value>)',
            panel: 'rgb(var(--zed-bg-panel) / <alpha-value>)',
            surface: 'rgb(var(--zed-bg-surface) / <alpha-value>)',
            hover: 'rgb(var(--zed-bg-hover) / <alpha-value>)',
            active: 'rgb(var(--zed-bg-active) / <alpha-value>)',
            overlay: 'rgb(var(--zed-bg-overlay) / <alpha-value>)',
          },
          // Borders (subtle to prominent)
          border: {
            subtle: 'rgb(var(--zed-border-subtle) / <alpha-value>)',
            default: 'rgb(var(--zed-border-default) / <alpha-value>)',
            focus: 'rgb(var(--zed-border-focus) / <alpha-value>)',
            active: 'rgb(var(--zed-border-active) / <alpha-value>)',
          },
          // Text colors
          text: {
            primary: 'rgb(var(--zed-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--zed-text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--zed-text-tertiary) / <alpha-value>)',
            disabled: 'rgb(var(--zed-text-disabled) / <alpha-value>)',
            inverse: 'rgb(var(--zed-text-inverse) / <alpha-value>)',
          },
          // Accent colors
          accent: {
            blue: 'rgb(var(--zed-accent-blue) / <alpha-value>)',
            'blue-hover': 'rgb(var(--zed-accent-blue-hover) / <alpha-value>)',
            green: 'rgb(var(--zed-accent-green) / <alpha-value>)',
            'green-hover': 'rgb(var(--zed-accent-green-hover) / <alpha-value>)',
            yellow: 'rgb(var(--zed-accent-yellow) / <alpha-value>)',
            red: 'rgb(var(--zed-accent-red) / <alpha-value>)',
            'red-hover': 'rgb(var(--zed-accent-red-hover) / <alpha-value>)',
            purple: 'rgb(var(--zed-accent-purple) / <alpha-value>)',
            orange: 'rgb(var(--zed-accent-orange) / <alpha-value>)',
          },
          // Semantic colors
          success: 'rgb(var(--zed-success) / <alpha-value>)',
          warning: 'rgb(var(--zed-warning) / <alpha-value>)',
          error: 'rgb(var(--zed-error) / <alpha-value>)',
          info: 'rgb(var(--zed-info) / <alpha-value>)',
          // Terminal colors (ANSI) - these stay hardcoded as they're standard
          terminal: {
            black: '#1a1a1a',
            red: '#f23c3c',
            green: '#26d97f',
            yellow: '#f5c249',
            blue: '#0b93f6',
            magenta: '#b88ef2',
            cyan: '#26d9d9',
            white: '#e6e6e6',
            brightBlack: '#4e4e4e',
            brightRed: '#ff5252',
            brightGreen: '#3dff95',
            brightYellow: '#ffd65e',
            brightBlue: '#3da8ff',
            brightMagenta: '#d1a3ff',
            brightCyan: '#3dffff',
            brightWhite: '#ffffff',
          },
          // Syntax highlighting (for code viewer)
          syntax: {
            comment: '#6e6e6e',
            keyword: '#b88ef2',
            string: '#26d97f',
            number: '#f5c249',
            function: '#0b93f6',
            variable: '#e6e6e6',
            type: '#26d9d9',
            constant: '#ff8c42',
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
