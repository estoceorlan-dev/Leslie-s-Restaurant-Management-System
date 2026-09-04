import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const databaseExtensions = new Set(['.db', '.sqlite', '.sqlite3']);

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace('Z', '');
}

function backupFilename() {
  return `restaurant-backup-${timestamp()}.db`;
}

function resolveDestination(databasePath, requestedDestination) {
  if (!requestedDestination) {
    return path.join(path.dirname(databasePath), 'backups', backupFilename());
  }

  const destination = path.resolve(requestedDestination);
  if (fs.existsSync(destination) && fs.statSync(destination).isDirectory()) {
    return path.join(destination, backupFilename());
  }

  if (!databaseExtensions.has(path.extname(destination).toLowerCase())) {
    return path.join(destination, backupFilename());
  }

  return destination;
}

export function validateDatabase(
  databasePath,
  { requireApplicationSchema = false, makeStandalone = false } = {},
) {
  let database;
  try {
    database = new Database(databasePath, {
      readonly: !makeStandalone,
      fileMustExist: true,
    });
    const integrity = database.pragma('quick_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrity}`);
    }

    if (requireApplicationSchema) {
      const requiredTables = [
        'users',
        'auth_sessions',
        'categories',
        'menu_items',
        'restaurant_tables',
        'orders',
        'order_items',
        'inventory_items',
        'stock_movements',
      ];
      const rows = database.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `).all();
      const tableNames = new Set(rows.map((row) => row.name));
      const missingTables = requiredTables.filter((table) => !tableNames.has(table));
      if (missingTables.length > 0) {
        throw new Error(
          `Backup is not a Leslie's database; missing tables: ${missingTables.join(', ')}.`,
        );
      }
    }

    if (makeStandalone) {
      database.pragma('journal_mode = DELETE');
    }
  } finally {
    if (database?.open) database.close();
  }
}

export async function createBackup({
  databasePath = config.databasePath,
  destination: requestedDestination,
} = {}) {
  const sourcePath = path.resolve(databasePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Database does not exist: ${sourcePath}`);
  }

  const destination = resolveDestination(sourcePath, requestedDestination);
  if (destination === sourcePath) {
    throw new Error('Backup destination must be different from the active database.');
  }
  if (fs.existsSync(destination)) {
    throw new Error(`Backup destination already exists: ${destination}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const sourceDatabase = new Database(sourcePath, { readonly: true, fileMustExist: true });

  try {
    const integrity = sourceDatabase.pragma('quick_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`Active database integrity check failed: ${integrity}`);
    }
    await sourceDatabase.backup(destination);
    validateDatabase(destination, {
      requireApplicationSchema: true,
      makeStandalone: true,
    });
    return path.resolve(destination);
  } catch (error) {
    fs.rmSync(destination, { force: true });
    fs.rmSync(`${destination}-wal`, { force: true });
    fs.rmSync(`${destination}-shm`, { force: true });
    throw error;
  } finally {
    sourceDatabase.close();
  }
}

const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  createBackup({ destination: process.argv[2] })
    .then((destination) => console.log(`Database backup created: ${destination}`))
    .catch((error) => {
      console.error(`Database backup failed: ${error.message}`);
      process.exitCode = 1;
    });
}
