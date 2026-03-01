/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isTest = mode === 'test' || !!process.env.VITEST;

  return {
    plugins: [
      solid({ 
        // Explicitly disable hot reload in tests to fix Windows "file:///@solid-refresh" error
        // We use both mode and VITEST env var for maximum reliability in CI
        hot: !isTest,
        ssr: false 
      })
    ],

    // Vitest configuration
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ['./src/test-utils/setup.ts'],
      // Recommended SolidJS Vitest settings
      server: {
        deps: {
          inline: [/solid-js/, /@solidjs\/testing-library/, /@kobalte\/core/],
        }
      },
    },

    // SolidJS requires these conditions to avoid "multiple instances" issues and correctly load browser entry points
    resolve: {
      conditions: isTest ? ['development', 'browser'] : ['browser'],
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

              // Tiptap editor - DON'T bundle into vendor chunk to avoid circular dependency
              // It will stay with the lazy-loaded MarkdownEditor component
              if (id.includes('@tiptap/') || id.includes('solid-tiptap') || id.includes('tiptap-')) {
                return undefined; // Don't create a vendor chunk, leave in the lazy component
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
  };
});
