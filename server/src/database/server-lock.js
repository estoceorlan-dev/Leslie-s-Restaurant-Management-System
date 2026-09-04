import fs from 'node:fs';
import path from 'node:path';

export function getServerLockPath(databasePath) {
  return `${databasePath}.server.pid`;
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

export function assertServerStopped(databasePath) {
  const lockPath = getServerLockPath(databasePath);
  if (!fs.existsSync(lockPath)) return;

  const lock = readLock(lockPath);
  if (processIsRunning(lock?.pid)) {
    throw new Error(
      `The Leslie's server is still running (process ${lock.pid}). Stop it before restoring the database.`,
    );
  }

  fs.rmSync(lockPath, { force: true });
}

export function acquireServerLock(databasePath) {
  const lockPath = getServerLockPath(databasePath);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  assertServerStopped(databasePath);

  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error("Another Leslie's server process is already starting.");
    }
    throw error;
  }

  fs.writeFileSync(
    descriptor,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );

  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.closeSync(descriptor);

    if (readLock(lockPath)?.pid === process.pid) {
      fs.rmSync(lockPath, { force: true });
    }
  };
}
