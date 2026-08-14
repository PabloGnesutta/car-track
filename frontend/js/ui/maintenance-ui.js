import { fromYYYYMMDD, toYYYYMMDD } from "../lib/date.js";
import { _error } from "../lib/logger.js";
import { matches, normalize } from "../lib/string.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { appState, dataState, dbStore, setCurrentView, setStateField } from "../common/state.js";
import {
  createMaintenanceItem, deleteMaintenanceItem, restoreMaintenanceItem, deleteMaintenanceItemsForVehicle,
  fetchMaintenanceItems, updateMaintenanceItem,
} from "../local-db/maintenance-db.js";
import { deleteItemHistory, restoreServiceRecords } from "../local-db/service-db.js";
import { computeStatus, formatDueDetail, formatRemindersBanner, statusBadgeHtml } from "../lib/maintenanceStatus.js";
import { showUndoToast } from "../lib/toast.js";
import { svg_wrench } from "../svg/svgFn.js";
import { pageTitle } from "./ui.js";
import { populateServiceHistory } from "./service-ui.js";
import { renderVehicleChips } from "./vehicle-ui.js";


/**
 * @typedef {import("../local-db/vehicle-db.js").Vehicle} Vehicle
 * @typedef {import("../local-db/maintenance-db.js").MaintenanceItem} MaintenanceItem
 */

const itemList = $queryOne('#maintenanceListView .list');
const remindersBanner = $queryOne('#maintenanceListView .reminders-banner');
const remindersText = $getInner(remindersBanner, '.reminders-text');

const singleItemView = $('singleItemView');
const itemName = $getInner(singleItemView, '.name');
const statusBadge = $getInner(singleItemView, '.status-badge');
const dueDetail = $getInner(singleItemView, '.due-detail');
const intervalDetail = $getInner(singleItemView, '.interval-detail');
const notesDetail = $getInner(singleItemView, '.notes-detail');

const itemForm = $form('itemForm');
const itemNameInput = $queryOneInput('#itemForm input[name="itemName"]');
const intervalKmInput = $queryOneInput('#itemForm input[name="intervalKm"]');
const intervalDaysInput = $queryOneInput('#itemForm input[name="intervalDays"]');
const lastServiceMileageInput = $queryOneInput('#itemForm input[name="lastServiceMileage"]');
const lastServiceDateInput = $queryOneInput('#itemForm input[name="lastServiceDate"]');
const lastServiceInputsContainer = $queryOne('#itemForm .last-service-inputs');
const itemNotesInput = $queryOneInput('#itemForm textarea[name="itemNotes"]');
const submitItemBtn = $queryOne('#itemForm .submit');

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the field as a GET query string.
itemForm.addEventListener('submit', submitItemForm);

/** Search */
const searchInput = $queryOneInput('#searchItem');
searchInput.addEventListener('input', e => {
  if (!e.target) { return; }
  /** @type {string} */ // @ts-ignore
  const value = e.target.value;
  dbStore.maintenanceItems.forEach(item => {
    const row = $queryOne(`[data-item-key="${item._key}"]`);
    if (!row) { return; }
    if (matches(item.normalizedName || '', value)) {
      row.classList.remove('display-none');
    } else {
      row.classList.add('display-none');
    }
  });
});

/**
 * Shows/hides the search bar. Clears any active filter when hiding so
 * items aren't left stuck filtered out with no visible way to search.
 */
function toggleSearch() {
  const next = !appState.showSearch;
  setStateField('showSearch', next);
  if (next) {
    searchInput.focus();
  } else {
    searchInput.value = '';
    dbStore.maintenanceItems.forEach(item => {
      const row = $queryOne(`[data-item-key="${item._key}"]`);
      if (row) { row.classList.remove('display-none'); }
    });
  }
}


/**
 * Fetch all maintenance items for the vehicle, sorted by urgency, and render the list.
 * @param {Vehicle} vehicle
 */
async function fetchAndRenderMaintenanceItems(vehicle) {
  const items = await fetchMaintenanceItems(vehicle._key || '', vehicle.currentMileage, vehicle.currentMileageDate);
  itemList.innerHTML = '';
  if (!items.length) {
    itemList.append($new({
      class: 'empty-state',
      html: `<div class="empty-state-icon">${svg_wrench()}</div><p>No hay ítems de mantenimiento todavía. Tocá + para agregar uno.</p>`,
    }));
    updateRemindersBanner(0, 0);
  } else {
    const statuses = items.map(item => appendItemRow(item, vehicle));
    updateRemindersBanner(
      statuses.filter(s => s === 'overdue').length,
      statuses.filter(s => s === 'due-soon').length,
    );
  }
  await renderVehicleChips();
}

/**
 * Shows/hides and fills the "due soon" summary banner at the top of the list.
 * @param {number} overdueCount
 * @param {number} dueSoonCount
 */
function updateRemindersBanner(overdueCount, dueSoonCount) {
  if (!overdueCount && !dueSoonCount) {
    remindersBanner.classList.add('display-none');
    return;
  }
  remindersBanner.dataset.status = overdueCount > 0 ? 'overdue' : 'due-soon';
  remindersText.innerText = formatRemindersBanner(overdueCount, dueSoonCount);
  remindersBanner.classList.remove('display-none');
}

/** Open the maintenance list view */
function openMaintenanceList() {
  setCurrentView('MaintenanceList');
  pageTitle.innerText = 'Principal';
}

/**
 * @param {MaintenanceItem} item
 * @param {Vehicle} vehicle
 * @returns {import("../lib/maintenanceStatus.js").MaintenanceStatus}
 */
function appendItemRow(item, vehicle) {
  const key = (item._key || '').toString();
  const { status, kmRemaining, daysRemaining } = computeStatus(item, vehicle.currentMileage, vehicle.currentMileageDate);

  const nameChildren = [$new({ class: 'itemName', text: item.name })];
  if (item.notes) {
    nameChildren.push($new({ class: 'itemMeta', text: item.notes }));
  }

  const row = $new({
    class: 'row',
    dataset: [
      ['clickAction', 'openSingleItem'],
      ['itemKey', key],
      ['status', status],
    ],
    children: [
      $new({ class: 'left-side', children: nameChildren }),
      $new({
        class: 'right-side',
        children: [
          $new({ class: 'status-badge', html: statusBadgeHtml(status) }),
          $new({ class: 'due-detail', text: formatDueDetail({ status, kmRemaining, daysRemaining }) }),
        ],
      }),
    ],
  });

  itemList.append(row);
  return status;
}

/**
 * Open create/edit maintenance item modal.
 * @param {boolean} isEdit
 */
function openItemForm(isEdit) {
  const submitLabel = $getInner(submitItemBtn, '.label');
  const formTitle = $getInner(itemForm, '.form-title');
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  if (isEdit === true) {
    setStateField('editingItem', true);
    const item = dataState.currentItem;
    if (!item) { return; }
    itemNameInput.value = item.name;
    intervalKmInput.value = item.intervalKm != null ? item.intervalKm.toString() : '';
    intervalDaysInput.value = item.intervalDays != null ? item.intervalDays.toString() : '';
    lastServiceMileageInput.value = item.lastServiceMileage.toString();
    lastServiceDateInput.value = toYYYYMMDD(item.lastServiceDate);
    itemNotesInput.value = item.notes || '';
    lastServiceInputsContainer.classList.add('display-none');
    submitLabel.innerText = 'Guardar Cambios';
    formTitle.innerText = 'Editar Mantenimiento';
  } else {
    setStateField('editingItem', false);
    itemForm.reset();
    lastServiceMileageInput.value = vehicle.currentMileage.toString();
    lastServiceDateInput.value = toYYYYMMDD(new Date());
    lastServiceInputsContainer.classList.remove('display-none');
    submitLabel.innerText = 'Crear Mantenimiento';
    formTitle.innerText = 'Nuevo Mantenimiento';
  }

  setStateField('showItemForm', true);
  itemNameInput.focus();
  itemNameInput.select();
}

/**
 * @param {Event} e
 */
async function submitItemForm(e) {
  e.preventDefault();
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  const formData = new FormData(itemForm);
  const name = formData.get('itemName') || '';
  if (typeof name !== 'string') { return; }

  const intervalKm = formData.get('intervalKm') ? Number(formData.get('intervalKm')) : null;
  const intervalDays = formData.get('intervalDays') ? Number(formData.get('intervalDays')) : null;
  const notes = formData.get('itemNotes')?.toString() || '';

  if (appState.editingItem === true && dataState.currentItem) {
    const result = await updateMaintenanceItem(dataState.currentItem, { name, intervalKm, intervalDays, notes });
    if (!result.data) { return _error(result.errorMsg); }
    setStateField('editingItem', false);
  } else {
    const lastServiceMileage = formData.get('lastServiceMileage')
      ? Number(formData.get('lastServiceMileage')) : vehicle.currentMileage;
    const lastServiceDateStr = formData.get('lastServiceDate')?.toString();
    const lastServiceDate = lastServiceDateStr ? fromYYYYMMDD(lastServiceDateStr) : new Date();

    const result = await createMaintenanceItem(vehicle._key || '', name, {
      intervalKm, intervalDays, notes, lastServiceMileage, lastServiceDate,
    });
    if (!result.data) { return _error(result.errorMsg); }
  }

  itemForm.reset();
  setStateField('showItemForm', false);

  await fetchAndRenderMaintenanceItems(vehicle);
  if (appState.currentView === 'SingleItem' && dataState.currentItem) {
    renderItemDetail(dataState.currentItem, vehicle);
  }
}

/**
 * @param {string} itemKey
 */
async function openSingleItem(itemKey) {
  const key = +itemKey;
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  let item = dataState.currentItem || undefined;
  if (key !== item?._key) {
    item = dbStore.maintenanceItems.find(i => i._key === key);
  }
  if (!item) { return _error('Ítem de mantenimiento no encontrado'); }

  setCurrentView('SingleItem');
  pageTitle.innerText = 'Detalle';
  dataState.currentItem = item;

  renderItemDetail(item, vehicle);
  await populateServiceHistory(item);
}

/**
 * @param {MaintenanceItem} item
 * @param {Vehicle} vehicle
 */
function renderItemDetail(item, vehicle) {
  const { status, kmRemaining, daysRemaining } = computeStatus(item, vehicle.currentMileage, vehicle.currentMileageDate);
  itemName.innerText = item.name;
  statusBadge.innerHTML = statusBadgeHtml(status);
  statusBadge.dataset.status = status;
  dueDetail.dataset.status = status;
  dueDetail.innerText = formatDueDetail({ status, kmRemaining, daysRemaining });

  const intervalParts = [];
  if (item.intervalKm) { intervalParts.push(`${item.intervalKm.toLocaleString('es')} km`); }
  if (item.intervalDays) { intervalParts.push(`${item.intervalDays} días`); }
  intervalDetail.innerText = 'Cada ' + intervalParts.join(' / ');

  notesDetail.innerText = item.notes || '';
}

function closeSingleItem() {
  if (appState.currentView !== 'SingleItem') { return; }
  setCurrentView('MaintenanceList');
  openMaintenanceList();
}

async function tryDeleteItem() {
  const item = dataState.currentItem;
  const vehicle = dataState.currentVehicle;
  if (!item || !vehicle) { return; }
  const itemKey = item._key;
  if (!itemKey) { return; }

  const historySnapshot = (dbStore.serviceHistory[itemKey.toString()] || []).slice();

  await deleteMaintenanceItem(itemKey);
  await deleteItemHistory(itemKey);

  closeSingleItem();

  const idx = dbStore.maintenanceItems.findIndex(i => i._key === itemKey);
  if (idx !== -1) { dbStore.maintenanceItems.splice(idx, 1); }
  delete dbStore.serviceHistory[itemKey.toString()];

  dataState.currentItem = null;
  await fetchAndRenderMaintenanceItems(vehicle);

  showUndoToast(`"${item.name}" eliminado`, async () => {
    await restoreMaintenanceItem(item);
    await restoreServiceRecords(historySnapshot);
    dbStore.serviceHistory[itemKey.toString()] = historySnapshot;
    await fetchAndRenderMaintenanceItems(vehicle);
  });
}

/**
 * Deletes all maintenance items (and their service history) for a vehicle
 * that's about to be deleted.
 * @param {IDBValidKey} vehicleKey
 */
async function deleteAllItemsForVehicle(vehicleKey) {
  const itemKeys = await deleteMaintenanceItemsForVehicle(vehicleKey);
  for (const itemKey of itemKeys) {
    await deleteItemHistory(itemKey);
  }
}

/**
 * Called after a service is marked done: refreshes the single-item view
 * and the list (order/badges depend on the newly-computed status).
 * @param {MaintenanceItem} item
 */
async function refreshAfterService(item) {
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }
  renderItemDetail(item, vehicle);
  await fetchAndRenderMaintenanceItems(vehicle);
}


export {
  fetchAndRenderMaintenanceItems, openMaintenanceList, openItemForm, submitItemForm,
  openSingleItem, closeSingleItem, tryDeleteItem, submitItemBtn, refreshAfterService, deleteAllItemsForVehicle,
  toggleSearch,
};
