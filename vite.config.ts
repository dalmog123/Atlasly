import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Keep the 3D engine in its own long-lived chunk.
        manualChunks: (id: string) =>
          /node_modules[\\/](three|three-globe|globe\.gl)[\\/]/.test(id) ? 'globe-engine' : undefined,
      },
    },
  },
});
