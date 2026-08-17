import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Matches DB_NAME in playwright.config.js's webServer.env - the e2e suite's
// own database file, isolated from whatever a manually-run dev server uses.
const DB_PATH = join(__dirname, '../../../backend/data/cartrack.test.db');

/**
 * Sweeps every e2e-created account (and its data) out of the backend's
 * sqlite file once the whole suite finishes. Each test run creates
 * brand-new `e2e+...@test.local` accounts (see helpers.js's ensureAuth) -
 * the sqlite file isn't reset between runs the way a fresh browser context
 * resets IndexedDB, so without this the accounts/whitelist entries would
 * accumulate indefinitely across local runs.
 */
export default async function globalTeardown() {
  let db;
  try {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA busy_timeout = 5000');
  } catch {
    return; // backend never created a db file (e.g. suite failed before any test ran)
  }

  try {
    const users = db.prepare(`SELECT id FROM users WHERE email LIKE 'e2e+%@test.local'`).all();
    for (const { id } of users) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare(
        `DELETE FROM service_history WHERE item_id IN (SELECT id FROM maintenance_items WHERE user_id = ?)`
      ).run(id);
      db.prepare('DELETE FROM mileage_history WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM fuel_history WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM maintenance_items WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM vehicles WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
    db.prepare(`DELETE FROM allowed_emails WHERE email LIKE 'e2e+%@test.local'`).run();
  } finally {
    db.close();
  }
}
