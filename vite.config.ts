/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The server build is emitted to dist/ by tsc; keep client assets separate
    // so the server never exposes its own compiled files.
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
