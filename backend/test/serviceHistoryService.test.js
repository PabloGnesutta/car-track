import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/db/migrate.js';
import { migrations } from '../src/db/migrations/index.js';
import { createVehicleService } from '../src/services/vehicleService.js';
import { createMaintenanceService } from '../src/services/maintenanceService.js';
import { createServiceHistoryService } from '../src/services/serviceHistoryService.js';


function makeServices() {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, migrations);
  makeUser(db, 1);
  return {
    vehicleService: createVehicleService(db),
    maintenanceService: createMaintenanceService(db),
    serviceHistoryService: createServiceHistoryService(db),
    db,
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} id
 */
function makeUser(db, id) {
  db.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, `user${id}@test.local`, 'salt:hash', '', Date.now());
}

test('markServiced updates the parent item\'s last-service fields', () => {
  const { vehicleService, maintenanceService, serviceHistoryService } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  const item = maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000, lastServiceMileage: 0, lastServiceDate: 1000 });

  const { record, item: updated } = serviceHistoryService.markServiced(1, item.id, { mileage: 5000, date: 2000 });
  assert.equal(record.mileage, 5000);
  assert.equal(updated.lastServiceMileage, 5000);
  assert.equal(updated.lastServiceDate, 2000);
});

test('deleteRecord recomputes the parent item from the remaining record when more than one exists', () => {
  const { vehicleService, maintenanceService, serviceHistoryService } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  const item = maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000 });

  const first = serviceHistoryService.markServiced(1, item.id, { mileage: 5000, date: 1000 }).record;
  const second = serviceHistoryService.markServiced(1, item.id, { mileage: 10000, date: 2000 }).record;

  // Deleting the newest record should fall back to the older one, not to null.
  const { item: afterDelete } = serviceHistoryService.deleteRecord(1, second.id);
  assert.equal(afterDelete.lastServiceMileage, first.mileage);
  assert.equal(afterDelete.lastServiceDate, first.date);
});

test('deleteRecord clears the parent item\'s last-service fields to null when it was the only record', () => {
  const { vehicleService, maintenanceService, serviceHistoryService } = makeServices();
  const vehicle = vehicleService.createVehicle(1, { name: 'Corolla', initialMileage: 0 });
  const item = maintenanceService.createItem(1, vehicle.id, { name: 'Oil', intervalKm: 5000 });

  const { record } = serviceHistoryService.markServiced(1, item.id, { mileage: 5000, date: 1000 });
  const { item: afterDelete } = serviceHistoryService.deleteRecord(1, record.id);

  assert.equal(afterDelete.lastServiceMileage, null);
  assert.equal(afterDelete.lastServiceDate, null);
});
