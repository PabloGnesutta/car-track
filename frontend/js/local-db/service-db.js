import { dbStore } from "../common/state.js";
import { apiCall } from "../api-caller/apiCaller.js";
import { itemFromApi } from "./maintenance-db.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * Maintenance Service Record - DB Model
 * @typedef {object} ServiceRecord
 * @property {number} itemKey
 * @property {number} mileage
 * @property {Date} date
 * @property {string} [notes]
 * @property {number|null} [cost]
 * @property {number} [_key]
 * @property {Date} [createdAt]
 */


/**
 * @param {*} data - the `data` field of a serviceHistory/* API response
 * @returns {ServiceRecord}
 */
function recordFromApi(data) {
  return {
    _key: data.id,
    itemKey: data.itemId,
    mileage: data.mileage,
    date: new Date(data.date),
    notes: data.notes || '',
    cost: data.cost,
    createdAt: new Date(data.createdAt),
  };
}

/**
 * Records a completed service for the item: writes a history entry and
 * updates the item's denormalized last-service fields (recomputed and
 * returned by the server). Mutates the given item.
 * @param {import("./maintenance-db.js").MaintenanceItem} item
 * @param {number} mileage
 * @param {Date} date
 * @param {string} [notes]
 * @param {number|null} [cost]
 * @returns {ServiceReturn<ServiceRecord>}
 */
async function markItemServiced(item, mileage, date, notes = '', cost = null) {
  const itemKey = item._key;
  if (!itemKey) { return { errorMsg: 'Ítem sin llave' }; }

  const result = await apiCall('serviceHistory/markServiced', { itemId: itemKey, mileage, date: date.getTime(), notes, cost });
  if (!result.data) { return { errorMsg: result.error }; }

  const record = recordFromApi(result.data.record);
  Object.assign(item, itemFromApi(result.data.item));

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
 * @param {number} itemKey
 * @returns {Promise<ServiceRecord[]>}
 */
async function getServiceHistory(itemKey) {
  const strItemKey = itemKey.toString();
  if (dbStore.serviceHistory[strItemKey]) {
    return dbStore.serviceHistory[strItemKey];
  }

  const result = await apiCall('serviceHistory/fetch', { itemId: itemKey });
  const history = (result.data || []).map(recordFromApi);
  dbStore.serviceHistory[strItemKey] = history;
  return history;
}

/**
 * Deletes a service record. The server recomputes the parent item's
 * last-service fields from whatever remains and returns it, so the caller
 * can apply them without a second round trip.
 * @param {ServiceRecord} record
 * @returns {Promise<import("./maintenance-db.js").MaintenanceItem|null>}
 */
async function deleteServiceRecord(record) {
  if (!record._key) { return null; }
  const result = await apiCall('serviceHistory/delete', { recordId: record._key });
  if (!result.data) { return null; }
  return itemFromApi(result.data.item);
}


export { markItemServiced, getServiceHistory, deleteServiceRecord, recordFromApi as serviceRecordFromApi };
