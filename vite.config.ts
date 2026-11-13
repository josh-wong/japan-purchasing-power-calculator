import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Build the calculator and the privacy notice as separate pages that share styles and scripts.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
});
