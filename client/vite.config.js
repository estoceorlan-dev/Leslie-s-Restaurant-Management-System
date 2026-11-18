import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { functionBaseUrl } from '@neon/env';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const apiOrigin = env.RESTAURANT_API_ORIGIN
    || (env.NEON_BRANCH_ID && env.NEON_FUNCTION_HOST_SUFFIX
      ? functionBaseUrl('restaurant', env)
      : 'http://localhost:3000');
  const proxy = { '/api': { target: apiOrigin, changeOrigin: true } };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy,
    },
    preview: { proxy },
  };
});
