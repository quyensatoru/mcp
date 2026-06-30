import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(root, '..');

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, envDir, '');
    return {
        root,
        envDir,
        plugins: [react(), tailwind()],
        build: { outDir: 'dist', emptyOutDir: true },
        server: {
            port: 5173,
            allowedHosts: env.VITE_ALLOW_HOST?.split(',') || ['localhost'],
            proxy: {
                '/api': env.VITE_API_URL || 'http://localhost:4000',
            },
        },
    };
});
