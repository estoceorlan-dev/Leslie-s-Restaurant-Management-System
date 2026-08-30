import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection.js';
import {
  authenticate,
  createSession,
  deleteSession,
} from '../middleware/auth.js';

export const authRouter = express.Router();

authRouter.post('/login', (request, response) => {
  const username = typeof request.body.username === 'string'
    ? request.body.username.trim()
    : '';
  const password = typeof request.body.password === 'string'
    ? request.body.password
    : '';

  if (!username || !password) {
    return response.status(400).json({ error: 'Username and password are required.' });
  }

  const account = db.prepare(`
    SELECT id, name, username, password_hash, role
    FROM users
    WHERE username = ? AND is_active = 1
  `).get(username);

  if (!account || !bcrypt.compareSync(password, account.password_hash)) {
    return response.status(401).json({ error: 'Incorrect username or password.' });
  }

  const { password_hash: _passwordHash, ...user } = account;
  const session = createSession(account.id);
  return response.json({ data: { user, ...session } });
});

authRouter.get('/me', authenticate, (request, response) => {
  response.json({ data: request.user });
});

authRouter.post('/logout', authenticate, (request, response) => {
  deleteSession(request.authToken);
  response.status(204).end();
});
