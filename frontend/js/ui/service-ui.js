import { fromYYYYMMDD, timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { dataState, dbStore, setStateField } from "../common/state.js";
import { deleteServiceRecord, getServiceHistory, markItemServiced } from "../local-db/service-db.js";
import { showUndoToast } from "../lib/toast.js";
import { svg_notes, svg_trash } from "../svg/svgFn.js";
import { haptic } from "../lib/haptics.js";
import { refreshAfterService, refreshAfterServiceLocal } from "./maintenance-ui.js";


/**
 * @typedef {import("../local-db/maintenance-db.js").MaintenanceItem} MaintenanceItem
 * @typedef {import("../local-db/service-db.js").ServiceRecord} ServiceRecord
 */

const singleItemView = $('singleItemView');
const historyList = $getInner(singleItemView, '.service-history-list');

const serviceForm = $form('serviceForm');
const serviceMileageInput = $queryOneInput('#serviceForm input[name="serviceMileage"]');
const serviceDateInput = $queryOneInput('#serviceForm input[name="serviceDate"]');
const serviceCostInput = $queryOneInput('#serviceForm input[name="serviceCost"]');
const serviceNotesInput = $queryOneInput('#serviceForm textarea[name="serviceNotes"]');

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the field as a GET query string.
serviceForm.addEventListener('submit', submitServiceForm);


/**
 * Fetches and renders the service history for the given item.
 * @param {MaintenanceItem} item
 */
async function populateServiceHistory(item) {
  historyList.innerHTML = '';
  const history = await getServiceHistory(item._key || '');
  if (!history.length) {
    historyList.innerHTML = 'No hay servicios registrados para este ítem';
    return;
  }
  history.forEach(record => appendServiceHistoryRow(record));
}

/**
 * @param {ServiceRecord} record
 * @param {boolean} [prepend]
 */
function appendServiceHistoryRow(record, prepend = false) {
  const key = (record._key || '').toString();
  const _mileage = $new({ class: 'mileage', text: `${record.mileage.toLocaleString('es')} km` });
  const _date = $new({ class: 'date', text: timeAgo(record.date) });
  const _rightSide = $new({ class: 'right-side', children: [_date] });
  const row = $new({
    class: 'row',
    children: [_mileage, _rightSide],
    dataset: [
      ['clickAction', 'deleteServiceRecord'],
      ['serviceKey', key],
      ['itemKey', (record.itemKey || '').toString()],
    ],
  });

  if (record.cost) {
    _rightSide.prepend($new({ class: 'cost', text: `$${record.cost.toLocaleString('es', { maximumFractionDigits: 2 })}` }));
  }
  if (record.notes) {
    _rightSide.append($new({ class: 'has-notes', html: svg_notes() }));
  }
  _rightSide.append($new({ class: 'delete-icon', html: svg_trash() }));

  if (historyList.innerText.includes('No hay servicios')) { historyList.innerHTML = ''; }

  if (prepend) { historyList.prepend(row); } else { historyList.append(row); }
}

/**
 * Opens the "mark as serviced" modal, prefilled with the vehicle's current reading.
 */
function openServiceForm() {
  const item = dataState.currentItem;
  const vehicle = dataState.currentVehicle;
  if (!item || !vehicle) { return; }

  serviceMileageInput.value = vehicle.currentMileage.toString();
  serviceDateInput.value = toYYYYMMDD(vehicle.currentMileageDate || new Date());
  serviceCostInput.value = '';
  serviceNotesInput.value = '';

  setStateField('showServiceForm', true);
  serviceMileageInput.focus();
  serviceMileageInput.select();
}

/**
 * @param {Event} e
 */
async function submitServiceForm(e) {
  e.preventDefault();
  const item = dataState.currentItem;
  if (!item) { return; }

  const formData = new FormData(serviceForm);
  const mileage = Number(formData.get('serviceMileage'));
  const dateStr = formData.get('serviceDate')?.toString();
  const date = dateStr ? fromYYYYMMDD(dateStr) : new Date();
  const notes = formData.get('serviceNotes')?.toString() || '';
  const costStr = formData.get('serviceCost')?.toString();
  const cost = costStr ? Number(costStr) : null;

  const result = await markItemServiced(item, mileage, date, notes, cost);
  if (!result.data) { return _error(result.errorMsg); }

  haptic();
  appendServiceHistoryRow(result.data, true);
  serviceForm.reset();
  setStateField('showServiceForm', false);

  await refreshAfterService(item);
}

/**
 * Deletes a service record. The actual API delete (and the server's
 * recompute of the parent item's last-service fields) is deferred until the
 * undo toast's window truly expires - until then only the in-memory cache
 * changes, so "undo" is a pure local restore with no network call.
 * @param {string} serviceKey
 * @param {string} itemKey
 */
async function tryDeleteServiceRecord(serviceKey, itemKey) {
  const strItemKey = itemKey;
  const history = dbStore.serviceHistory[strItemKey] || [];
  const key = +serviceKey;
  const idx = history.findIndex(r => r._key === key);
  if (idx === -1) { return; }
  const [record] = history.splice(idx, 1);

  const row = $queryOne(`[data-service-key="${serviceKey}"]`);
  if (row) { row.remove(); }

  // idx === 0 means this was the newest record (history is kept newest
  // first) - i.e. the one the item's last-service fields currently reflect.
  const item = dataState.currentItem;
  const wasNewest = idx === 0 && !!item && item._key != null && item._key.toString() === strItemKey;
  const previousLastService = wasNewest ? { mileage: item.lastServiceMileage, date: item.lastServiceDate } : null;

  if (wasNewest && item) {
    // Optimistic client-side recompute from what's left in the cache, for
    // immediate UI feedback - nothing is persisted yet.
    const next = history[0] || null;
    item.lastServiceMileage = next ? next.mileage : null;
    item.lastServiceDate = next ? next.date : null;
    await refreshAfterServiceLocal(item);
  }

  if (!history.length) {
    historyList.innerHTML = 'No hay servicios registrados para este ítem';
  }

  showUndoToast('Registro de servicio eliminado', () => {
    history.splice(idx, 0, record);

    if (wasNewest && item && previousLastService) {
      item.lastServiceMileage = previousLastService.mileage;
      item.lastServiceDate = previousLastService.date;
      refreshAfterServiceLocal(item);
    }

    if (dataState.currentItem && dataState.currentItem._key != null && dataState.currentItem._key.toString() === strItemKey) {
      populateServiceHistory(dataState.currentItem);
    }
  }, {
    onExpire: async () => {
      const updatedItem = await deleteServiceRecord(record);
      if (updatedItem && dataState.currentItem && dataState.currentItem._key === updatedItem._key) {
        dataState.currentItem.lastServiceMileage = updatedItem.lastServiceMileage;
        dataState.currentItem.lastServiceDate = updatedItem.lastServiceDate;
      }
    },
  });
}


export { populateServiceHistory, openServiceForm, submitServiceForm, tryDeleteServiceRecord };
