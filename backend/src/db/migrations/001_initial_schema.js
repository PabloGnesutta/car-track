/**
 * Baseline schema: accounts (users/sessions/allowed_emails) plus the app's
 * domain tables, all scoped by user_id. Single source of truth (no local
 * offline copy), so plain hard deletes with server-side cascades - no
 * tombstones/soft-delete needed anywhere.
 */
const sql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  initial_mileage INTEGER NOT NULL,
  current_mileage INTEGER NOT NULL,
  current_mileage_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  interval_km INTEGER,
  interval_days INTEGER,
  last_service_mileage INTEGER,
  last_service_date INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS service_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES maintenance_items(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mileage INTEGER NOT NULL,
  date INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  cost REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mileage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mileage INTEGER NOT NULL,
  previous_mileage INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  date INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fuel_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mileage INTEGER NOT NULL,
  liters REAL NOT NULL,
  cost REAL,
  date INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
`;

export { sql };
