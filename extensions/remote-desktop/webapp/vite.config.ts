import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'CodeLane Remote',
        short_name: 'CodeLane',
        description: 'Remote access for CodeLane Desktop',
        theme_color: '#181818',
        icons: []
      }
    })
  ],
  server: {
    port: 3005,
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@codelane/shared': path.resolve(__dirname, '../../../packages/shared/src'),
    },
  },
});
