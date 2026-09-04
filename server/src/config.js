import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function configuredPort(value) {
  if (value === undefined || value === '') return 3000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export const config = {
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: configuredPort(process.env.PORT),
  databasePath: path.resolve(
    process.env.DATABASE_PATH ??
      path.resolve(currentDirectory, '../data/restaurant.db'),
  ),
  clientDistPath: path.resolve(currentDirectory, '../../client/dist'),
};
