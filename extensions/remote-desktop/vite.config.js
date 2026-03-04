import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'CodeLaneRemoteDesktop',
      fileName: () => 'bundle.js',
      formats: ['iife']
    },
    minify: true,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [],
      output: {
        exports: 'none', // We attach to window manually in index.js
        extend: true,
      }
    }
  }
});
