import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host 0.0.0.0 — dostęp spoza kontenera; polling — hot reload działa też na zamontowanych dyskach Windows
  server: { host: '0.0.0.0', port: 5173, watch: { usePolling: true } },
});
