import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  define: { 'import.meta.env.VITE_CINE_PLATFORM': JSON.stringify(['mobile', 'tv'].includes(mode) ? mode : process.env.VITE_CINE_PLATFORM || 'auto') },
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../android/app/src/main/assets', emptyOutDir: true, target: 'es2022' },
}));
