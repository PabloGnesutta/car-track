import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { pen_solid } from "../svg/svgFn.js";
import { setAppBadge } from "../lib/badge.js";
import { notifyDueItemsOnce } from "../lib/notifications.js";
import { showConfirm } from "./confirm-ui.js";
import { createVehicle, deleteVehicle, resolveCurrentVehicle, setLastUsedVehicleKey, updateVehicle, logMileage } from "../local-db/vehicle-db.js";
import { deleteVehicleMileageHistory } from "../local-db/mileage-db.js";
import { deleteVehicleFuelHistory } from "../local-db/fuel-db.js";
import { countItemsByStatus } from "../local-db/maintenance-db.js";
import { deleteAllItemsForVehicle, fetchAndRenderMaintenanceItems, openMaintenanceList } from "./maintenance-ui.js";
import { dataState, dbStore, setStateField } from "../common/state.js";


/**
 * @typedef {import("../local-db/vehicle-db.js").Vehicle} Vehicle
 */

const vehicleForm = $form('vehicleForm');
const vehicleNameInput = $queryOneInput('#vehicleForm input[name="vehicleName"]');
const vehicleMileageInput = $queryOneInput('#vehicleForm input[name="vehicleMileage"]');
const initialMileageInputContainer = $queryOne('#vehicleForm .initial-mileage-input');
const formTitleText = $getInner(vehicleForm, '.form-title-text');
const deleteVehicleBtn = $('deleteVehicleBtn');
const submitVehicleBtn = $queryOne('#vehicleForm .submit');

const chipsContainer = $queryOne('#maintenanceListView .vehicle-chips');

const mileageForm = $form('mileageForm');
const mileageInput = $queryOneInput('#mileageForm input[name="mileage"]');
const mileageNotesInput = $queryOneInput('#mileageForm textarea[name="mileageNotes"]');

const mileageValue = $queryOne('#maintenanceListView .vehicle-summary .mileage .value');

/** Vehicle currently being renamed/deleted via the form, if any. */
/** @type {Vehicle|null} */
let vehicleBeingEdited = null;

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the field as a GET query string.
vehicleForm.addEventListener('submit', submitVehicleForm);
mileageForm.addEventListener('submit', submitMileageForm);


/**
 * Open the "new/edit vehicle" modal.
 * @param {boolean} [onboarding] - When true, blocks dismissal until a vehicle is created.
 * @param {Vehicle|null} [editTarget] - When given, edits this vehicle instead of creating a new one.
 */
function openVehicleForm(onboarding = false, editTarget = null) {
  if (onboarding) {
    setStateField('onboarding', true);
  }

  const submitLabel = $getInner(submitVehicleBtn, '.label');
  vehicleBeingEdited = editTarget;

  if (editTarget) {
    vehicleNameInput.value = editTarget.name;
    formTitleText.innerText = 'Editar Vehículo';
    submitLabel.innerText = 'Guardar Cambios';
    deleteVehicleBtn.classList.remove('display-none');
    initialMileageInputContainer.classList.add('display-none');
  } else {
    vehicleForm.reset();
    formTitleText.innerText = 'Nuevo Vehículo';
    submitLabel.innerText = 'Agregar Vehículo';
    deleteVehicleBtn.classList.add('display-none');
    initialMileageInputContainer.classList.remove('display-none');
  }

  setStateField('showVehicleForm', true);
  vehicleNameInput.focus();
}

/**
 * Creates or renames the vehicle, depending on whether it was opened for editing.
 * @param {Event} e
 */
async function submitVehicleForm(e) {
  e.preventDefault();
  const formData = new FormData(vehicleForm);
  const name = formData.get('vehicleName') || '';
  if (typeof name !== 'string') { return; }

  if (vehicleBeingEdited) {
    const result = await updateVehicle(vehicleBeingEdited, name);
    if (!result.data) { return _error(result.errorMsg); }
    vehicleBeingEdited = null;
    vehicleForm.reset();
    setStateField('showVehicleForm', false);
    await renderVehicleChips();
    return;
  }

  const mileage = Number(formData.get('vehicleMileage'));
  const result = await createVehicle(name, mileage);
  if (!result.data) {
    return _error(result.errorMsg);
  }

  vehicleForm.reset();
  setStateField('showVehicleForm', false);
  setStateField('onboarding', false);

  await activateVehicle(result.data);
}

/**
 * Deletes the vehicle currently open in the edit form, and all of its
 * maintenance items/service history.
 */
async function deleteVehicleFromForm() {
  const vehicle = vehicleBeingEdited;
  if (!vehicle) { return; }
  const confirmed = await showConfirm(`¿Seguro que querés borrar "${vehicle.name}" y todos sus ítems de mantenimiento?`, { danger: true });
  if (!confirmed) { return; }

  const vehicleKey = vehicle._key;
  if (!vehicleKey) { return; }

  vehicleBeingEdited = null;
  vehicleForm.reset();
  setStateField('showVehicleForm', false);

  await deleteAllItemsForVehicle(vehicleKey);
  await deleteVehicleMileageHistory(vehicleKey);
  await deleteVehicleFuelHistory(vehicleKey);
  await deleteVehicle(vehicleKey);

  delete dbStore.mileageHistory[vehicleKey.toString()];
  delete dbStore.fuelHistory[vehicleKey.toString()];
  const idx = dbStore.vehicles.findIndex(v => v._key === vehicleKey);
  if (idx !== -1) { dbStore.vehicles.splice(idx, 1); }

  if (dataState.currentVehicle?._key === vehicleKey) {
    const next = resolveCurrentVehicle(dbStore.vehicles);
    if (next) {
      await activateVehicle(next);
    } else {
      dataState.currentVehicle = null;
      openVehicleForm(true);
      return;
    }
  }

  await renderVehicleChips();
}

/**
 * Sets the given vehicle as current, updates the summary, fetches+renders
 * its maintenance items (which also refreshes the chips), and opens the list.
 * @param {Vehicle} vehicle
 */
async function activateVehicle(vehicle) {
  dataState.currentVehicle = vehicle;
  setLastUsedVehicleKey(vehicle._key || '');

  updateMileageDisplay(vehicle);

  await fetchAndRenderMaintenanceItems(vehicle);
  openMaintenanceList();
}

/** @param {Vehicle} vehicle */
function updateMileageDisplay(vehicle) {
  mileageValue.innerText = vehicle.currentMileage.toLocaleString('es');
}

/**
 * Renders the vehicle chip row: one chip per vehicle (name + overdue/due-soon
 * badges + rename icon), the active one highlighted, plus a trailing "+"
 * chip to add another. Called whenever vehicles or maintenance items change.
 */
async function renderVehicleChips() {
  chipsContainer.innerHTML = '';
  const currentKey = dataState.currentVehicle?._key;
  const today = new Date();
  let totalUrgent = 0;
  /** @type {{ name: string, overdue: number, dueSoon: number }[]} */
  const vehicleSummaries = [];

  for (const vehicle of dbStore.vehicles) {
    const key = (vehicle._key || '').toString();
    const { overdue, dueSoon } = await countItemsByStatus(vehicle._key || '', vehicle.currentMileage, today);
    totalUrgent += overdue + dueSoon;
    vehicleSummaries.push({ name: vehicle.name, overdue, dueSoon });

    /** @type {HTMLElement[]} */
    const badges = [];
    if (overdue > 0) {
      badges.push($new({ class: 'vehicle-badge overdue', text: String(overdue) }));
    }
    if (dueSoon > 0) {
      badges.push($new({ class: 'vehicle-badge due-soon', text: String(dueSoon) }));
    }

    const chip = $new({
      class: 'vehicle-chip' + (vehicle._key === currentKey ? ' active' : ''),
      dataset: [
        ['clickAction', 'switchVehicle'],
        ['vehicleKey', key],
      ],
      children: [
        $new({ class: 'vehicleName', text: vehicle.name }),
        ...badges,
        $new({
          class: 'icon-btn',
          html: pen_solid(),
          dataset: [['clickAction', 'editVehicle'], ['vehicleKey', key]],
        }),
      ],
    });
    chipsContainer.append(chip);
  }

  chipsContainer.append($new({
    class: 'vehicle-chip add-chip',
    text: '+',
    dataset: [['clickAction', 'openAddVehicle']],
  }));

  setAppBadge(totalUrgent);
  notifyDueItemsOnce(vehicleSummaries);
}

/**
 * @param {string} vehicleKey
 */
async function switchVehicle(vehicleKey) {
  const key = +vehicleKey;
  if (key === dataState.currentVehicle?._key) { return; }
  const vehicle = dbStore.vehicles.find(v => v._key === key);
  if (!vehicle) { return; }

  await activateVehicle(vehicle);
}

function openAddVehicle() {
  openVehicleForm(false);
}

/**
 * @param {string} vehicleKey
 */
function editVehicle(vehicleKey) {
  const vehicle = dbStore.vehicles.find(v => v._key === +vehicleKey);
  if (!vehicle) { return; }
  openVehicleForm(false, vehicle);
}

/**
 * Open the "log new mileage" modal, prefilled with the vehicle's current mileage.
 */
function openMileageForm() {
  if (!dataState.currentVehicle) { return; }
  mileageInput.value = dataState.currentVehicle.currentMileage.toString();
  mileageNotesInput.value = '';
  setStateField('showMileageForm', true);
  mileageInput.focus();
  mileageInput.select();
}

/**
 * @param {Event} e
 */
async function submitMileageForm(e) {
  e.preventDefault();
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  const formData = new FormData(mileageForm);
  const mileage = Number(formData.get('mileage'));
  const notes = formData.get('mileageNotes')?.toString() || '';

  const result = await logMileage(vehicle, mileage, new Date(), notes);
  if (!result.data) {
    return _error(result.errorMsg);
  }

  updateMileageDisplay(vehicle);
  mileageForm.reset();
  setStateField('showMileageForm', false);

  // Statuses depend on the vehicle's current mileage/date, refresh the list.
  await fetchAndRenderMaintenanceItems(vehicle);
}


export {
  openVehicleForm, submitVehicleForm, deleteVehicleFromForm, activateVehicle,
  renderVehicleChips, switchVehicle, openAddVehicle, editVehicle,
  openMileageForm, submitMileageForm,
};
