import { dbStore } from "../common/state.js";
import { deleteMany, getAllWithIndex, putOne } from "../lib/indexedDb.js";


/**
 * Mileage History Record - DB Model
 * @typedef {object} MileageHistoryRecord
 * @property {IDBValidKey} vehicleKey
 * @property {number} mileage
 * @property {number} previousMileage
 * @property {number} distance
 * @property {Date} date
 * @property {string} [notes]
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 */


/**
 * Records a new odometer reading in the vehicle's mileage history.
 * @param {IDBValidKey} vehicleKey
 * @param {number} mileage
 * @param {number} previousMileage
 * @param {Date} date
 * @param {string} [notes]
 * @returns {Promise<MileageHistoryRecord>}
 */
async function addMileageHistoryRecord(vehicleKey, mileage, previousMileage, date, notes = '') {
  /** @type {MileageHistoryRecord} */
  const record = {
    vehicleKey,
    mileage,
    previousMileage,
    distance: mileage - previousMileage,
    date,
    notes,
    createdAt: new Date(),
  };
  record._key = await putOne('mileageHistory', record);

  const strVehicleKey = vehicleKey.toString();
  let history = dbStore.mileageHistory[strVehicleKey];
  if (!history) {
    history = [];
    dbStore.mileageHistory[strVehicleKey] = history;
  }
  history.unshift(record);

  return record;
}

/**
 * Returns the mileage history for the given vehicle, newest first.
 * If cached, returns the cache, otherwise fetches and caches.
 * @param {IDBValidKey} vehicleKey
 * @returns {Promise<MileageHistoryRecord[]>}
 */
async function getMileageHistory(vehicleKey) {
  const strVehicleKey = vehicleKey.toString();
  if (dbStore.mileageHistory[strVehicleKey]) {
    return dbStore.mileageHistory[strVehicleKey];
  }

  /** @type {MileageHistoryRecord[]} */ // @ts-ignore
  const history = await getAllWithIndex('mileageHistory', 'vehicleKey', vehicleKey);
  dbStore.mileageHistory[strVehicleKey] = history;
  return history;
}


/**
 * Deletes all mileage history for the given vehicle.
 * @param {IDBValidKey} vehicleKey
 * @returns {Promise<boolean>}
 */
async function deleteVehicleMileageHistory(vehicleKey) {
  return deleteMany('mileageHistory', 'vehicleKey', vehicleKey);
}


export { addMileageHistoryRecord, getMileageHistory, deleteVehicleMileageHistory };
