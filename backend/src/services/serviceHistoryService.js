import { ServiceError } from './ServiceError.js';
import { itemFromRow } from './maintenanceService.js';


/**
 * @param {any} row
 */
function recordFromRow(row) {
  return {
    id: Number(row.id),
    itemId: Number(row.item_id),
    mileage: Number(row.mileage),
    date: Number(row.date),
    notes: row.notes,
    cost: row.cost == null ? null : Number(row.cost),
    createdAt: Number(row.created_at),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createServiceHistoryService(db) {
  /**
   * @param {number} userId
   * @param {number} itemId
   */
  function assertItemOwned(userId, itemId) {
    const row = db.prepare('SELECT id FROM maintenance_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    if (!row) { throw new ServiceError('Ítem no encontrado'); }
  }

  /**
   * @param {number} userId
   * @param {number} itemId
   */
  function listForItem(userId, itemId) {
    assertItemOwned(userId, itemId);
    return db.prepare('SELECT * FROM service_history WHERE item_id = ? AND user_id = ? ORDER BY date DESC, id DESC')
      .all(itemId, userId).map(recordFromRow);
  }

  /**
   * @param {number} userId
   * @param {number} itemId
   * @param {{mileage: number, date?: number, notes?: string, cost?: number|null}} data
   */
  function markServiced(userId, itemId, { mileage, date, notes, cost }) {
    assertItemOwned(userId, itemId);
    if (!Number.isFinite(mileage)) { throw new ServiceError('Ingresar un kilometraje válido'); }
    const now = Date.now();
    const recordDate = date ?? now;

    let recordId;
    db.exec('BEGIN');
    try {
      const info = db.prepare(
        `INSERT INTO service_history (item_id, user_id, mileage, date, notes, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(itemId, userId, mileage, recordDate, notes || '', cost ?? null, now);
      recordId = Number(info.lastInsertRowid);
      db.prepare(
        'UPDATE maintenance_items SET last_service_mileage = ?, last_service_date = ?, updated_at = ? WHERE id = ? AND user_id = ?'
      ).run(mileage, recordDate, now, itemId, userId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const record = recordFromRow(db.prepare('SELECT * FROM service_history WHERE id = ?').get(recordId));
    const item = db.prepare('SELECT * FROM maintenance_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    return { record, item: itemFromRow(item) };
  }

  /**
   * Deletes a service record, then recomputes the parent item's
   * last-service fields from whatever remains (or clears them to null if
   * none is left) - replaces the old denormalized lastServiceRecord
   * snapshot the client used to maintain itself.
   * @param {number} userId
   * @param {number} recordId
   */
  function deleteRecord(userId, recordId) {
    const row = db.prepare('SELECT * FROM service_history WHERE id = ? AND user_id = ?').get(recordId, userId);
    if (!row) { throw new ServiceError('Registro no encontrado'); }
    const itemId = row.item_id;
    const now = Date.now();

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM service_history WHERE id = ? AND user_id = ?').run(recordId, userId);
      const latest = db.prepare(
        'SELECT mileage, date FROM service_history WHERE item_id = ? AND user_id = ? ORDER BY date DESC, id DESC LIMIT 1'
      ).get(itemId, userId);
      db.prepare(
        'UPDATE maintenance_items SET last_service_mileage = ?, last_service_date = ?, updated_at = ? WHERE id = ? AND user_id = ?'
      ).run(latest ? latest.mileage : null, latest ? latest.date : null, now, itemId, userId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const item = db.prepare('SELECT * FROM maintenance_items WHERE id = ? AND user_id = ?').get(itemId, userId);
    return { item: itemFromRow(item) };
  }

  return { listForItem, markServiced, deleteRecord };
}

export { createServiceHistoryService };
