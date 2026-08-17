import { ServiceError } from './ServiceError.js';


/**
 * @param {any} row
 */
function fuelRecordFromRow(row) {
  return {
    id: Number(row.id),
    vehicleId: Number(row.vehicle_id),
    mileage: Number(row.mileage),
    liters: Number(row.liters),
    cost: row.cost == null ? null : Number(row.cost),
    date: Number(row.date),
    notes: row.notes,
    createdAt: Number(row.created_at),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createFuelService(db) {
  /**
   * @param {number} userId
   * @param {number} vehicleId
   */
  function assertVehicleOwned(userId, vehicleId) {
    const row = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, userId);
    if (!row) { throw new ServiceError('Vehículo no encontrado'); }
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   */
  function listForVehicle(userId, vehicleId) {
    assertVehicleOwned(userId, vehicleId);
    return db.prepare('SELECT * FROM fuel_history WHERE vehicle_id = ? AND user_id = ? ORDER BY date DESC, id DESC')
      .all(vehicleId, userId).map(fuelRecordFromRow);
  }

  /**
   * No delete - matches today's app, which never had a per-record fuel
   * delete, only a vehicle-delete cascade.
   * @param {number} userId
   * @param {number} vehicleId
   * @param {{mileage: number, liters: number, date?: number, cost?: number|null, notes?: string}} data
   */
  function createRecord(userId, vehicleId, { mileage, liters, date, cost, notes }) {
    assertVehicleOwned(userId, vehicleId);
    if (!Number.isFinite(mileage) || mileage < 0) { throw new ServiceError('Ingresar un kilometraje válido'); }
    if (!Number.isFinite(liters) || liters <= 0) { throw new ServiceError('Ingresar una cantidad de litros válida'); }

    const now = Date.now();
    const info = db.prepare(
      `INSERT INTO fuel_history (vehicle_id, user_id, mileage, liters, cost, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(vehicleId, userId, mileage, liters, cost ?? null, date ?? now, notes || '', now);
    return fuelRecordFromRow(db.prepare('SELECT * FROM fuel_history WHERE id = ?').get(Number(info.lastInsertRowid)));
  }

  return { listForVehicle, createRecord };
}

export { createFuelService };
