import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { createBackup, validateDatabase } from './backup.js';
import { acquireServerLock } from './server-lock.js';

function safetyBackupPath(databasePath) {
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace('Z', '');
  return path.join(
    path.dirname(databasePath),
    'backups',
    `before-restore-${timestamp}.db`,
  );
}

function checkpointDatabase(databasePath) {
  if (!fs.existsSync(databasePath)) return;

  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    database.close();
  }
}

export async function restoreBackup({
  databasePath = config.databasePath,
  backupPath,
} = {}) {
  if (!backupPath) {
    throw new Error('Provide the backup file to restore.');
  }

  const targetPath = path.resolve(databasePath);
  const sourcePath = path.resolve(backupPath);
  if (sourcePath === targetPath) {
    throw new Error('The backup file must be different from the active database.');
  }

  const releaseDatabaseLock = acquireServerLock(targetPath);
  try {
    return await restoreDatabaseFiles(targetPath, sourcePath);
  } finally {
    releaseDatabaseLock();
  }
}

async function restoreDatabaseFiles(targetPath, sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error(`Backup does not exist: ${sourcePath}`);

  const temporaryPath = `${targetPath}.restore-${process.pid}-${Date.now()}.tmp`;
  const rollbackPath = `${targetPath}.before-restore-${process.pid}`;
  let safetyBackup = null;
  let movedCurrentDatabase = false;
  let installedRestoredDatabase = false;

  try {
    fs.copyFileSync(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
    validateDatabase(temporaryPath, {
      requireApplicationSchema: true,
      makeStandalone: true,
    });

    if (fs.existsSync(targetPath)) {
      safetyBackup = await createBackup({
        databasePath: targetPath,
        destination: safetyBackupPath(targetPath),
      });
      checkpointDatabase(targetPath);
    }

    if (fs.existsSync(targetPath)) {
      fs.renameSync(targetPath, rollbackPath);
      movedCurrentDatabase = true;
    }
    fs.rmSync(`${targetPath}-wal`, { force: true });
    fs.rmSync(`${targetPath}-shm`, { force: true });
    fs.renameSync(temporaryPath, targetPath);
    installedRestoredDatabase = true;
    validateDatabase(targetPath, {
      requireApplicationSchema: true,
      makeStandalone: true,
    });

    if (movedCurrentDatabase) fs.rmSync(rollbackPath, { force: true });
    return { databasePath: targetPath, safetyBackup };
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(`${temporaryPath}-wal`, { force: true });
    fs.rmSync(`${temporaryPath}-shm`, { force: true });

    if (movedCurrentDatabase && fs.existsSync(rollbackPath)) {
      fs.rmSync(targetPath, { force: true });
      fs.rmSync(`${targetPath}-wal`, { force: true });
      fs.rmSync(`${targetPath}-shm`, { force: true });
      fs.renameSync(rollbackPath, targetPath);
    } else if (installedRestoredDatabase) {
      fs.rmSync(targetPath, { force: true });
      fs.rmSync(`${targetPath}-wal`, { force: true });
      fs.rmSync(`${targetPath}-shm`, { force: true });
    }
    throw error;
  }
}

const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  restoreBackup({ backupPath: process.argv[2] })
    .then(({ databasePath, safetyBackup }) => {
      console.log(`Database restored: ${databasePath}`);
      if (safetyBackup) console.log(`Previous database backup: ${safetyBackup}`);
    })
    .catch((error) => {
      console.error(`Database restore failed: ${error.message}`);
      process.exitCode = 1;
    });
}
