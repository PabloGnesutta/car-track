import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { appState, dataState, dbStore, setStateField } from "../common/state.js";
import { createVehicle, logMileage, setLastUsedVehicleKey } from "../local-db/vehicle-db.js";
import { fetchAndRenderMaintenanceItems, openMaintenanceList } from "./maintenance-ui.js";


/**
 * @typedef {import("../local-db/vehicle-db.js").Vehicle} Vehicle
 */

const vehicleForm = $form('vehicleForm');
const vehicleNameInput = $queryOneInput('#vehicleForm input[name="vehicleName"]');
const vehicleMileageInput = $queryOneInput('#vehicleForm input[name="vehicleMileage"]');

const vehicleSwitcher = $('vehicleSwitcher');
const vehicleList = $getInner(vehicleSwitcher, '.vehicle-list');
const vehicleSwitcherBtn = $('vehicleSwitcherBtn');

const mileageForm = $form('mileageForm');
const mileageInput = $queryOneInput('#mileageForm input[name="mileage"]');

const mileageValue = $queryOne('#maintenanceListView .vehicle-summary .mileage .value');

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the field as a GET query string.
vehicleForm.addEventListener('submit', submitVehicleForm);
mileageForm.addEventListener('submit', submitMileageForm);


/**
 * Open the "new vehicle" modal.
 * @param {boolean} onboarding - When true, blocks dismissal until a vehicle is created.
 */
function openVehicleForm(onboarding = false) {
  setStateField('showVehicleSwitcher', false);
  if (onboarding) {
    setStateField('onboarding', true);
  }
  setStateField('showVehicleForm', true);
  vehicleNameInput.focus();
}

/**
 * Creates the vehicle and activates it as current.
 * @param {Event} e
 */
async function submitVehicleForm(e) {
  e.preventDefault();
  const formData = new FormData(vehicleForm);
  const name = formData.get('vehicleName') || '';
  const mileage = Number(formData.get('vehicleMileage'));
  if (typeof name !== 'string') { return; }

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
 * Sets the given vehicle as current, updates the header/summary,
 * and fetches+renders its maintenance items.
 * @param {Vehicle} vehicle
 */
async function activateVehicle(vehicle) {
  dataState.currentVehicle = vehicle;
  setLastUsedVehicleKey(vehicle._key || '');

  updateVehicleHeader(vehicle);
  updateMileageDisplay(vehicle);

  await fetchAndRenderMaintenanceItems(vehicle);
  openMaintenanceList();
}

/** @param {Vehicle} vehicle */
function updateVehicleHeader(vehicle) {
  vehicleSwitcherBtn.innerText = vehicle.name;
}

/** @param {Vehicle} vehicle */
function updateMileageDisplay(vehicle) {
  mileageValue.innerText = vehicle.currentMileage.toLocaleString('es');
}

/**
 * Opens the vehicle switcher modal, listing all vehicles.
 */
function openVehicleSwitcher() {
  renderVehicleSwitcherList();
  setStateField('showVehicleSwitcher', true);
}

function renderVehicleSwitcherList() {
  vehicleList.innerHTML = '';
  const currentKey = dataState.currentVehicle?._key;
  dbStore.vehicles.forEach(vehicle => {
    const row = $new({
      class: 'row' + (vehicle._key === currentKey ? ' selected' : ''),
      dataset: [
        ['clickAction', 'switchVehicle'],
        ['vehicleKey', (vehicle._key || '').toString()],
      ],
      children: [
        $new({ class: 'vehicleName', text: vehicle.name }),
        $new({ class: 'vehicleMileage', text: vehicle.currentMileage.toLocaleString('es') + ' km' }),
      ],
    });
    vehicleList.append(row);
  });
}

/**
 * @param {string} vehicleKey
 */
async function switchVehicle(vehicleKey) {
  const key = +vehicleKey;
  if (key === dataState.currentVehicle?._key) {
    setStateField('showVehicleSwitcher', false);
    return;
  }
  const vehicle = dbStore.vehicles.find(v => v._key === key);
  if (!vehicle) { return; }

  setStateField('showVehicleSwitcher', false);
  await activateVehicle(vehicle);
}

function openAddVehicleFromSwitcher() {
  openVehicleForm(false);
}

/**
 * Open the "log new mileage" modal, prefilled with the vehicle's current mileage.
 */
function openMileageForm() {
  if (!dataState.currentVehicle) { return; }
  mileageInput.value = dataState.currentVehicle.currentMileage.toString();
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

  const result = await logMileage(vehicle, mileage, new Date());
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
  openVehicleForm, submitVehicleForm, activateVehicle,
  openVehicleSwitcher, switchVehicle, openAddVehicleFromSwitcher,
  openMileageForm, submitMileageForm,
};
