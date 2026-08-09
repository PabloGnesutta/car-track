import { timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { putOne } from "../lib/indexedDb.js";
import { dataState, dbStore, setStateField } from "../common/state.js";
import { deleteServiceRecord, getServiceHistory, markItemServiced } from "../local-db/service-db.js";
import { svg_notes, svg_trash } from "../svg/svgFn.js";
import { refreshAfterService } from "./maintenance-ui.js";


/**
 * @typedef {import("../local-db/maintenance-db.js").MaintenanceItem} MaintenanceItem
 * @typedef {import("../local-db/service-db.js").ServiceRecord} ServiceRecord
 */

const singleItemView = $('singleItemView');
const historyList = $getInner(singleItemView, '.service-history-list');

const serviceForm = $form('serviceForm');
const serviceMileageInput = $queryOneInput('#serviceForm input[name="serviceMileage"]');
const serviceDateInput = $queryOneInput('#serviceForm input[name="serviceDate"]');
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
  const date = dateStr ? new Date(dateStr) : new Date();
  const notes = formData.get('serviceNotes')?.toString() || '';

  const result = await markItemServiced(item, mileage, date, notes);
  if (!result.data) { return _error(result.errorMsg); }

  appendServiceHistoryRow(result.data, true);
  serviceForm.reset();
  setStateField('showServiceForm', false);

  await refreshAfterService(item);
}

/**
 * @param {string} serviceKey
 * @param {string} itemKey
 */
async function tryDeleteServiceRecord(serviceKey, itemKey) {
  if (!confirm('¿Seguro que querés borrar este registro?')) { return; }

  const strItemKey = itemKey;
  const history = dbStore.serviceHistory[strItemKey] || [];
  const key = +serviceKey;
  const record = history.find(r => r._key === key);
  if (!record) { return; }

  await deleteServiceRecord(record);

  const idx = history.findIndex(r => r._key === key);
  if (idx !== -1) { history.splice(idx, 1); }

  const row = $queryOne(`[data-service-key="${serviceKey}"]`);
  if (row) { row.remove(); }

  // If the deleted record was the item's denormalized last-service, fall back
  // to the next most recent one (history is kept newest-first).
  const item = dataState.currentItem;
  if (item && item._key && item._key.toString() === strItemKey && item.lastServiceRecord?._key === key) {
    const next = history[0] || null;
    item.lastServiceRecord = next;
    if (next) {
      item.lastServiceMileage = next.mileage;
      item.lastServiceDate = next.date;
    }
    await putOne('maintenanceItems', item, item._key);
    await refreshAfterService(item);
  }

  if (!history.length) {
    historyList.innerHTML = 'No hay servicios registrados para este ítem';
  }
}


export { populateServiceHistory, openServiceForm, submitServiceForm, tryDeleteServiceRecord };
