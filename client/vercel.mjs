import { deploymentEnv, routes } from '@vercel/config/v1';

export const config = {
  framework: 'vite',
  installCommand: 'npm ci --workspace leslies-client --include=dev',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    routes.rewrite('/api/:path*', `${deploymentEnv('RESTAURANT_API_ORIGIN')}/api/:path*`),
    routes.rewrite('/:path((?!api/|assets/).*)', '/index.html'),
  ],
};
