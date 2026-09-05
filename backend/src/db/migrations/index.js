import { sql as initialSchema } from './001_initial_schema.js';
import { sql as sessionExpiry } from './002_session_expiry.js';

/**
 * Ordered, explicit registry (no directory-scanning) - add new migrations by
 * creating NNN_description.js (exporting `sql`) and appending it here with
 * the next version number. Never edit an already-applied migration's SQL
 * after it's shipped - add a new one instead.
 * @type {{version: number, name: string, sql: string}[]}
 */
const migrations = [
  { version: 1, name: 'initial_schema', sql: initialSchema },
  { version: 2, name: 'session_expiry', sql: sessionExpiry },
];

export { migrations };
