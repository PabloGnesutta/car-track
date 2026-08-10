import { $, $getInner, $new } from "../lib/dom.js";
import { timeAgo } from "../lib/date.js";
import { dataState, setStateField } from "../common/state.js";
import { getMileageHistory } from "../local-db/mileage-db.js";
import { svg_notes } from "../svg/svgFn.js";


/**
 * @typedef {import("../local-db/mileage-db.js").MileageHistoryRecord} MileageHistoryRecord
 */

const mileageHistoryModal = $('mileageHistoryModal');
const mileageHistoryList = $getInner(mileageHistoryModal, '.mileage-history-list');


/**
 * Opens the mileage history modal for the current vehicle.
 */
async function openMileageHistory() {
  const vehicle = dataState.currentVehicle;
  if (!vehicle || !vehicle._key) { return; }

  await populateMileageHistory(vehicle._key);
  setStateField('showMileageHistory', true);
}

/**
 * Fetches and renders the mileage history for the given vehicle.
 * @param {IDBValidKey} vehicleKey
 */
async function populateMileageHistory(vehicleKey) {
  mileageHistoryList.innerHTML = '';
  const history = await getMileageHistory(vehicleKey);
  if (!history.length) {
    mileageHistoryList.innerHTML = 'No hay registros de kilometraje para este vehículo';
    return;
  }
  history.forEach(record => appendMileageHistoryRow(record));
}

/**
 * @param {MileageHistoryRecord} record
 */
function appendMileageHistoryRow(record) {
  const sign = record.distance > 0 ? '+' : '';
  const _mileage = $new({ class: 'mileage', text: `${record.mileage.toLocaleString('es')} km` });
  const _distance = $new({ class: 'distance', text: `${sign}${record.distance.toLocaleString('es')} km` });
  const _date = $new({ class: 'date', text: timeAgo(record.date) });
  const _rightSide = $new({ class: 'right-side', children: [_distance, _date] });
  const row = $new({ class: 'row', children: [_mileage, _rightSide] });

  if (record.notes) {
    _rightSide.append($new({ class: 'has-notes', html: svg_notes() }));
  }

  mileageHistoryList.append(row);
}


export { openMileageHistory, populateMileageHistory };
