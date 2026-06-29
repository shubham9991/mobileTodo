import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    react(),
    // Inlines ALL JS + CSS into one self-contained index.html.
    // Zero HTTP requests, zero CORS issues — loads from android_asset instantly.
    viteSingleFile(),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false, drop_debugger: false },
    },
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
