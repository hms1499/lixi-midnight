import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { appConfig } from './src/config.ts';
import { cspFor } from './src/csp.ts';

/** Adds the CSP meta tag to the built page only: the dev server needs inline scripts for hot reload. */
const csp = (policy: string): Plugin => ({
  name: 'lixi-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
  ],
});

// Target esnext keeps top-level await native, which the ledger WASM bindings need (spike S4).
export default defineConfig(({ mode }) => {
  // Throws with the variable to set when the Blockfrost project id is missing, before anything is served or built.
  const { network } = appConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [react(), tailwindcss(), wasm(), csp(cspFor(network))],
    // The SDK pages load lazily, so the shell paints without the ~11 MB of WASM (user moments spec §3.1).
    // The manifest lets scripts/check-entry.ts prove it after every build.
    build: { target: 'esnext', chunkSizeWarningLimit: 1500, manifest: true },
    optimizeDeps: { exclude: ['@midnight-ntwrk/onchain-runtime-v3'] },
  };
});
