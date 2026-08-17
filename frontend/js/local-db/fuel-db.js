import { dbStore } from "../common/state.js";
import { apiCall } from "../api-caller/apiCaller.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * Fuel Fill-up Record - DB Model. Each entry is assumed to be a full-tank
 * fill-up — the standard simplifying assumption that lets L/100km be
 * computed from consecutive odometer readings alone (see
 * lib/fuelEconomy.js), without needing a "was this a full tank" toggle in
 * the UI.
 * @typedef {object} FuelRecord
 * @property {number} vehicleKey
 * @property {number} mileage
 * @property {number} liters
 * @property {number|null} [cost]
 * @property {Date} date
 * @property {string} [notes]
 * @property {number} [_key]
 * @property {Date} [createdAt]
 */


/**
 * @param {*} data - the `data` field of a fuelHistory/* API response
 * @returns {FuelRecord}
 */
function recordFromApi(data) {
  return {
    _key: data.id,
    vehicleKey: data.vehicleId,
    mileage: data.mileage,
    liters: data.liters,
    cost: data.cost,
    notes: data.notes || '',
    date: new Date(data.date),
    createdAt: new Date(data.createdAt),
  };
}

/**
 * Records a fuel fill-up. No delete - this app never had a per-record fuel
 * delete, only a vehicle-delete cascade.
 * @param {number} vehicleKey
 * @param {number} mileage
 * @param {number} liters
 * @param {Date} date
 * @param {number|null} [cost]
 * @param {string} [notes]
 * @returns {ServiceReturn<FuelRecord>}
 */
async function addFuelRecord(vehicleKey, mileage, liters, date, cost = null, notes = '') {
  const result = await apiCall('fuelHistory/create', { vehicleId: vehicleKey, mileage, liters, date: date.getTime(), cost, notes });
  if (!result.data) { return { errorMsg: result.error }; }

  const record = recordFromApi(result.data);
  const strVehicleKey = vehicleKey.toString();
  let history = dbStore.fuelHistory[strVehicleKey];
  if (!history) {
    history = [];
    dbStore.fuelHistory[strVehicleKey] = history;
  }
  history.unshift(record);

  return { data: record };
}

/**
 * Returns the fuel history for the given vehicle, newest first.
 * If cached, returns the cache, otherwise fetches and caches.
 * @param {number} vehicleKey
 * @returns {Promise<FuelRecord[]>}
 */
async function getFuelHistory(vehicleKey) {
  const strVehicleKey = vehicleKey.toString();
  if (dbStore.fuelHistory[strVehicleKey]) {
    return dbStore.fuelHistory[strVehicleKey];
  }

  const result = await apiCall('fuelHistory/fetch', { vehicleId: vehicleKey });
  const history = (result.data || []).map(recordFromApi);
  dbStore.fuelHistory[strVehicleKey] = history;
  return history;
}


export { addFuelRecord, getFuelHistory, recordFromApi as fuelRecordFromApi };
