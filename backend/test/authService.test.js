import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { addAllowedEmail } from '../src/db/allowedEmails.js';
import { createAuthService } from '../src/services/authService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeAuthService() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  return { authService: createAuthService(db), db };
}

test('createUser rejects an email that has not been allow-listed', () => {
  const { authService } = makeAuthService();
  assert.throws(
    () => authService.createUser('a@test.local', 'password123'),
    ServiceError
  );
});

test('createUser succeeds once the email has been allow-listed', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');
  assert.equal(user.email, 'a@test.local');
});

test('createUser rejects a duplicate email', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');
  assert.throws(
    () => authService.createUser('a@test.local', 'other-password'),
    ServiceError
  );
});

test('verifyLogin rejects a wrong password with a generic message', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  authService.createUser('a@test.local', 'password123');
  assert.throws(
    () => authService.verifyLogin('a@test.local', 'wrong-password'),
    ServiceError
  );
});

test('verifyLogin rejects an unknown email with the same generic message (does not leak which field was wrong)', () => {
  const { authService } = makeAuthService();
  assert.throws(
    () => authService.verifyLogin('nobody@test.local', 'whatever'),
    /Email o contraseña incorrectos/
  );
});

test('verifyLogin accepts the right password', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');
  const loggedIn = authService.verifyLogin('a@test.local', 'password123');
  assert.equal(loggedIn.id, user.id);
});

test('createSession then getUserBySessionToken resolves the same user', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');
  const token = authService.createSession(user.id);
  const resolved = authService.getUserBySessionToken(token);
  assert.equal(resolved.id, user.id);
  assert.equal(resolved.email, user.email);
});

test('deleteSession makes the token stop resolving', () => {
  const { authService, db } = makeAuthService();
  addAllowedEmail(db, 'a@test.local');
  const user = authService.createUser('a@test.local', 'password123');
  const token = authService.createSession(user.id);
  authService.deleteSession(token);
  assert.equal(authService.getUserBySessionToken(token), null);
});
