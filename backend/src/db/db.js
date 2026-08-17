import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';
import { migrations } from './migrations/index.js';


const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'cartrack.db'));
// WAL lets readers/writers avoid blocking each other; busy_timeout makes a
// writer retry for a bit instead of throwing "database is locked" the
// instant it collides with another connection (e.g. the e2e test helpers'
// own short-lived connections writing to the same file concurrently).
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
runMigrations(db, migrations);

export { db };
