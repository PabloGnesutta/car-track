import { appState, dataState, dbStore, setStateField } from "../common/state.js";
import { $, $button, $getInner, $queryOne } from "../lib/dom.js";
import { _info, _log, _warn, openLogs } from "../lib/logger.js";
import { arrow_left, pen_solid, svg_chart, svg_check, svg_clock, svg_fuel, svg_search, svg_share, svg_trash } from "../svg/svgFn.js";
import {
  deleteVehicleFromForm, editVehicle, openAddVehicle, openMileageForm,
  submitMileageForm, submitVehicleForm, switchVehicle,
} from "./vehicle-ui.js";
import {
  closeSingleItem, openItemForm, openSingleItem, submitItemBtn, submitItemForm, toggleSearch, tryDeleteItem,
} from "./maintenance-ui.js";
import { openServiceForm, submitServiceForm, tryDeleteServiceRecord } from "./service-ui.js";
import { openMileageHistory } from "./mileage-ui.js";
import { shareVehicleReport } from "./report-ui.js";
import { openCostAnalytics } from "./analytics-ui.js";
import { openFuelForm, openFuelHistory, submitFuelForm } from "./fuel-ui.js";


const mainHeader = $('mainHeader');
const pageTitle = $getInner(mainHeader, '.page-title');

function initUi() {
  // Go Back Button
  $button({
    appendTo: $('goBack2'),
    svgFn: arrow_left,
    listener: {
      fn: e => {
        switch (appState.currentView) {
          case 'MaintenanceList':
            break;
          case 'SingleItem':
            closeSingleItem();
            break;
          default: break;
        }
      }
    }
  });

  $getInner($('logMileageBtn'), '.edit-hint').innerHTML = pen_solid();
  $('logMileageBtn').addEventListener('click', () => { openMileageForm(); });
  $('mileageHistoryBtn').innerHTML = svg_clock();
  $('mileageHistoryBtn').addEventListener('click', () => { openMileageHistory(); });
  $('costAnalyticsBtn').innerHTML = svg_chart();
  $('costAnalyticsBtn').addEventListener('click', () => { openCostAnalytics(); });
  $('fuelHistoryBtn').innerHTML = svg_fuel();
  $('fuelHistoryBtn').addEventListener('click', () => { openFuelHistory(); });
  $('shareReportBtn').innerHTML = svg_share();
  $('shareReportBtn').addEventListener('click', () => { shareVehicleReport(); });
  $queryOne('.search-container .search-icon').innerHTML = svg_search();
  $('newItemBtn').addEventListener('click', () => { openItemForm(false); });

  $button({
    class: 'icon-btn search-toggle-btn',
    svgFn: svg_search,
    listener: { fn: toggleSearch },
    appendTo: $('mainFooter'),
  });
  const searchToggleBtn = $queryOne('#mainFooter .search-toggle-btn');
  searchToggleBtn.setAttribute('aria-label', 'Buscar');
  searchToggleBtn.title = 'Buscar';

  $button({
    label: 'Marcar como realizado',
    svgFn: svg_check,
    class: 'horizontal',
    listener: { fn: openServiceForm },
    appendTo: $('markServicedBtn'),
  });

  $button({
    label: 'Agregar Vehículo',
    listener: { fn: submitVehicleForm },
    appendTo: $queryOne('#vehicleForm .submit'),
  });

  $button({
    // Borrar Vehículo (only shown while editing an existing one)
    listener: { fn: deleteVehicleFromForm },
    svgFn: svg_trash,
    appendTo: $('deleteVehicleBtn'),
  });

  $button({
    label: 'Actualizar',
    listener: { fn: submitMileageForm },
    appendTo: $queryOne('#mileageForm .submit'),
  });

  $button({
    label: 'Cargar Combustible',
    svgFn: svg_fuel,
    class: 'horizontal',
    listener: { fn: openFuelForm },
    appendTo: $('addFuelBtn'),
  });

  $button({
    label: 'Guardar',
    listener: { fn: submitFuelForm },
    appendTo: $queryOne('#fuelForm .submit'),
  });

  $button({
    label: 'Crear Mantenimiento',
    listener: { fn: submitItemForm },
    appendTo: submitItemBtn,
  });

  $button({
    label: 'Guardar',
    listener: { fn: submitServiceForm },
    appendTo: $queryOne('#serviceForm .submit'),
  });

  $button({
    // Editar Mantenimiento
    listener: { fn: () => openItemForm(true) },
    svgFn: pen_solid,
    appendTo: $queryOne('#singleItemView .edit-btn'),
  });
  $button({
    // Borrar Mantenimiento
    listener: { fn: tryDeleteItem },
    svgFn: svg_trash,
    appendTo: $queryOne('#singleItemView .delete-btn'),
  });

  modalBackdropHandler();

  // Click Event Delegation
  $('app').addEventListener('click', e => {
    const target = e.target;
    if (!target) { return; }
    if (target instanceof HTMLInputElement) {
      target.select();
      return;
    }
    // Note: `instanceof Element` (not HTMLElement) so clicks landing on an
    // inline <svg>/<path> icon (an SVGElement) aren't silently dropped.
    if (!(target instanceof Element)) { return; }
    const clickElement = target.closest('[data-click-action]');
    if (!clickElement) { return; }
    if (!('dataset' in clickElement)) { return; }
    /** @type {DOMStringMap} */ //@ts-ignore
    const dataset = clickElement.dataset;
    switch (dataset.clickAction) {
      case 'openSingleItem':
        openSingleItem(dataset.itemKey || '');
        break;
      case 'switchVehicle':
        switchVehicle(dataset.vehicleKey || '');
        break;
      case 'editVehicle':
        editVehicle(dataset.vehicleKey || '');
        break;
      case 'openAddVehicle':
        openAddVehicle();
        break;
      case 'deleteServiceRecord':
        tryDeleteServiceRecord(dataset.serviceKey || '', dataset.itemKey || '');
        break;
      default:
        return _warn(' :: clickAction not defined: ' + dataset.clickAction);
    }
  });
}

function modalBackdropHandler() {
  $queryOne('#main-modal .backdrop').addEventListener('click', e => {
    if (appState.onboarding) { return; }
    /** @type {boolean} */ // @ts-ignore
    const clickedBackdrop = e.target.classList.contains('backdrop') || e.currentTarget.classList.contains('backdrop');
    if (clickedBackdrop) {
      setStateField('editingItem', false);
      setStateField('showVehicleForm', false);
      setStateField('showMileageForm', false);
      setStateField('showMileageHistory', false);
      setStateField('showItemForm', false);
      setStateField('showServiceForm', false);
      setStateField('showCostAnalytics', false);
      setStateField('showFuelForm', false);
      setStateField('showFuelHistory', false);
    }
  });
}


function dbugBtns() {
  const mainFooter = $('mainFooter');
  // $button({
  //   label: 'State',
  //   appendTo: mainFooter,
  //   listener: {
  //     fn: e => {
  //       _log('dbStore', dbStore);
  //       _log('dataState', dataState);
  //       openLogs()
  //     }
  //   }
  // });
  // $button({
  //   label: 'Logs',
  //   appendTo: mainFooter,
  //   listener: { fn: e => openLogs() }
  // });
}


export { initUi, dbugBtns, pageTitle };
