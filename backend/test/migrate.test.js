import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';


test('runMigrations creates every table on a fresh database', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);

  /** @type {{name: string}[]} */ // @ts-ignore
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
  const names = tables.map(t => t.name);
  for (const expected of [
    'users', 'sessions', 'allowed_emails',
    'vehicles', 'maintenance_items', 'service_history', 'mileage_history', 'fuel_history',
  ]) {
    assert.ok(names.includes(expected), `expected table "${expected}" to exist`);
  }
});

test('runMigrations records every migration as applied', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);

  /** @type {{version: number}[]} */ // @ts-ignore
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
  assert.deepEqual(applied.map(r => r.version), migrations.map(m => m.version));
});

test('running twice does not re-apply already-applied migrations', () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  assert.doesNotThrow(() => runMigrations(db, migrations));

  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get();
  assert.equal(count, migrations.length);
});
