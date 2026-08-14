import { dbStore } from "../common/state.js";
import { deleteMany, getAllWithIndex, putOne } from "../lib/indexedDb.js";


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
 * @property {IDBValidKey} vehicleKey
 * @property {number} mileage
 * @property {number} liters
 * @property {number|null} [cost]
 * @property {Date} date
 * @property {string} [notes]
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 */


/**
 * Records a fuel fill-up.
 * @param {IDBValidKey} vehicleKey
 * @param {number} mileage
 * @param {number} liters
 * @param {Date} date
 * @param {number|null} [cost]
 * @param {string} [notes]
 * @returns {ServiceReturn<FuelRecord>}
 */
async function addFuelRecord(vehicleKey, mileage, liters, date, cost = null, notes = '') {
  if (!Number.isFinite(mileage) || mileage < 0) { return { errorMsg: 'Ingresar un kilometraje válido' }; }
  if (!Number.isFinite(liters) || liters <= 0) { return { errorMsg: 'Ingresar una cantidad de litros válida' }; }

  /** @type {FuelRecord} */
  const record = { vehicleKey, mileage, liters, cost, notes, date, createdAt: new Date() };
  record._key = await putOne('fuelHistory', record);

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
 * @param {IDBValidKey} vehicleKey
 * @returns {Promise<FuelRecord[]>}
 */
async function getFuelHistory(vehicleKey) {
  const strVehicleKey = vehicleKey.toString();
  if (dbStore.fuelHistory[strVehicleKey]) {
    return dbStore.fuelHistory[strVehicleKey];
  }

  /** @type {FuelRecord[]} */ // @ts-ignore
  const history = await getAllWithIndex('fuelHistory', 'vehicleKey', vehicleKey);
  dbStore.fuelHistory[strVehicleKey] = history;
  return history;
}

/**
 * Deletes all fuel history for the given vehicle.
 * @param {IDBValidKey} vehicleKey
 * @returns {Promise<boolean>}
 */
async function deleteVehicleFuelHistory(vehicleKey) {
  return deleteMany('fuelHistory', 'vehicleKey', vehicleKey);
}


export { addFuelRecord, getFuelHistory, deleteVehicleFuelHistory };
