import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5183, host: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
