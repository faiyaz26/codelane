import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'RemoteDesktopExtension',
      fileName: () => 'bundle.js',
      formats: ['es']
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [], // bundle everything into the file so Codelane doesn't need to resolve node_modules
    }
  }
});
