/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Zed-inspired color palette
        zed: {
          // Backgrounds (darkest to lightest)
          bg: {
            app: '#0a0a0a',           // Main app background
            panel: '#111111',         // Sidebar, panels
            surface: '#1a1a1a',       // Cards, elevated surfaces
            hover: '#1f1f1f',         // Hover states
            active: '#252525',        // Active/selected states
            overlay: '#2a2a2a',       // Overlays, modals
          },
          // Borders (subtle to prominent)
          border: {
            subtle: '#1a1a1a',        // Barely visible dividers
            default: '#252525',       // Standard borders
            focus: '#3a3a3a',         // Focused elements
            active: '#0b93f6',        // Active accent borders
          },
          // Text colors
          text: {
            primary: '#e6e6e6',       // Main text
            secondary: '#9e9e9e',     // Secondary text
            tertiary: '#6e6e6e',      // Muted text
            disabled: '#4e4e4e',      // Disabled text
            inverse: '#0a0a0a',       // Text on light backgrounds
          },
          // Accent colors
          accent: {
            blue: '#0b93f6',          // Primary action color
            blueHover: '#0d7bd9',     // Blue hover
            green: '#26d97f',         // Success
            greenHover: '#20b869',    // Green hover
            yellow: '#f5c249',        // Warning
            red: '#f23c3c',           // Error/destructive
            redHover: '#d93232',      // Red hover
            purple: '#b88ef2',        // Info/highlight
            orange: '#ff8c42',        // Alert
          },
          // Semantic colors
          semantic: {
            success: '#26d97f',
            warning: '#f5c249',
            error: '#f23c3c',
            info: '#0b93f6',
          },
          // Terminal colors (ANSI)
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
