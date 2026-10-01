import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// Serves the compiled contract (keys/ and zkir/) at the site root for FetchZkConfigProvider.
// Target esnext keeps top-level await native, which the ledger WASM bindings need.
export default defineConfig({
  publicDir: '../../contract/src/managed/lixi',
  plugins: [wasm()],
  build: { target: 'esnext' },
  optimizeDeps: { exclude: ['@midnight-ntwrk/onchain-runtime-v3'] },
});
