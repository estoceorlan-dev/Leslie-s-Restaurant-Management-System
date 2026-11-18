import { toFetchHandler } from 'srvx/node';

if (!process.env.DATABASE_URL) throw new Error('The restaurant function requires DATABASE_URL.');
const { app } = await import('./app.js');
const handle = toFetchHandler(app);
export default {
  fetch(request) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return new Response(null, { status: 404 });
    return handle(request);
  },
};
