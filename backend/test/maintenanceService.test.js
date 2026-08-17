import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { createVehicleService } from '../src/services/vehicleService.js';
import { createMaintenanceService } from '../src/services/maintenanceService.js';
import { ServiceError } from '../src/services/ServiceError.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  makeUser(db, 1);
  makeUser(db, 2);
  return { vehicleService: createVehicleService(db), maintenanceService: createMaintenanceService(db), db };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} id
 */
function makeUser(db, id) {
  db.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, `user${id}@test.local`, 'salt:hash', '', Date.now());
}

test('createItem requires either an interval in km or in days', () => {
  const { vehicleService, maintenanceService } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  assert.throws(() => maintenanceService.createItem(1, vehicle.id, { name: 'Oil' }), ServiceError);
});

test('createItem rejects a vehicle the user does not own', () => {
  const { vehicleService, maintenanceService } = makeServices();
  const vehicle = vehicleService.createVehicle(2, { name: 'Someone else\'s car', initialMileage: 0 });
  assert.throws(
    () => maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000 }),
    ServiceError
  );
});

test('listForVehicle only returns items owned by the requesting user', () => {
  const { vehicleService, maintenanceService } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000 });
  assert.throws(() => maintenanceService.listForVehicle(2, vehicle.id), ServiceError);
});

test('listAllForStatus returns items across every vehicle for that user, tagged with vehicleId', () => {
  const { vehicleService, maintenanceService } = makeServices();
  const v1 = vehicleService.createVehicle(1, { name: 'Car1', initialMileage: 0 });
  const v2 = vehicleService.createVehicle(1, { name: 'Car2', initialMileage: 0 });
  maintenanceService.createItem(1, v1.id, { name: 'Oil', intervalKm: 5000 });
  maintenanceService.createItem(1, v2.id, { name: 'Brakes', intervalKm: 20000 });

  const items = maintenanceService.listAllForStatus(1);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(i => i.vehicleId).sort(), [v1.id, v2.id].sort());
});

test('deleteItem cascades to its service history', () => {
  const { vehicleService, maintenanceService, db } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  const item = maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000 });
  db.prepare('INSERT INTO service_history (item_id, user_id, mileage, date, created_at) VALUES (?, 1, 100, ?, ?)')
    .run(item.id, Date.now(), Date.now());

  maintenanceService.deleteItem(1, item.id);

  /** @type {{count: number}} */ // @ts-ignore
  const { count } = db.prepare('SELECT COUNT(*) as count FROM service_history WHERE item_id = ?').get(item.id);
  assert.equal(count, 0);
});
