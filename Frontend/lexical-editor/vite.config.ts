import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Inlines ALL JS + CSS into one self-contained index.html.
    // This is the critical trick: zero HTTP requests, zero CORS issues,
    // loads from android_asset instantly with no flash.
    viteSingleFile(),
  ],
  build: {
    target: 'esnext',
    // Minify aggressively — smaller HTML = faster load into WebView
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    // viteSingleFile needs assetsInlineLimit very high
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        // Must be true so viteSingleFile can inline everything
        inlineDynamicImports: true,
      },
    },
  },
});
