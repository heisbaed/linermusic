import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../android/app/src/main/assets', emptyOutDir: true, target: 'es2022' },
});
