import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'electron-store',
      ],
      output: {
        entryFileNames: 'preload.js',
      },
    },
  },
});
