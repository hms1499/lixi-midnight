import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Logic tests run in Node; page tests opt into jsdom with `// @vitest-environment jsdom`.
export default defineConfig({
  plugins: [react()],
  test: { include: ['test/**/*.test.{ts,tsx}'] },
});
