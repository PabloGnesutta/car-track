import { dbStore } from "../common/state.js";
import { clearArray } from "../lib/utils.js";
import { apiCall } from "../api-caller/apiCaller.js";


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
 * @property {number} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

const LAST_USED_VEHICLE_KEY = 'lastUsedVehicleKey';


/**
 * @param {*} data - the `data` field of a vehicles/* API response
 * @returns {Vehicle}
 */
function vehicleFromApi(data) {
  return {
    _key: data.id,
    name: data.name,
    initialMileage: data.initialMileage,
    currentMileage: data.currentMileage,
    currentMileageDate: new Date(data.currentMileageDate),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/**
 * Creates a new vehicle. Its current mileage starts at the given initial mileage.
 * @param {string} name
 * @param {number} initialMileage
 * @param {Date} [date]
 * @returns {ServiceReturn<Vehicle>}
 */
async function createVehicle(name, initialMileage, date = new Date()) {
  const result = await apiCall('vehicles/create', { name: name.trim(), initialMileage, date: date.getTime() });
  if (!result.data) { return { errorMsg: result.error }; }

  const vehicle = vehicleFromApi(result.data);
  dbStore.vehicles.push(vehicle);
  setLastUsedVehicleKey(vehicle._key || '');
  return { data: vehicle };
}

/**
 * Records a new odometer reading for the vehicle: writes a mileage history
 * entry (with the distance traveled since the previous reading) and updates
 * the vehicle's current mileage. Mutates the given Vehicle object.
 * @param {Vehicle} vehicle
 * @param {number} mileage
 * @param {Date} [date]
 * @param {string} [notes]
 * @returns {ServiceReturn<Vehicle>}
 */
async function logMileage(vehicle, mileage, date = new Date(), notes = '') {
  if (!vehicle._key) { return { errorMsg: 'Vehículo sin llave' }; }

  const result = await apiCall('vehicles/logMileage', { vehicleId: vehicle._key, mileage, date: date.getTime(), notes });
  if (!result.data) { return { errorMsg: result.error }; }

  const { vehicle: updatedVehicle, mileageRecord } = result.data;
  vehicle.currentMileage = updatedVehicle.currentMileage;
  vehicle.currentMileageDate = new Date(updatedVehicle.currentMileageDate);
  vehicle.updatedAt = new Date(updatedVehicle.updatedAt);

  const strVehicleKey = (vehicle._key || '').toString();
  if (dbStore.mileageHistory[strVehicleKey]) {
    dbStore.mileageHistory[strVehicleKey].unshift({
      _key: mileageRecord.id,
      vehicleKey: vehicle._key,
      mileage: mileageRecord.mileage,
      previousMileage: mileageRecord.previousMileage,
      distance: mileageRecord.distance,
      date: new Date(mileageRecord.date),
      notes: mileageRecord.notes,
      createdAt: new Date(mileageRecord.createdAt),
    });
  }

  return { data: vehicle };
}

/**
 * Renames a vehicle. Mutates the given vehicle.
 * @param {Vehicle} vehicle
 * @param {string} name
 * @returns {ServiceReturn<Vehicle>}
 */
async function updateVehicle(vehicle, name) {
  if (!vehicle._key) { return { errorMsg: 'Llave no provista' }; }
  name = name.trim();
  if (!name) { return { errorMsg: 'Ingresar nombre' }; }

  const result = await apiCall('vehicles/update', { vehicleId: vehicle._key, name });
  if (!result.data) { return { errorMsg: result.error }; }

  vehicle.name = result.data.name;
  vehicle.updatedAt = new Date(result.data.updatedAt);
  return { data: vehicle };
}

/**
 * Deletes a vehicle and everything under it (maintenance items, service/
 * mileage/fuel history) - cascaded server-side in one transaction.
 * @param {number} vehicleKey
 * @returns {Promise<boolean>}
 */
async function deleteVehicle(vehicleKey) {
  const result = await apiCall('vehicles/delete', { vehicleId: vehicleKey });
  return !!result.data;
}

/**
 * Fetch all vehicles. Stores them in dbStore on success.
 * @returns {Promise<ServiceReturn<Vehicle[]>>}
 */
async function fetchVehicles() {
  const result = await apiCall('vehicles/fetch', {});
  if (!result.data) { return { errorMsg: result.error }; }

  const vehicles = result.data.map(vehicleFromApi);
  clearArray(dbStore.vehicles);
  dbStore.vehicles.push(...vehicles);
  return { data: vehicles };
}

/** @param {number|string} key */
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


export {
  createVehicle, updateVehicle, deleteVehicle, logMileage, fetchVehicles,
  setLastUsedVehicleKey, getLastUsedVehicleKey, resolveCurrentVehicle, vehicleFromApi,
};
