import { ServiceError } from './ServiceError.js';
import { vehicleFromRow } from './vehicleService.js';


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
  function getOwnedVehicleRow(userId, vehicleId) {
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, userId);
    if (!row) { throw new ServiceError('Vehículo no encontrado'); }
    return row;
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   */
  function listForVehicle(userId, vehicleId) {
    getOwnedVehicleRow(userId, vehicleId);
    return db.prepare('SELECT * FROM fuel_history WHERE vehicle_id = ? AND user_id = ? ORDER BY date DESC, id DESC')
      .all(vehicleId, userId).map(fuelRecordFromRow);
  }

  /**
   * A fill-up's odometer reading is also a mileage reading: if it's ahead of
   * the vehicle's current mileage, this advances the vehicle (and writes a
   * matching mileage_history entry) in the same transaction, same as
   * vehicleService.logMileage. A reading behind the current mileage is left
   * alone (e.g. backfilling a past fill-up) rather than rejected.
   * @param {number} userId
   * @param {number} vehicleId
   * @param {{mileage: number, liters: number, date?: number, cost?: number|null, notes?: string}} data
   */
  function createRecord(userId, vehicleId, { mileage, liters, date, cost, notes }) {
    const vehicleRow = getOwnedVehicleRow(userId, vehicleId);
    if (!Number.isFinite(mileage) || mileage < 0) { throw new ServiceError('Ingresar un kilometraje válido'); }
    if (!Number.isFinite(liters) || liters <= 0) { throw new ServiceError('Ingresar una cantidad de litros válida'); }

    const now = Date.now();
    const recordDate = date ?? now;
    const previousMileage = Number(vehicleRow.current_mileage);
    const advancesMileage = mileage > previousMileage;

    let fuelRecordId;
    db.exec('BEGIN');
    try {
      const info = db.prepare(
        `INSERT INTO fuel_history (vehicle_id, user_id, mileage, liters, cost, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(vehicleId, userId, mileage, liters, cost ?? null, recordDate, notes || '', now);
      fuelRecordId = Number(info.lastInsertRowid);

      if (advancesMileage) {
        db.prepare(
          `INSERT INTO mileage_history (vehicle_id, user_id, mileage, previous_mileage, distance, date, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, '', ?)`
        ).run(vehicleId, userId, mileage, previousMileage, mileage - previousMileage, recordDate, now);
        db.prepare('UPDATE vehicles SET current_mileage = ?, current_mileage_date = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .run(mileage, recordDate, now, vehicleId, userId);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return {
      record: fuelRecordFromRow(db.prepare('SELECT * FROM fuel_history WHERE id = ?').get(fuelRecordId)),
      vehicle: vehicleFromRow(getOwnedVehicleRow(userId, vehicleId)),
    };
  }

  /**
   * Deletes a fuel record. Never touches the vehicle's current mileage or
   * any mileage_history row a mileage-advancing fill-up may have created
   * (see createRecord) - mileage readings are append-only everywhere else
   * in this app (mileageService has no delete either), so a fuel delete
   * only corrects the fuel/cost data, not the odometer trail.
   * @param {number} userId
   * @param {number} recordId
   */
  function deleteRecord(userId, recordId) {
    const row = db.prepare('SELECT id FROM fuel_history WHERE id = ? AND user_id = ?').get(recordId, userId);
    if (!row) { throw new ServiceError('Registro no encontrado'); }
    db.prepare('DELETE FROM fuel_history WHERE id = ? AND user_id = ?').run(recordId, userId);
  }

  return { listForVehicle, createRecord, deleteRecord };
}

export { createFuelService };
