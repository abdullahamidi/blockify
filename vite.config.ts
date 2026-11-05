/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WASM_SRC = resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

/** MediaPipe wasm dosyalarını /mediapipe/ altından kendi sunucumuzdan servis eder. */
function mediapipeWasm(): Plugin {
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe/', (req, res, next) => {
        const file = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!WASM_FILES.includes(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(WASM_SRC, file)));
      });
    },
    writeBundle(opts) {
      const out = resolve(opts.dir ?? 'dist', 'mediapipe');
      if (!existsSync(out)) mkdirSync(out, { recursive: true });
      for (const f of WASM_FILES) copyFileSync(resolve(WASM_SRC, f), resolve(out, f));
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipeWasm()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
