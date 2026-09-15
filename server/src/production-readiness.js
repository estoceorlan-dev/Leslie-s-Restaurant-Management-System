import fs from 'node:fs';
import path from 'node:path';

export function assertProductionReady(
  database,
  clientDistPath,
  { requireClientBuild = true } = {},
) {
  if (requireClientBuild) {
    const applicationEntry = path.join(clientDistPath, 'index.html');
    if (!fs.existsSync(applicationEntry)) {
      throw new Error('The production frontend is missing. Run "npm run build" first.');
    }
  }

  const activeAdministrators = database.prepare(`
    SELECT COUNT(*) AS count
    FROM users
    WHERE role = 'admin' AND is_active = 1
  `).get().count;
  if (activeAdministrators === 0) {
    throw new Error(
      'No active administrator exists. Run "npm run admin:create" before starting production.',
    );
  }
}
