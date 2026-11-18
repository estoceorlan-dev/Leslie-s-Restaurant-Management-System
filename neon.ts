import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  functions: {
    restaurant: {
      name: "Leslie's restaurant API",
      source: './server/src/function.js',
      externalPackages: ['sharp'],
    },
  },
});
