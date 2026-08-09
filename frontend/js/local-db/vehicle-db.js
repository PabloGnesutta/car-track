import { dbStore } from "../common/state.js";
import { clearArray } from "../lib/utils.js";
import { getAll, putOne } from "../lib/indexedDb.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {object} Vehicle
 * @property {string} name
 * @property {number} initialMileage
 * @property {number} currentMileage
 * @property {Date} currentMileageDate
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

const LAST_USED_VEHICLE_KEY = 'lastUsedVehicleKey';


/**
 * Creates a new vehicle. Its current mileage starts at the given initial mileage.
 * @param {string} name
 * @param {number} initialMileage
 * @param {Date} [date]
 * @returns {ServiceReturn<Vehicle>}
 */
async function createVehicle(name, initialMileage, date = new Date()) {
  if (!Number.isFinite(initialMileage) || initialMileage < 0) {
    return { errorMsg: 'Ingresar un kilometraje válido' };
  }

  /** @type {Vehicle} */
  const vehicle = {
    name: name.trim() || 'Mi vehículo',
    initialMileage,
    currentMileage: initialMileage,
    currentMileageDate: date,
    createdAt: date,
    updatedAt: date,
  };
  vehicle._key = await putOne('vehicles', vehicle);

  dbStore.vehicles.push(vehicle);
  setLastUsedVehicleKey(vehicle._key);
  return { data: vehicle };
}

/**
 * Records a new odometer reading for the vehicle. Mutates the given Vehicle object.
 * @param {Vehicle} vehicle
 * @param {number} mileage
 * @param {Date} [date]
 * @returns {ServiceReturn<Vehicle>}
 */
async function logMileage(vehicle, mileage, date = new Date()) {
  if (!vehicle._key) { return { errorMsg: 'Vehículo sin llave' }; }
  if (!Number.isFinite(mileage)) { return { errorMsg: 'Ingresar un kilometraje válido' }; }
  if (mileage < vehicle.currentMileage) {
    return { errorMsg: `El kilometraje no puede ser menor al actual (${vehicle.currentMileage})` };
  }

  vehicle.currentMileage = mileage;
  vehicle.currentMileageDate = date;
  vehicle.updatedAt = date;
  await putOne('vehicles', vehicle, vehicle._key);
  return { data: vehicle };
}

/**
 * Fetch all vehicles. Stores them in dbStore.
 * @returns {Promise<Vehicle[]>}
 */
async function fetchVehicles() {
  /** @type {Vehicle[]} */ // @ts-ignore
  const vehicles = await getAll('vehicles');
  clearArray(dbStore.vehicles);
  dbStore.vehicles.push(...vehicles);
  return vehicles;
}

/** @param {IDBValidKey} key */
function setLastUsedVehicleKey(key) {
  localStorage.setItem(LAST_USED_VEHICLE_KEY, String(key));
}

/** @returns {string|null} */
function getLastUsedVehicleKey() {
  return localStorage.getItem(LAST_USED_VEHICLE_KEY);
}

/**
 * Resolves which vehicle should be active on boot: the last-used one if it
 * still exists, otherwise the most recently updated one.
 * @param {Vehicle[]} vehicles
 * @returns {Vehicle|null}
 */
function resolveCurrentVehicle(vehicles) {
  if (!vehicles.length) { return null; }
  const lastUsedKey = getLastUsedVehicleKey();
  const lastUsed = vehicles.find(v => String(v._key) === lastUsedKey);
  if (lastUsed) { return lastUsed; }

  return vehicles.slice().sort((a, b) => {
    if (!a.updatedAt || !b.updatedAt) { return 0; }
    return a.updatedAt <= b.updatedAt ? 1 : -1;
  })[0];
}


export { createVehicle, logMileage, fetchVehicles, setLastUsedVehicleKey, getLastUsedVehicleKey, resolveCurrentVehicle };
