import { ServiceError } from './ServiceError.js';


/**
 * @param {any} row
 */
function itemFromRow(row) {
  return {
    id: Number(row.id),
    vehicleId: Number(row.vehicle_id),
    name: row.name,
    normalizedName: row.normalized_name,
    intervalKm: row.interval_km == null ? null : Number(row.interval_km),
    intervalDays: row.interval_days == null ? null : Number(row.interval_days),
    lastServiceMileage: row.last_service_mileage == null ? null : Number(row.last_service_mileage),
    lastServiceDate: row.last_service_date == null ? null : Number(row.last_service_date),
    notes: row.notes,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createMaintenanceService(db) {
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
   * @param {number} itemId
   */
  function getOwnedItemRow(userId, itemId) {
    const row = db.prepare('SELECT * FROM maintenance_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    if (!row) { throw new ServiceError('Ítem no encontrado'); }
    return row;
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   */
  function listForVehicle(userId, vehicleId) {
    assertVehicleOwned(userId, vehicleId);
    return db.prepare('SELECT * FROM maintenance_items WHERE vehicle_id = ? AND user_id = ? ORDER BY id')
      .all(vehicleId, userId).map(itemFromRow);
  }

  /**
   * All of the user's maintenance items across every vehicle, for the bulk
   * status-counts endpoint - the client groups by vehicleId and runs
   * computeStatus() itself, so status logic stays single-sourced client-side.
   * @param {number} userId
   */
  function listAllForStatus(userId) {
    return db.prepare('SELECT * FROM maintenance_items WHERE user_id = ?').all(userId).map(itemFromRow);
  }

  /**
   * @param {number} userId
   * @param {number} vehicleId
   * @param {{name: string, normalizedName?: string, intervalKm?: number|null, intervalDays?: number|null, lastServiceMileage?: number|null, lastServiceDate?: number|null, notes?: string}} data
   */
  function createItem(userId, vehicleId, data) {
    assertVehicleOwned(userId, vehicleId);
    const name = String(data.name || '').trim();
    if (!name) { throw new ServiceError('Ingresar nombre'); }
    if (!data.intervalKm && !data.intervalDays) { throw new ServiceError('Ingresar un intervalo en km o en días'); }

    const now = Date.now();
    const info = db.prepare(
      `INSERT INTO maintenance_items
        (vehicle_id, user_id, name, normalized_name, interval_km, interval_days, last_service_mileage, last_service_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      vehicleId, userId, name, data.normalizedName || name.toLowerCase(),
      data.intervalKm || null, data.intervalDays || null,
      data.lastServiceMileage ?? null, data.lastServiceDate ?? null,
      data.notes || '', now, now
    );
    return itemFromRow(getOwnedItemRow(userId, Number(info.lastInsertRowid)));
  }

  /**
   * @param {number} userId
   * @param {number} itemId
   * @param {{name?: string, normalizedName?: string, intervalKm?: number|null, intervalDays?: number|null, notes?: string}} data
   */
  function updateItem(userId, itemId, data) {
    const existing = getOwnedItemRow(userId, itemId);
    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    const normalizedName = data.normalizedName !== undefined ? data.normalizedName : existing.normalized_name;
    const intervalKm = 'intervalKm' in data ? (data.intervalKm || null) : existing.interval_km;
    const intervalDays = 'intervalDays' in data ? (data.intervalDays || null) : existing.interval_days;
    const notes = 'notes' in data ? (data.notes || '') : existing.notes;
    if (!intervalKm && !intervalDays) { throw new ServiceError('Ingresar un intervalo en km o en días'); }

    const now = Date.now();
    db.prepare(
      `UPDATE maintenance_items SET name = ?, normalized_name = ?, interval_km = ?, interval_days = ?, notes = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(name, normalizedName, intervalKm, intervalDays, notes, now, itemId, userId);
    return itemFromRow(getOwnedItemRow(userId, itemId));
  }

  /**
   * @param {number} userId
   * @param {number} itemId
   */
  function deleteItem(userId, itemId) {
    getOwnedItemRow(userId, itemId);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM service_history WHERE item_id = ? AND user_id = ?').run(itemId, userId);
      db.prepare('DELETE FROM maintenance_items WHERE id = ? AND user_id = ?').run(itemId, userId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return { listForVehicle, listAllForStatus, createItem, updateItem, deleteItem };
}

export { createMaintenanceService, itemFromRow };
