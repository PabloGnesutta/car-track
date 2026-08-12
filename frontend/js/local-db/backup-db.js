import { clearStore, getAll, putOne } from "../lib/indexedDb.js";


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
 */

const BACKUP_VERSION = 1;

/**
 * Gathers every record from every store into a single plain object, ready
 * to be JSON-serialized.
 * @returns {Promise<BackupData>}
 */
async function exportAllData() {
  const [vehicles, maintenanceItems, serviceHistory, mileageHistory] = await Promise.all([
    getAll('vehicles'),
    getAll('maintenanceItems'),
    getAll('serviceHistory'),
    getAll('mileageHistory'),
  ]);

  // @ts-ignore
  return {
    app: 'CarTrack',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles, maintenanceItems, serviceHistory, mileageHistory,
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
  if (!data || typeof data !== 'object'
    || !Array.isArray(data.vehicles) || !Array.isArray(data.maintenanceItems)
    || !Array.isArray(data.serviceHistory) || !Array.isArray(data.mileageHistory)) {
    return { errorMsg: 'El archivo no tiene el formato esperado de un backup de CarTrack' };
  }

  await clearStore('vehicles');
  await clearStore('maintenanceItems');
  await clearStore('serviceHistory');
  await clearStore('mileageHistory');

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

  return { data: true };
}

/**
 * Mutates the given object, turning ISO date strings back into Date
 * instances for the listed fields (JSON.parse leaves them as strings).
 * @param {Record<string, *>} obj
 * @param {string[]} fields
 */
function reviveDates(obj, fields) {
  fields.forEach(field => {
    if (obj[field]) { obj[field] = new Date(obj[field]); }
  });
}


export { exportAllData, restoreAllData };
