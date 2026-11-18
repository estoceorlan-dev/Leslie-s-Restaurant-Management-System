import os from 'node:os';
import { config } from './config.js';
import { acquireServerLock } from './database/server-lock.js';
import { assertProductionReady } from './production-readiness.js';

function accessibleUrls() {
  if (config.host !== '0.0.0.0' && config.host !== '::') {
    return [`http://${config.host}:${config.port}`];
  }

  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((address) => address?.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${config.port}`);

  return [
    `http://localhost:${config.port}`,
    `http://${os.hostname()}:${config.port}`,
    ...addresses,
  ];
}

async function startServer() {
  const productionMode = process.argv.includes('--production');
  const postgres = Boolean(process.env.DATABASE_URL);
  const releaseServerLock = postgres ? () => {} : acquireServerLock(config.databasePath);
  let db;
  let server;

  try {
    const { app } = await import('./app.js');
    if (postgres) {
      ({ db } = await import('./database/queries.js'));
      if (!await db.get("SELECT 1 FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1")) {
        throw new Error('Run npm run admin:create before starting the server.');
      }
    } else {
      ({ db } = await import('./database/connection.js'));
      const { initializeDatabase } = await import('./database/init.js');
      initializeDatabase(db);
      assertProductionReady(db, config.clientDistPath, { requireClientBuild: productionMode });
    }

    server = app.listen({ host: config.host, port: config.port });
    await new Promise((resolve, reject) => {
      const handleListening = () => {
        server.off('error', handleError);
        resolve();
      };
      const handleError = (error) => {
        server.off('listening', handleListening);
        reject(error);
      };
      server.once('listening', handleListening);
      server.once('error', handleError);
    });
  } catch (error) {
    if (postgres || db?.open) await db?.close();
    releaseServerLock();
    throw error;
  }

  console.log("Leslie's Restaurant Management System is ready.");
  accessibleUrls().forEach((url) => console.log(`  ${url}`));
  console.log(`Database: ${postgres ? "PostgreSQL" : config.databasePath}`);

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received. Closing the server safely...`);

    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections?.();
    }, 10_000);
    forceCloseTimer.unref();

    server.close(async (serverError) => {
      clearTimeout(forceCloseTimer);
      let shutdownError = serverError;

      try {
        if (postgres) await db.close();
        else if (db.open) {
          db.pragma('wal_checkpoint(TRUNCATE)');
          db.close();
        }
      } catch (error) {
        shutdownError ??= error;
      } finally {
        releaseServerLock();
      }

      if (shutdownError) {
        console.error('The server encountered an error while shutting down:', shutdownError);
        process.exitCode = 1;
      } else {
        console.log('Server stopped and database closed.');
      }
    });
    server.closeIdleConnections?.();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('Unable to start the server:', error.message);
  process.exitCode = 1;
});
