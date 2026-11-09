import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api calls are forwarded to the Express server so no secrets or CORS setup are needed in the browser.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
