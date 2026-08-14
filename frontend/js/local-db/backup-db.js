import { clearStore, getAll, putOne } from "../lib/indexedDb.js";
import { isValidBackupData, reviveDates } from "../lib/backupValidation.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {object} BackupData
 * @property {string} app
 * @property {number} backupVersion
 * @property {string} exportedAt
 * @property {import("./vehicle-db.js").Vehicle[]} vehicles
 * @property {import("./maintenance-db.js").MaintenanceItem[]} maintenanceItems
 * @property {import("./service-db.js").ServiceRecord[]} serviceHistory
 * @property {import("./mileage-db.js").MileageHistoryRecord[]} mileageHistory
 * @property {import("./fuel-db.js").FuelRecord[]} [fuelHistory] - Optional: absent in backups exported before fuel tracking existed.
 */

const BACKUP_VERSION = 1;

/**
 * Gathers every record from every store into a single plain object, ready
 * to be JSON-serialized.
 * @returns {Promise<BackupData>}
 */
async function exportAllData() {
  const [vehicles, maintenanceItems, serviceHistory, mileageHistory, fuelHistory] = await Promise.all([
    getAll('vehicles'),
    getAll('maintenanceItems'),
    getAll('serviceHistory'),
    getAll('mileageHistory'),
    getAll('fuelHistory'),
  ]);

  // @ts-ignore
  return {
    app: 'CarTrack',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles, maintenanceItems, serviceHistory, mileageHistory, fuelHistory,
  };
}

/**
 * Replaces ALL local data with the contents of a previously exported backup.
 * Records are re-inserted under their original keys so cross-store
 * references (vehicleKey/itemKey) stay valid.
 * @param {*} data - Parsed JSON, shape not yet trusted.
 * @returns {ServiceReturn<boolean>}
 */
async function restoreAllData(data) {
  if (!isValidBackupData(data)) {
    return { errorMsg: 'El archivo no tiene el formato esperado de un backup de CarTrack' };
  }

  await clearStore('vehicles');
  await clearStore('maintenanceItems');
  await clearStore('serviceHistory');
  await clearStore('mileageHistory');
  await clearStore('fuelHistory');

  for (const vehicle of data.vehicles) {
    reviveDates(vehicle, ['currentMileageDate', 'createdAt', 'updatedAt']);
    await putOne('vehicles', vehicle, vehicle._key);
  }
  for (const item of data.maintenanceItems) {
    reviveDates(item, ['lastServiceDate', 'createdAt', 'updatedAt']);
    if (item.lastServiceRecord) { reviveDates(item.lastServiceRecord, ['date', 'createdAt']); }
    await putOne('maintenanceItems', item, item._key);
  }
  for (const record of data.serviceHistory) {
    reviveDates(record, ['date', 'createdAt']);
    await putOne('serviceHistory', record, record._key);
  }
  for (const record of data.mileageHistory) {
    reviveDates(record, ['date', 'createdAt']);
    await putOne('mileageHistory', record, record._key);
  }
  // Optional — absent in backups exported before fuel tracking existed.
  for (const record of (Array.isArray(data.fuelHistory) ? data.fuelHistory : [])) {
    reviveDates(record, ['date', 'createdAt']);
    await putOne('fuelHistory', record, record._key);
  }

  return { data: true };
}

export { exportAllData, restoreAllData };
