import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from '../config.js';

const Database = createRequire(import.meta.url)('better-sqlite3');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

