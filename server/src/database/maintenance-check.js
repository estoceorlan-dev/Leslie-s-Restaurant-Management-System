import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createBackup } from './backup.js';
import { restoreBackup } from './restore.js';
import { getServerLockPath } from './server-lock.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(currentDirectory, 'schema.sql'), 'utf8');
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'leslies-maintenance-check-'),
);
const databasePath = path.join(temporaryDirectory, 'restaurant.db');

function categoryName() {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return database.prepare('SELECT name FROM categories WHERE id = 1').pluck().get();
  } finally {
    database.close();
  }
}

try {
  let database = new Database(databasePath);
  database.exec(schema);
  database.prepare('INSERT INTO categories (name) VALUES (?)').run('Original record');
  database.close();

  const backupPath = await createBackup({
    databasePath,
    destination: path.join(temporaryDirectory, 'backups'),
  });
  assert.ok(fs.existsSync(backupPath), 'The backup command should create a database file.');
  assert.deepEqual(
    fs.readdirSync(path.dirname(backupPath)),
    [path.basename(backupPath)],
    'A completed backup should not leave WAL or shared-memory sidecar files.',
  );

  database = new Database(databasePath);
  database.prepare('UPDATE categories SET name = ? WHERE id = 1').run('Changed record');
  database.close();

  fs.writeFileSync(
    getServerLockPath(databasePath),
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );
  await assert.rejects(
    restoreBackup({ databasePath, backupPath }),
    /still running/,
    'Restore should be rejected while the server lock belongs to a running process.',
  );
  fs.rmSync(getServerLockPath(databasePath), { force: true });
  assert.equal(categoryName(), 'Changed record', 'A rejected restore must not change data.');

  const restoreResult = await restoreBackup({ databasePath, backupPath });
  assert.equal(categoryName(), 'Original record', 'Restoring should recover the backed-up data.');
  assert.ok(
    fs.existsSync(restoreResult.safetyBackup),
    'Restore should preserve the previous database as a safety backup.',
  );

  const corruptBackupPath = path.join(temporaryDirectory, 'corrupt.db');
  fs.writeFileSync(corruptBackupPath, 'not a SQLite database');
  await assert.rejects(
    restoreBackup({ databasePath, backupPath: corruptBackupPath }),
    /database|SQLite/i,
    'Restore should reject corrupt input.',
  );
  assert.equal(categoryName(), 'Original record', 'Corrupt input must not replace current data.');

  console.log('SQLite maintenance checks passed:', {
    onlineBackup: 'passed',
    serverRunningProtection: 'passed',
    restoreSafetyBackup: 'passed',
    corruptBackupRejection: 'passed',
    persistenceAfterReopen: 'passed',
  });
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
