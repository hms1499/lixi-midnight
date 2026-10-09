import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite';
import base from './vite.config.ts';

/** Serves demo/index.html for every page request, so BrowserRouter paths work on the demo server. */
const demoPages = (): Plugin => ({
  name: 'lixi-demo-pages',
  configureServer: (server) => {
    server.middlewares.use((req, _res, next) => {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) req.url = '/demo/index.html';
      next();
    });
  },
});

// Dev-only (demo video spec §5.4): the build input stays index.html, and check-entry fails if demo/ appears.
export default defineConfig((env) =>
  mergeConfig((base as (e: typeof env) => UserConfig)(env), {
    plugins: [demoPages()],
    server: { port: 5180, strictPort: true },
  }),
);
