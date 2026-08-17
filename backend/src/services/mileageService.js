import { ServiceError } from './ServiceError.js';
import { mileageRecordFromRow } from './vehicleService.js';


/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createMileageService(db) {
  /**
   * Writes happen through vehicleService.logMileage (which also updates the
   * vehicle's current mileage in the same transaction) - this service is
   * read-only.
   * @param {number} userId
   * @param {number} vehicleId
   */
  function listForVehicle(userId, vehicleId) {
    const owned = db.prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?').get(vehicleId, userId);
    if (!owned) { throw new ServiceError('Vehículo no encontrado'); }
    return db.prepare('SELECT * FROM mileage_history WHERE vehicle_id = ? AND user_id = ? ORDER BY date DESC, id DESC')
      .all(vehicleId, userId).map(mileageRecordFromRow);
  }

  return { listForVehicle };
}

export { createMileageService };
