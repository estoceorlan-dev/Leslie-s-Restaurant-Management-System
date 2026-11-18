if (!process.env.RESTAURANT_API_ORIGIN) throw new Error('Set RESTAURANT_API_ORIGIN to the Neon function URL.');
const origin = new URL(process.env.RESTAURANT_API_ORIGIN);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.href !== origin.origin + '/') {
  throw new Error('Set RESTAURANT_API_ORIGIN to the HTTPS origin of the Neon restaurant function.');
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci --workspace leslies-client --include=dev',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: origin.origin + '/api/:path*' },
    { source: '/:path((?!api/|assets/).*)', destination: '/index.html' },
  ],
};
