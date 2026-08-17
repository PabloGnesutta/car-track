import { dbStore } from "../common/state.js";
import { apiCall } from "../api-caller/apiCaller.js";


/**
 * Mileage History Record - DB Model
 * @typedef {object} MileageHistoryRecord
 * @property {number} vehicleKey
 * @property {number} mileage
 * @property {number} previousMileage
 * @property {number} distance
 * @property {Date} date
 * @property {string} [notes]
 * @property {number} [_key]
 * @property {Date} [createdAt]
 */


/**
 * @param {*} data - the `data` field of a mileageHistory/* API response
 * @returns {MileageHistoryRecord}
 */
function recordFromApi(data) {
  return {
    _key: data.id,
    vehicleKey: data.vehicleId,
    mileage: data.mileage,
    previousMileage: data.previousMileage,
    distance: data.distance,
    date: new Date(data.date),
    notes: data.notes || '',
    createdAt: new Date(data.createdAt),
  };
}

/**
 * Returns the mileage history for the given vehicle, newest first.
 * If cached, returns the cache, otherwise fetches and caches. Writes happen
 * via vehicle-db.js's logMileage(), which also updates the vehicle's
 * current mileage in the same server-side transaction.
 * @param {number} vehicleKey
 * @returns {Promise<MileageHistoryRecord[]>}
 */
async function getMileageHistory(vehicleKey) {
  const strVehicleKey = vehicleKey.toString();
  if (dbStore.mileageHistory[strVehicleKey]) {
    return dbStore.mileageHistory[strVehicleKey];
  }

  const result = await apiCall('mileageHistory/fetch', { vehicleId: vehicleKey });
  const history = (result.data || []).map(recordFromApi);
  dbStore.mileageHistory[strVehicleKey] = history;
  return history;
}


export { getMileageHistory, recordFromApi as mileageRecordFromApi };
