import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root,
    plugins: [react(), tailwind()],
    build: { outDir: 'dist', emptyOutDir: true },
    server: {
        port: 5173,
        // Only proxy HTTP API. WebSockets connect straight to the console server
        // (see WS_BASE in src/api.js) to avoid Vite's noisy ws-proxy socket errors.
        proxy: {
            '/api': 'http://localhost:4000',
        },
    },
});
