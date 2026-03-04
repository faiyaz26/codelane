/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../../packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        zed: {
          bg: {
            app: 'rgb(var(--zed-bg-app) / <alpha-value>)',
            panel: 'rgb(var(--zed-bg-panel) / <alpha-value>)',
            surface: 'rgb(var(--zed-bg-surface) / <alpha-value>)',
            hover: 'rgb(var(--zed-bg-hover) / <alpha-value>)',
            active: 'rgb(var(--zed-bg-active) / <alpha-value>)',
            overlay: 'rgb(var(--zed-bg-overlay) / <alpha-value>)',
          },
          border: {
            subtle: 'rgb(var(--zed-border-subtle) / <alpha-value>)',
            default: 'rgb(var(--zed-border-default) / <alpha-value>)',
            focus: 'rgb(var(--zed-border-focus) / <alpha-value>)',
            active: 'rgb(var(--zed-border-active) / <alpha-value>)',
          },
          text: {
            primary: 'rgb(var(--zed-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--zed-text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--zed-text-tertiary) / <alpha-value>)',
            disabled: 'rgb(var(--zed-text-disabled) / <alpha-value>)',
            inverse: 'rgb(var(--zed-text-inverse) / <alpha-value>)',
          },
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
        },
      },
    },
  },
  plugins: [],
};
