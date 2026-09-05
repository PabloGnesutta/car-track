import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../auth/passwordHash.js';
import { isEmailAllowed } from '../db/allowedEmails.js';
import { ServiceError } from './ServiceError.js';


/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function createAuthService(db) {
  /**
   * @param {string} email
   * @param {string} password
   * @param {string} [name]
   */
  function createUser(email, password, name = '') {
    email = String(email || '').trim().toLowerCase();
    if (!email || !password) { throw new ServiceError('Email y contraseña requeridos'); }
    if (!isEmailAllowed(db, email)) { throw new ServiceError('Este email no está autorizado para crear una cuenta'); }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) { throw new ServiceError('Ya existe una cuenta con ese email'); }

    const info = db.prepare(
      'INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)'
    ).run(email, hashPassword(password), name, Date.now());

    return { id: Number(info.lastInsertRowid), email, name };
  }

  /**
   * @param {string} email
   * @param {string} password
   */
  function verifyLogin(email, password) {
    email = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, /** @type {string} */(user.password_hash))) {
      throw new ServiceError('Email o contraseña incorrectos');
    }
    return user;
  }

  /**
   * @param {number} userId
   * @returns {string} the new bearer token
   */
  function createSession(userId) {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(token, userId, now, now + SESSION_TTL_MS);
    return token;
  }

  /**
   * @param {string} token
   */
  function getUserBySessionToken(token) {
    if (!token) { return null; }
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);
    if (!session) { return null; }
    if (session.expires_at != null && Number(session.expires_at) < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(session.user_id);
    return user || null;
  }

  /**
   * @param {string} token
   */
  function deleteSession(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  return { createUser, verifyLogin, createSession, getUserBySessionToken, deleteSession };
}

export { createAuthService };
