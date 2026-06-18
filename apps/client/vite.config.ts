import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Mobile browsers expose getUserMedia/getDisplayMedia only in a secure context.
// Set HTTPS=true to serve the dev server over self-signed TLS so phones on the
// LAN (http://<ip> is insecure) can capture mic/screen. Accept the cert warning
// once on the device.
const useHttps = process.env.HTTPS === 'true';

/**
 * Client dev/build config. Workspace packages are consumed as source via
 * aliases (no prebuild step). In dev we proxy the HTTP API and the Socket.IO
 * websocket to the backend on :3000 so the browser talks to a single origin.
 */
export default defineConfig({
  plugins: useHttps ? [basicSsl()] : [],
  resolve: {
    alias: {
      '@vibecam/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@vibecam/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Bind all interfaces so other devices on the network can reach the dev server.
    host: true,
    proxy: {
      '/health': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
