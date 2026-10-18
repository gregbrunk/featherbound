import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The paid quality suite (quality/*.quality.ts). Run with `npm run quality`; needs AI_GATEWAY_API_KEY.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
    },
  },
  test: { include: ['quality/**/*.quality.ts'], testTimeout: 600_000 },
});
