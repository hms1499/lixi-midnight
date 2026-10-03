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
    // The Midnight libraries make one ~1 MB chunk (plus ~11 MB of WASM); nothing to gain from splitting it.
    build: { target: 'esnext', chunkSizeWarningLimit: 1500 },
    optimizeDeps: { exclude: ['@midnight-ntwrk/onchain-runtime-v3'] },
  };
});
