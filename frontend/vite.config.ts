/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [solid()],

  // Vitest configuration
  test: {
    environment: "node",
    globals: true,
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "localhost",
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build optimizations for Tauri
  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split Shiki language grammars into separate chunks (lazy load)
          if (id.includes('shiki/dist/langs/')) {
            const lang = id.match(/langs\/([^.]+)/)?.[1];
            return lang ? `lang-${lang}` : undefined;
          }

          // Split Shiki themes into a separate chunk
          if (id.includes('shiki/dist/themes/')) {
            return 'shiki-themes';
          }

          // Split Xterm.js addons (lazy load terminal features)
          if (id.includes('@xterm/addon-')) {
            const addon = id.match(/addon-([^/]+)/)?.[1];
            return addon ? `xterm-addon-${addon}` : 'xterm-addons';
          }

          // Split large vendor libraries
          if (id.includes('node_modules')) {
            // SolidJS core (small, keep together)
            if (id.includes('solid-js')) {
              return 'vendor-solid';
            }

            // Xterm.js core terminal
            if (id.includes('@xterm/xterm')) {
              return 'vendor-xterm';
            }

            // Git diff viewer
            if (id.includes('@git-diff-view/')) {
              return 'vendor-diff';
            }

            // Tiptap editor (if used)
            if (id.includes('@tiptap/') || id.includes('solid-tiptap')) {
              return 'vendor-editor';
            }

            // Kobalte UI components
            if (id.includes('@kobalte/')) {
              return 'vendor-ui';
            }

            // All other node_modules
            return 'vendor';
          }
        },
      },
    },
  },

  // Prevent Vite from obscuring Rust errors
  envPrefix: ["VITE_", "TAURI_"],
}))
