import crypto from 'node:crypto';
import { db } from '../database/queries.js';

const SESSION_LENGTH_MS = 12 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_MS).toISOString();

  await db.run("DELETE FROM auth_sessions WHERE expires_at <= ?", new Date().toISOString());
  await db.run(`
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `, userId, hashToken(token), expiresAt);

  return { token, expiresAt };
}

export async function deleteSession(token) {
  await db.run('DELETE FROM auth_sessions WHERE token_hash = ?', hashToken(token));
}

function bearerToken(request) {
  const authorization = request.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function authenticate(request, response, next) {
  const token = bearerToken(request);

  if (!token) {
    return response.status(401).json({ error: 'Authentication is required.' });
  }

  const user = await db.get(`
    SELECT users.id, users.name, users.username, users.role
    FROM auth_sessions
    INNER JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ?
      AND auth_sessions.expires_at > ?
      AND users.is_active = 1
  `, hashToken(token), new Date().toISOString());

  if (!user) {
    return response.status(401).json({ error: 'Your session is invalid or has expired.' });
  }

  request.user = user;
  request.authToken = token;
  return next();
}

export function requireRoles(...roles) {
  return async (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'You do not have permission to perform this action.' });
    }

    return next();
  };
}
