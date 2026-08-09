import { dbStore } from "../common/state.js";
import { normalize } from "../lib/string.js";
import { clearArray } from "../lib/utils.js";
import { computeStatus } from "../lib/maintenanceStatus.js";
import { deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("../lib/indexedDb.js").StoreKey} StoreKey
 * @typedef {import("./service-db.js").ServiceRecord} ServiceRecord
 */

/**
 * @typedef {object} MaintenanceItem
 * @property {IDBValidKey} vehicleKey
 * @property {string} name
 * @property {string} [normalizedName]
 * @property {number|null} intervalKm
 * @property {number|null} intervalDays
 * @property {number} lastServiceMileage
 * @property {Date} lastServiceDate
 * @property {ServiceRecord|null} lastServiceRecord
 * @property {string} [notes]
 * @property {IDBValidKey} [_key]
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
 * Creates a maintenance item for the given vehicle.
 * @param {IDBValidKey} vehicleKey
 * @param {string} name
 * @param {MaintenanceItemInput} data
 * @param {Date} [date]
 * @returns {ServiceReturn<MaintenanceItem>}
 */
async function createMaintenanceItem(vehicleKey, name, data, date = new Date()) {
  name = name.trim();
  if (!name) { return { errorMsg: 'Ingresar nombre' }; }
  if (!data.intervalKm && !data.intervalDays) {
    return { errorMsg: 'Ingresar un intervalo en km o en días' };
  }

  /** @type {MaintenanceItem} */
  const item = {
    vehicleKey,
    name,
    normalizedName: normalize(name),
    intervalKm: data.intervalKm || null,
    intervalDays: data.intervalDays || null,
    lastServiceMileage: data.lastServiceMileage,
    lastServiceDate: data.lastServiceDate,
    lastServiceRecord: null,
    notes: data.notes || '',
    createdAt: date,
    updatedAt: date,
  };
  item._key = await putOne('maintenanceItems', item);

  dbStore.maintenanceItems.push(item);
  return { data: item };
}

/**
 * Updates a maintenance item's editable fields. Mutates the given item.
 * @param {MaintenanceItem} item
 * @param {{name?: string, intervalKm?: number|null, intervalDays?: number|null, notes?: string}} data
 * @param {Date} [date]
 * @returns {ServiceReturn<MaintenanceItem>}
 */
async function updateMaintenanceItem(item, data, date = new Date()) {
  if (!item._key) { return { errorMsg: 'Llave no provista' }; }
  if (data.name) {
    item.name = data.name;
    item.normalizedName = normalize(data.name);
  }
  if ('intervalKm' in data) { item.intervalKm = data.intervalKm || null; }
  if ('intervalDays' in data) { item.intervalDays = data.intervalDays || null; }
  if ('notes' in data) { item.notes = data.notes || ''; }
  if (!item.intervalKm && !item.intervalDays) {
    return { errorMsg: 'Ingresar un intervalo en km o en días' };
  }
  item.updatedAt = date;

  await putOne('maintenanceItems', item, item._key);
  return { data: item };
}

/**
 * @param {StoreKey} itemKey
 * @returns {Promise<StoreKey>}
 */
async function deleteMaintenanceItem(itemKey) {
  return deleteOne('maintenanceItems', itemKey);
}

/**
 * Fetch all maintenance items for the given vehicle, sorted by urgency
 * (overdue -> due-soon -> ok) then name. Stores them in dbStore.
 * @param {IDBValidKey} vehicleKey
 * @param {number} currentMileage
 * @param {Date} currentDate
 * @returns {Promise<MaintenanceItem[]>}
 */
async function fetchMaintenanceItems(vehicleKey, currentMileage, currentDate) {
  /** @type {MaintenanceItem[]} */ // @ts-ignore
  const items = await getAllWithIndex('maintenanceItems', 'vehicleKey', vehicleKey);

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


export { createMaintenanceItem, updateMaintenanceItem, deleteMaintenanceItem, fetchMaintenanceItems };
