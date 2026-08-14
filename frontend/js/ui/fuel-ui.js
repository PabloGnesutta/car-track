import { fromYYYYMMDD, timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { dataState, setStateField } from "../common/state.js";
import { addFuelRecord, getFuelHistory } from "../local-db/fuel-db.js";
import { computeFuelEfficiency, averageFuelEfficiency } from "../lib/fuelEconomy.js";
import { haptic } from "../lib/haptics.js";


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
 * @param {import("../lib/fuelEconomy.js").FuelEfficiencyPoint & {notes?: string, cost?: number|null}} point
 */
function appendFuelHistoryRow(point) {
  const _mileage = $new({ class: 'mileage', text: `${point.mileage.toLocaleString('es')} km` });
  const _efficiency = $new({
    class: 'efficiency',
    text: point.litersPer100Km !== null ? `${point.litersPer100Km.toFixed(1)} L/100km` : '—',
  });
  const _meta = $new({ class: 'liters', text: `${point.liters.toLocaleString('es')} L · ${timeAgo(point.date)}` });
  const _rightSide = $new({ class: 'right-side', children: [_efficiency, _meta] });

  const row = $new({ class: 'row fuel-row', children: [_mileage, _rightSide] });
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

  const result = await addFuelRecord(vehicle._key, mileage, liters, date, cost, notes);
  if (!result.data) { return _error(result.errorMsg); }

  haptic();
  fuelForm.reset();
  setStateField('showFuelForm', false);

  // Return to the (now refreshed) history list rather than closing everything.
  await populateFuelHistory(vehicle._key);
  setStateField('showFuelHistory', true);
}


export { openFuelHistory, openFuelForm, submitFuelForm };
