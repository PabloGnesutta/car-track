import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { createVehicleService } from '../src/services/vehicleService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeVehicleService() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  makeUser(db, 1);
  makeUser(db, 2);
  return { vehicleService: createVehicleService(db), db };
}

/**
 * vehicles.user_id has a FOREIGN KEY REFERENCES users(id), enforced by
 * default by node:sqlite's DatabaseSync - tests need a real user row to
 * attach owned rows to, not just an arbitrary integer id.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} id
 */
function makeUser(db, id) {
  db.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, `user${id}@test.local`, 'salt:hash', '', Date.now());
}

test('createVehicle also writes an initial mileage_history row', () => {
  const { vehicleService, db } = makeVehicleService();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 1000 });
  assert.equal(vehicle.currentMileage, 1000);

  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM mileage_history WHERE vehicle_id = ?').get(vehicle.id);
  assert.equal(count, 1);
});

test('a user cannot read another user\'s vehicle', () => {
  const { vehicleService } = makeVehicleService();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 1000 });
  assert.throws(() => vehicleService.updateVehicle(2, vehicle.id, { name: 'Hijacked' }), ServiceError);
});

test('listVehicles only returns the requesting user\'s vehicles', () => {
  const { vehicleService } = makeVehicleService();
  vehicleService.createVehicle(1, { name: 'User1 car', initialMileage: 0 });
  vehicleService.createVehicle(2, { name: 'User2 car', initialMileage: 0 });
  const list = vehicleService.listVehicles(1);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'User1 car');
});

test('logMileage rejects a mileage lower than the current one', () => {
  const { vehicleService } = makeVehicleService();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 1000 });
  assert.throws(() => vehicleService.logMileage(1, vehicle.id, { mileage: 500 }), ServiceError);
});

test('logMileage updates the vehicle and inserts a history row atomically', () => {
  const { vehicleService, db } = makeVehicleService();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 1000 });
  const { vehicle: updated, mileageRecord } = vehicleService.logMileage(1, vehicle.id, { mileage: 1500, notes: 'road trip' });

  assert.equal(updated.currentMileage, 1500);
  assert.equal(mileageRecord.mileage, 1500);
  assert.equal(mileageRecord.previousMileage, 1000);
  assert.equal(mileageRecord.distance, 500);

  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM mileage_history WHERE vehicle_id = ?').get(vehicle.id);
  assert.equal(count, 2); // initial + this one
});

test('deleteVehicle cascades to maintenance items, service history, mileage history and fuel history', () => {
  const { vehicleService, db } = makeVehicleService();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 1000 });
  const now = Date.now();

  db.prepare(
    `INSERT INTO maintenance_items (vehicle_id, user_id, name, normalized_name, interval_km, last_service_mileage, last_service_date, created_at, updated_at)
     VALUES (?, 1, 'Oil', 'oil', 5000, 1000, ?, ?, ?)`
  ).run(vehicle.id, now, now, now);
  const itemId = Number(db.prepare('SELECT id FROM maintenance_items WHERE vehicle_id = ?').get(vehicle.id).id);

  db.prepare(`INSERT INTO service_history (item_id, user_id, mileage, date, created_at) VALUES (?, 1, 1000, ?, ?)`)
    .run(itemId, now, now);
  db.prepare(`INSERT INTO fuel_history (vehicle_id, user_id, mileage, liters, date, created_at) VALUES (?, 1, 1000, 40, ?, ?)`)
    .run(vehicle.id, now, now);

  vehicleService.deleteVehicle(1, vehicle.id);

  for (const table of ['vehicles', 'maintenance_items', 'service_history', 'mileage_history', 'fuel_history']) {
    /** @type {{count: number}} */ // @ts-ignore
    const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    assert.equal(count, 0, `expected ${table} to be empty after cascade delete`);
  }
});
