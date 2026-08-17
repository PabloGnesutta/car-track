import { ServiceError } from './ServiceError.js';


/**
 * @param {any} row
 */
function vehicleFromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    initialMileage: Number(row.initial_mileage),
    currentMileage: Number(row.current_mileage),
    currentMileageDate: Number(row.current_mileage_date),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * @param {any} row
 */
function mileageRecordFromRow(row) {
  return {
    id: Number(row.id),
    vehicleId: Number(row.vehicle_id),
    mileage: Number(row.mileage),
    previousMileage: Number(row.previous_mileage),
    distance: Number(row.distance),
    date: Number(row.date),
    notes: row.notes,
    createdAt: Number(row.created_at),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createVehicleService(db) {
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
   */
  function listVehicles(userId) {
    return db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY id').all(userId).map(vehicleFromRow);
  }

  /**
   * @param {number} userId
   * @param {{name: string, initialMileage: number, date?: number}} data
   */
  function createVehicle(userId, { name, initialMileage, date }) {
    name = String(name || '').trim() || 'Mi vehículo';
    if (!Number.isFinite(initialMileage) || initialMileage < 0) { throw new ServiceError('Ingresar un kilometraje válido'); }
    const now = Date.now();
    const mileageDate = date ?? now;

    const info = db.prepare(
      `INSERT INTO vehicles (user_id, name, initial_mileage, current_mileage, current_mileage_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, name, initialMileage, initialMileage, mileageDate, now, now);
    const vehicleId = Number(info.lastInsertRowid);

    db.prepare(
      `INSERT INTO mileage_history (vehicle_id, user_id, mileage, previous_mileage, distance, date, notes, created_at)
       VALUES (?, ?, ?, ?, 0, ?, '', ?)`
    ).run(vehicleId, userId, initialMileage, initialMileage, mileageDate, now);

    return vehicleFromRow(getOwnedVehicleRow(userId, vehicleId));
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   * @param {{name: string}} data
   */
  function updateVehicle(userId, vehicleId, { name }) {
    getOwnedVehicleRow(userId, vehicleId);
    name = String(name || '').trim();
    if (!name) { throw new ServiceError('Ingresar nombre'); }
    const now = Date.now();
    db.prepare('UPDATE vehicles SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(name, now, vehicleId, userId);
    return vehicleFromRow(getOwnedVehicleRow(userId, vehicleId));
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   * @param {{mileage: number, date?: number, notes?: string}} data
   */
  function logMileage(userId, vehicleId, { mileage, date, notes }) {
    const vehicleRow = getOwnedVehicleRow(userId, vehicleId);
    if (!Number.isFinite(mileage)) { throw new ServiceError('Ingresar un kilometraje válido'); }
    const previousMileage = Number(vehicleRow.current_mileage);
    if (mileage < previousMileage) {
      throw new ServiceError(`El kilometraje no puede ser menor al actual (${previousMileage})`);
    }
    const now = Date.now();
    const recordDate = date ?? now;

    let mileageRecordId;
    db.exec('BEGIN');
    try {
      const info = db.prepare(
        `INSERT INTO mileage_history (vehicle_id, user_id, mileage, previous_mileage, distance, date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(vehicleId, userId, mileage, previousMileage, mileage - previousMileage, recordDate, notes || '', now);
      mileageRecordId = Number(info.lastInsertRowid);
      db.prepare('UPDATE vehicles SET current_mileage = ?, current_mileage_date = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(mileage, recordDate, now, vehicleId, userId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const mileageRecord = mileageRecordFromRow(db.prepare('SELECT * FROM mileage_history WHERE id = ?').get(mileageRecordId));
    return { vehicle: vehicleFromRow(getOwnedVehicleRow(userId, vehicleId)), mileageRecord };
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   */
  function deleteVehicle(userId, vehicleId) {
    getOwnedVehicleRow(userId, vehicleId);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM fuel_history WHERE vehicle_id = ? AND user_id = ?').run(vehicleId, userId);
      db.prepare('DELETE FROM mileage_history WHERE vehicle_id = ? AND user_id = ?').run(vehicleId, userId);
      db.prepare(
        `DELETE FROM service_history WHERE item_id IN (SELECT id FROM maintenance_items WHERE vehicle_id = ? AND user_id = ?)`
      ).run(vehicleId, userId);
      db.prepare('DELETE FROM maintenance_items WHERE vehicle_id = ? AND user_id = ?').run(vehicleId, userId);
      db.prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?').run(vehicleId, userId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return { listVehicles, createVehicle, updateVehicle, logMileage, deleteVehicle };
}

export { createVehicleService, mileageRecordFromRow };
