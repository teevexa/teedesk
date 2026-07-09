import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'SupportIQWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle React into the widget so the host page needs no dependencies
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
    // Single output file — easy for customers to add a <script> tag
    outDir: 'dist',
    emptyOutDir: true,
  },
});
