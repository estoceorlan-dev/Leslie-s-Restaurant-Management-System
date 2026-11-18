export const config = {
  framework: 'vite',
  installCommand: 'npm ci --workspace leslies-client --include=dev',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${process.env.RESTAURANT_API_ORIGIN}/api/:path*` },
    { source: '/:path((?!api/|assets/).*)', destination: '/index.html' },
  ],
};
