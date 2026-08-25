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
 * Records a fuel fill-up.
 *
 * The odometer reading on the fill-up is also a mileage reading: if it's
 * ahead of the vehicle's current mileage, the server advances the vehicle
 * too, so this mutates the given Vehicle object the same way
 * vehicle-db.js's logMileage does.
 * @param {import("./vehicle-db.js").Vehicle} vehicle
 * @param {number} mileage
 * @param {number} liters
 * @param {Date} date
 * @param {number|null} [cost]
 * @param {string} [notes]
 * @returns {ServiceReturn<FuelRecord>}
 */
async function addFuelRecord(vehicle, mileage, liters, date, cost = null, notes = '') {
  const vehicleKey = vehicle._key;
  const result = await apiCall('fuelHistory/create', { vehicleId: vehicleKey, mileage, liters, date: date.getTime(), cost, notes });
  if (!result.data) { return { errorMsg: result.error }; }

  const { record: recordData, vehicle: updatedVehicle } = result.data;
  const record = recordFromApi(recordData);
  const strVehicleKey = (vehicleKey || '').toString();
  let history = dbStore.fuelHistory[strVehicleKey];
  if (!history) {
    history = [];
    dbStore.fuelHistory[strVehicleKey] = history;
  }
  history.unshift(record);

  vehicle.currentMileage = updatedVehicle.currentMileage;
  vehicle.currentMileageDate = new Date(updatedVehicle.currentMileageDate);
  vehicle.updatedAt = new Date(updatedVehicle.updatedAt);

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

/**
 * Deletes a fuel record. Never rolls back the vehicle's current mileage
 * even if this fill-up had advanced it (see addFuelRecord) - mileage
 * readings are append-only everywhere else in the app too.
 * @param {FuelRecord} record
 * @returns {Promise<boolean>}
 */
async function deleteFuelRecord(record) {
  if (!record._key) { return false; }
  const result = await apiCall('fuelHistory/delete', { recordId: record._key });
  return !!result.data;
}


export { addFuelRecord, getFuelHistory, deleteFuelRecord, recordFromApi as fuelRecordFromApi };
