import { fromYYYYMMDD, timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { dataState, dbStore, setStateField } from "../common/state.js";
import { addFuelRecord, deleteFuelRecord, getFuelHistory } from "../local-db/fuel-db.js";
import { computeFuelEfficiency, averageFuelEfficiency } from "../lib/fuelEconomy.js";
import { haptic } from "../lib/haptics.js";
import { showUndoToast } from "../lib/toast.js";
import { svg_trash } from "../svg/svgFn.js";
import { updateMileageDisplay } from "./vehicle-ui.js";
import { fetchAndRenderMaintenanceItems } from "./maintenance-ui.js";


const fuelHistoryModal = $('fuelHistoryModal');
const fuelHistoryList = $getInner(fuelHistoryModal, '.fuel-history-list');
const fuelAverageEl = $getInner(fuelHistoryModal, '.fuel-average .value');
const fuelEmptyEl = $getInner(fuelHistoryModal, '.fuel-empty');

const fuelForm = $form('fuelForm');
const fuelMileageInput = $queryOneInput('#fuelForm input[name="fuelMileage"]');
const fuelDateInput = $queryOneInput('#fuelForm input[name="fuelDate"]');
const fuelLitersInput = $queryOneInput('#fuelForm input[name="fuelLiters"]');
const fuelCostInput = $queryOneInput('#fuelForm input[name="fuelCost"]');
const fuelNotesInput = $queryOneInput('#fuelForm textarea[name="fuelNotes"]');

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the field as a GET query string.
fuelForm.addEventListener('submit', submitFuelForm);


/**
 * Opens the fuel history modal for the current vehicle, with the L/100km
 * average and per-fill-up breakdown.
 */
async function openFuelHistory() {
  const vehicle = dataState.currentVehicle;
  if (!vehicle || !vehicle._key) { return; }

  await populateFuelHistory(vehicle._key);
  setStateField('showFuelHistory', true);
}

/**
 * @param {IDBValidKey} vehicleKey
 */
async function populateFuelHistory(vehicleKey) {
  fuelHistoryList.innerHTML = '';
  const history = await getFuelHistory(vehicleKey); // newest first
  if (!history.length) {
    fuelEmptyEl.classList.remove('display-none');
    fuelAverageEl.innerText = 'Sin datos';
    return;
  }
  fuelEmptyEl.classList.add('display-none');

  const oldestFirst = history.slice().reverse();
  const points = computeFuelEfficiency(oldestFirst);
  const average = averageFuelEfficiency(points);
  fuelAverageEl.innerText = average !== null ? `${average.toFixed(1)} L/100km` : 'Sin datos suficientes';

  // Render newest first, matching the fetched history order.
  points.slice().reverse().forEach(point => appendFuelHistoryRow(point));
}

/**
 * @param {import("../lib/fuelEconomy.js").FuelEfficiencyPoint} point
 */
function appendFuelHistoryRow(point) {
  const key = (point._key || '').toString();
  const _mileage = $new({ class: 'mileage', text: `${point.mileage.toLocaleString('es')} km` });
  const _efficiency = $new({
    class: 'efficiency',
    text: point.litersPer100Km !== null ? `${point.litersPer100Km.toFixed(1)} L/100km` : '—',
  });
  const _meta = $new({ class: 'liters', text: `${point.liters.toLocaleString('es')} L · ${timeAgo(point.date)}` });
  const _rightSide = $new({ class: 'right-side', children: [_efficiency, _meta] });

  if (point.cost) {
    _rightSide.prepend($new({ class: 'cost', text: `$${point.cost.toLocaleString('es', { maximumFractionDigits: 2 })}` }));
  }

  const _deleteIcon = $new({ class: 'delete-icon', html: svg_trash() });

  const row = $new({
    class: 'row fuel-row',
    children: [_mileage, _rightSide, _deleteIcon],
    dataset: [['clickAction', 'deleteFuelRecord'], ['fuelKey', key]],
  });
  fuelHistoryList.append(row);
}

/**
 * Opens the "log a fill-up" form, prefilled with the vehicle's current reading.
 */
function openFuelForm() {
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  fuelMileageInput.value = vehicle.currentMileage.toString();
  fuelDateInput.value = toYYYYMMDD(new Date());
  fuelLitersInput.value = '';
  fuelCostInput.value = '';
  fuelNotesInput.value = '';

  setStateField('showFuelForm', true);
  fuelLitersInput.focus();
}

/**
 * @param {Event} e
 */
async function submitFuelForm(e) {
  e.preventDefault();
  const vehicle = dataState.currentVehicle;
  if (!vehicle || !vehicle._key) { return; }

  const formData = new FormData(fuelForm);
  const mileage = Number(formData.get('fuelMileage'));
  const liters = Number(formData.get('fuelLiters'));
  const dateStr = formData.get('fuelDate')?.toString();
  const date = dateStr ? fromYYYYMMDD(dateStr) : new Date();
  const costStr = formData.get('fuelCost')?.toString();
  const cost = costStr ? Number(costStr) : null;
  const notes = formData.get('fuelNotes')?.toString() || '';

  const result = await addFuelRecord(vehicle, mileage, liters, date, cost, notes);
  if (!result.data) { return _error(result.errorMsg); }

  haptic();
  fuelForm.reset();
  setStateField('showFuelForm', false);

  // A fill-up mileage ahead of the vehicle's current mileage advances it
  // (see addFuelRecord) - keep the header reading and maintenance statuses,
  // which depend on it, in sync.
  updateMileageDisplay(vehicle);
  await fetchAndRenderMaintenanceItems(vehicle);

  // Return to the (now refreshed) history list rather than closing everything.
  await populateFuelHistory(vehicle._key);
  setStateField('showFuelHistory', true);
}

/**
 * Deletes a fuel record, deferred until the undo toast's window truly
 * expires (until then only the in-memory cache changes, so "undo" is a pure
 * local restore with no network call) - same convention as
 * tryDeleteServiceRecord. Re-renders the whole list rather than patching
 * one row out, since L/100km and the average depend on the full sequence
 * of remaining fill-ups.
 * @param {string} fuelKey
 */
async function tryDeleteFuelRecord(fuelKey) {
  const vehicle = dataState.currentVehicle;
  if (!vehicle || !vehicle._key) { return; }

  const strVehicleKey = vehicle._key.toString();
  const history = dbStore.fuelHistory[strVehicleKey] || [];
  const key = +fuelKey;
  const idx = history.findIndex(r => r._key === key);
  if (idx === -1) { return; }
  const [record] = history.splice(idx, 1);

  haptic();
  await populateFuelHistory(vehicle._key);

  showUndoToast('Carga de combustible eliminada', () => {
    history.splice(idx, 0, record);
    populateFuelHistory(vehicle._key);
  }, {
    onExpire: () => deleteFuelRecord(record),
  });
}


export { openFuelHistory, openFuelForm, submitFuelForm, tryDeleteFuelRecord };
