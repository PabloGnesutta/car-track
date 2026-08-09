import { dbStore } from "../common/state.js";
import { deleteMany, deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * Maintenance Service Record - DB Model
 * @typedef {object} ServiceRecord
 * @property {IDBValidKey} itemKey
 * @property {number} mileage
 * @property {Date} date
 * @property {string} [notes]
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 */


/**
 * Records a completed service for the item: writes a history entry and
 * updates the item's denormalized last-service fields. Mutates the given item.
 * @param {import("./maintenance-db.js").MaintenanceItem} item
 * @param {number} mileage
 * @param {Date} date
 * @param {string} [notes]
 * @returns {ServiceReturn<ServiceRecord>}
 */
async function markItemServiced(item, mileage, date, notes = '') {
  const itemKey = item._key;
  if (!itemKey) { return { errorMsg: 'Ítem sin llave' }; }
  if (!Number.isFinite(mileage)) { return { errorMsg: 'Ingresar un kilometraje válido' }; }

  /** @type {ServiceRecord} */
  const record = { itemKey, mileage, date, notes, createdAt: new Date() };
  record._key = await putOne('serviceHistory', record);

  item.lastServiceMileage = mileage;
  item.lastServiceDate = date;
  item.lastServiceRecord = record;
  item.updatedAt = new Date();
  await putOne('maintenanceItems', item, itemKey);

  const strItemKey = itemKey.toString();
  let history = dbStore.serviceHistory[strItemKey];
  if (!history) {
    history = [];
    dbStore.serviceHistory[strItemKey] = history;
  }
  history.unshift(record);

  return { data: record };
}

/**
 * Returns the service history for the given item, newest first.
 * If cached, returns the cache, otherwise fetches and caches.
 * @param {IDBValidKey} itemKey
 * @returns {Promise<ServiceRecord[]>}
 */
async function getServiceHistory(itemKey) {
  const strItemKey = itemKey.toString();
  if (dbStore.serviceHistory[strItemKey]) {
    return dbStore.serviceHistory[strItemKey];
  }

  /** @type {ServiceRecord[]} */ // @ts-ignore
  const history = await getAllWithIndex('serviceHistory', 'itemKey', itemKey);
  dbStore.serviceHistory[strItemKey] = history;
  return history;
}

/**
 * @param {ServiceRecord} record
 */
async function deleteServiceRecord(record) {
  if (!record._key) { return; }
  await deleteOne('serviceHistory', record._key);
}

/**
 * Deletes all service history for the given item.
 * @param {IDBValidKey} itemKey
 * @returns {Promise<boolean>}
 */
async function deleteItemHistory(itemKey) {
  return deleteMany('serviceHistory', 'itemKey', itemKey);
}


export { markItemServiced, getServiceHistory, deleteServiceRecord, deleteItemHistory };
