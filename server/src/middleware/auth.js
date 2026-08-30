import crypto from 'node:crypto';
import { db } from '../database/connection.js';

const SESSION_LENGTH_MS = 12 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_MS).toISOString();

  db.prepare("DELETE FROM auth_sessions WHERE datetime(expires_at) <= datetime('now')").run();
  db.prepare(`
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, hashToken(token), expiresAt);

  return { token, expiresAt };
}

export function deleteSession(token) {
  db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
}

function bearerToken(request) {
  const authorization = request.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function authenticate(request, response, next) {
  const token = bearerToken(request);

  if (!token) {
    return response.status(401).json({ error: 'Authentication is required.' });
  }

  const user = db.prepare(`
    SELECT users.id, users.name, users.username, users.role
    FROM auth_sessions
    INNER JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ?
      AND datetime(auth_sessions.expires_at) > datetime('now')
      AND users.is_active = 1
  `).get(hashToken(token));

  if (!user) {
    return response.status(401).json({ error: 'Your session is invalid or has expired.' });
  }

  request.user = user;
  request.authToken = token;
  return next();
}

export function requireRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'You do not have permission to perform this action.' });
    }

    return next();
  };
}
