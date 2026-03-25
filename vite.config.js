import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  root: path.join(__dirname, 'electron'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist-electron'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
