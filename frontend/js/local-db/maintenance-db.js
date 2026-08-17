import { dbStore } from "../common/state.js";
import { normalize } from "../lib/string.js";
import { clearArray } from "../lib/utils.js";
import { computeStatus } from "../lib/maintenanceStatus.js";
import { apiCall } from "../api-caller/apiCaller.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./service-db.js").ServiceRecord} ServiceRecord
 */

/**
 * @typedef {object} MaintenanceItem
 * @property {number} vehicleKey
 * @property {string} name
 * @property {string} [normalizedName]
 * @property {number|null} intervalKm
 * @property {number|null} intervalDays
 * @property {number|null} lastServiceMileage
 * @property {Date|null} lastServiceDate
 * @property {string} [notes]
 * @property {number} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

/**
 * @typedef {object} MaintenanceItemInput
 * @property {number|null} [intervalKm]
 * @property {number|null} [intervalDays]
 * @property {string} [notes]
 * @property {number} lastServiceMileage
 * @property {Date} lastServiceDate
 */


/**
 * @param {*} data - the `data` field of a maintenanceItems/* API response
 * @returns {MaintenanceItem}
 */
function itemFromApi(data) {
  return {
    _key: data.id,
    vehicleKey: data.vehicleId,
    name: data.name,
    normalizedName: data.normalizedName,
    intervalKm: data.intervalKm,
    intervalDays: data.intervalDays,
    lastServiceMileage: data.lastServiceMileage,
    lastServiceDate: data.lastServiceDate != null ? new Date(data.lastServiceDate) : null,
    notes: data.notes || '',
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/**
 * Creates a maintenance item for the given vehicle.
 * @param {number} vehicleKey
 * @param {string} name
 * @param {MaintenanceItemInput} data
 * @returns {ServiceReturn<MaintenanceItem>}
 */
async function createMaintenanceItem(vehicleKey, name, data) {
  name = name.trim();
  if (!name) { return { errorMsg: 'Ingresar nombre' }; }
  if (!data.intervalKm && !data.intervalDays) {
    return { errorMsg: 'Ingresar un intervalo en km o en días' };
  }

  const result = await apiCall('maintenanceItems/create', {
    vehicleId: vehicleKey,
    name,
    normalizedName: normalize(name),
    intervalKm: data.intervalKm || null,
    intervalDays: data.intervalDays || null,
    lastServiceMileage: data.lastServiceMileage,
    lastServiceDate: data.lastServiceDate.getTime(),
    notes: data.notes || '',
  });
  if (!result.data) { return { errorMsg: result.error }; }

  const item = itemFromApi(result.data);
  dbStore.maintenanceItems.push(item);
  return { data: item };
}

/**
 * Updates a maintenance item's editable fields. Mutates the given item.
 * @param {MaintenanceItem} item
 * @param {{name?: string, intervalKm?: number|null, intervalDays?: number|null, notes?: string}} data
 * @returns {ServiceReturn<MaintenanceItem>}
 */
async function updateMaintenanceItem(item, data) {
  if (!item._key) { return { errorMsg: 'Llave no provista' }; }

  const payload = { itemId: item._key };
  if (data.name) { payload.name = data.name; payload.normalizedName = normalize(data.name); }
  if ('intervalKm' in data) { payload.intervalKm = data.intervalKm || null; }
  if ('intervalDays' in data) { payload.intervalDays = data.intervalDays || null; }
  if ('notes' in data) { payload.notes = data.notes || ''; }

  const result = await apiCall('maintenanceItems/update', payload);
  if (!result.data) { return { errorMsg: result.error }; }

  const updated = itemFromApi(result.data);
  Object.assign(item, updated);
  return { data: item };
}

/**
 * @param {number} itemKey
 * @returns {Promise<boolean>}
 */
async function deleteMaintenanceItem(itemKey) {
  const result = await apiCall('maintenanceItems/delete', { itemId: itemKey });
  return !!result.data;
}

/**
 * Fetch all maintenance items for the given vehicle, sorted by urgency
 * (overdue -> due-soon -> ok) then name. Stores them in dbStore.
 * @param {number} vehicleKey
 * @param {number} currentMileage
 * @param {Date} currentDate
 * @returns {Promise<MaintenanceItem[]>}
 */
async function fetchMaintenanceItems(vehicleKey, currentMileage, currentDate) {
  const result = await apiCall('maintenanceItems/fetch', { vehicleId: vehicleKey });
  const items = (result.data || []).map(itemFromApi);

  /** @type {Record<import("../lib/maintenanceStatus.js").MaintenanceStatus, number>} */
  const urgency = { overdue: 0, 'due-soon': 1, ok: 2 };
  items.sort((a, b) => {
    const statusA = computeStatus(a, currentMileage, currentDate).status;
    const statusB = computeStatus(b, currentMileage, currentDate).status;
    if (statusA !== statusB) { return urgency[statusA] - urgency[statusB]; }
    return a.name.localeCompare(b.name);
  });

  clearArray(dbStore.maintenanceItems);
  dbStore.maintenanceItems.push(...items);
  return items;
}

/**
 * Every maintenance item across every one of the user's vehicles, in one
 * request - used by renderVehicleChips() to compute overdue/due-soon counts
 * per vehicle without issuing one API call per vehicle.
 * @returns {Promise<MaintenanceItem[]>}
 */
async function fetchAllMaintenanceItems() {
  const result = await apiCall('maintenanceItems/fetchAllForStatus', {});
  return (result.data || []).map(itemFromApi);
}

/**
 * Counts overdue/due-soon items for every vehicle in one round trip. Each
 * vehicle's own currentMileage/currentMileageDate is used to compute its
 * items' statuses.
 * @param {import("./vehicle-db.js").Vehicle[]} vehicles
 * @returns {Promise<Record<string, {overdue: number, dueSoon: number}>>}
 */
async function countAllVehiclesStatus(vehicles) {
  const items = await fetchAllMaintenanceItems();
  const today = new Date();
  /** @type {Record<string, {overdue: number, dueSoon: number}>} */
  const counts = {};
  for (const vehicle of vehicles) {
    counts[(vehicle._key || '').toString()] = { overdue: 0, dueSoon: 0 };
  }
  for (const item of items) {
    const vehicle = vehicles.find(v => v._key === item.vehicleKey);
    if (!vehicle) { continue; }
    const key = (vehicle._key || '').toString();
    const { status } = computeStatus(item, vehicle.currentMileage, vehicle.currentMileageDate || today);
    if (status === 'overdue') { counts[key].overdue++; }
    else if (status === 'due-soon') { counts[key].dueSoon++; }
  }
  return counts;
}


export {
  createMaintenanceItem, updateMaintenanceItem, deleteMaintenanceItem,
  fetchMaintenanceItems, countAllVehiclesStatus, itemFromApi,
};
