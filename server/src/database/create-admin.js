import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { acquireServerLock } from './server-lock.js';

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 128;

export function validateInitialAdmin({ name, username, password }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanUsername = typeof username === 'string' ? username.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new Error('Administrator name must be between 2 and 80 characters.');
  }
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(cleanUsername)) {
    throw new Error(
      'Username must be 3-30 characters using letters, numbers, dots, dashes, or underscores.',
    );
  }
  if (typeof password !== 'string'
      || password.length < MINIMUM_PASSWORD_LENGTH
      || password.length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be between ${MINIMUM_PASSWORD_LENGTH} and ${MAXIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  return { name: cleanName, username: cleanUsername, password };
}

export function createInitialAdmin(database, details) {
  const admin = validateInitialAdmin(details);
  const userCount = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) {
    throw new Error(
      'Initial administrator creation is disabled because an account already exists. '
      + 'Use the employee-management screen instead.',
    );
  }

  const result = database.prepare(`
    INSERT INTO users (name, username, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run(admin.name, admin.username, bcrypt.hashSync(admin.password, 12));

  return {
    id: Number(result.lastInsertRowid),
    name: admin.name,
    username: admin.username,
    role: 'admin',
  };
}

async function visiblePrompts() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return {
      name: await prompt.question('Administrator name: '),
      username: await prompt.question('Administrator username: '),
    };
  } finally {
    prompt.close();
  }
}

function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('Administrator creation requires an interactive terminal.');
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdout.write(label);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new Error('Administrator creation cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      if (!key.ctrl && !key.meta && text) {
        value += text;
        process.stdout.write('*');
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('Administrator creation requires an interactive terminal.');
  }
  const identity = await visiblePrompts();
  const password = await hiddenPrompt('Password (12-128 characters): ');
  const confirmation = await hiddenPrompt('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const releaseServerLock = acquireServerLock(config.databasePath);
  let database;
  try {
    const [{ db }, { initializeDatabase }] = await Promise.all([
      import('./connection.js'),
      import('./init.js'),
    ]);
    database = db;
    initializeDatabase(database);
    const admin = createInitialAdmin(database, { ...identity, password });
    console.log(`Administrator created: ${admin.name} (@${admin.username})`);
  } finally {
    if (database?.open) database.close();
    releaseServerLock();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Unable to create administrator: ${error.message}`);
    process.exitCode = 1;
  });
}
