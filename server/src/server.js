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
  const releaseServerLock = acquireServerLock(config.databasePath);
  let db;
  let server;

  try {
    const databaseModule = await import('./database/connection.js');
    db = databaseModule.db;
    const [{ app }, { initializeDatabase }] = await Promise.all([
      import('./app.js'),
      import('./database/init.js'),
    ]);
    initializeDatabase();
    assertProductionReady(db, config.clientDistPath, {
      requireClientBuild: productionMode,
    });

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
    if (db?.open) db.close();
    releaseServerLock();
    throw error;
  }

  console.log("Leslie's Restaurant Management System is ready.");
  accessibleUrls().forEach((url) => console.log(`  ${url}`));
  console.log(`Database: ${config.databasePath}`);

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received. Closing the server safely...`);

    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections?.();
    }, 10_000);
    forceCloseTimer.unref();

    server.close((serverError) => {
      clearTimeout(forceCloseTimer);
      let shutdownError = serverError;

      try {
        if (db.open) {
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
