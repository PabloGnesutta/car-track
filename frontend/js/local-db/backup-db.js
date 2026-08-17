import { apiCall } from "../api-caller/apiCaller.js";
import { isValidBackupData, reviveDates } from "../lib/backupValidation.js";
import { importBatch } from "./importBatch.js";
import { vehicleFromApi } from "./vehicle-db.js";
import { itemFromApi } from "./maintenance-db.js";
import { serviceRecordFromApi } from "./service-db.js";
import { mileageRecordFromApi } from "./mileage-db.js";
import { fuelRecordFromApi } from "./fuel-db.js";


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
 * @property {import("./fuel-db.js").FuelRecord[]} [fuelHistory]
 */

const BACKUP_VERSION = 1;

/**
 * Gathers every record for the account from the server into a single plain
 * object, ready to be JSON-serialized.
 * @returns {Promise<BackupData>}
 */
async function exportAllData() {
  const vehiclesResult = await apiCall('vehicles/fetch', {});
  const vehicles = (vehiclesResult.data || []).map(vehicleFromApi);

  /** @type {import("./maintenance-db.js").MaintenanceItem[]} */
  const maintenanceItems = [];
  /** @type {import("./service-db.js").ServiceRecord[]} */
  const serviceHistory = [];
  /** @type {import("./mileage-db.js").MileageHistoryRecord[]} */
  const mileageHistory = [];
  /** @type {import("./fuel-db.js").FuelRecord[]} */
  const fuelHistory = [];

  for (const vehicle of vehicles) {
    const itemsResult = await apiCall('maintenanceItems/fetch', { vehicleId: vehicle._key });
    const items = (itemsResult.data || []).map(itemFromApi);
    maintenanceItems.push(...items);

    for (const item of items) {
      const historyResult = await apiCall('serviceHistory/fetch', { itemId: item._key });
      serviceHistory.push(...(historyResult.data || []).map(serviceRecordFromApi));
    }

    const mileageResult = await apiCall('mileageHistory/fetch', { vehicleId: vehicle._key });
    mileageHistory.push(...(mileageResult.data || []).map(mileageRecordFromApi));

    const fuelResult = await apiCall('fuelHistory/fetch', { vehicleId: vehicle._key });
    fuelHistory.push(...(fuelResult.data || []).map(fuelRecordFromApi));
  }

  return {
    app: 'CarTrack',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles, maintenanceItems, serviceHistory, mileageHistory, fuelHistory,
  };
}

/**
 * Replaces ALL of the account's data with the contents of a previously
 * exported backup. Ids can't be preserved (the server assigns its own), so
 * this deletes every current vehicle first (cascades handle the rest, same
 * "this replaces everything" contract the UI already warns about), then
 * re-imports the file through the same batch importer used for one-time
 * legacy-data upload.
 * @param {*} data - Parsed JSON, shape not yet trusted.
 * @returns {ServiceReturn<boolean>}
 */
async function restoreAllData(data) {
  if (!isValidBackupData(data)) {
    return { errorMsg: 'El archivo no tiene el formato esperado de un backup de CarTrack' };
  }

  reviveBackupDates(data);

  const currentVehicles = await apiCall('vehicles/fetch', {});
  for (const vehicle of (currentVehicles.data || [])) {
    await apiCall('vehicles/delete', { vehicleId: vehicle.id });
  }

  await importBatch({
    vehicles: data.vehicles,
    maintenanceItems: data.maintenanceItems,
    serviceHistory: data.serviceHistory,
    mileageHistory: data.mileageHistory,
    fuelHistory: Array.isArray(data.fuelHistory) ? data.fuelHistory : [],
  });

  return { data: true };
}

/**
 * JSON.parse leaves date fields as ISO strings - turn them back into Date
 * instances (mutates data in place) so importBatch() can call .getTime() on
 * them like it does for freshly-read IndexedDB records.
 * @param {*} data
 */
function reviveBackupDates(data) {
  for (const vehicle of data.vehicles) {
    reviveDates(vehicle, ['currentMileageDate', 'createdAt', 'updatedAt']);
  }
  for (const item of data.maintenanceItems) {
    reviveDates(item, ['lastServiceDate', 'createdAt', 'updatedAt']);
  }
  for (const record of data.serviceHistory) {
    reviveDates(record, ['date', 'createdAt']);
  }
  for (const record of data.mileageHistory) {
    reviveDates(record, ['date', 'createdAt']);
  }
  for (const record of (Array.isArray(data.fuelHistory) ? data.fuelHistory : [])) {
    reviveDates(record, ['date', 'createdAt']);
  }
}

export { exportAllData, restoreAllData };
