import { $ } from "../lib/dom.js";
import { _log } from "../lib/logger.js";


/**
 * @typedef {import("../local-db/vehicle-db.js").Vehicle} Vehicle
 * @typedef {import("../local-db/maintenance-db.js").MaintenanceItem} MaintenanceItem
 * @typedef {import("../local-db/service-db.js").ServiceRecord} ServiceRecord
 * @typedef {import("../local-db/mileage-db.js").MileageHistoryRecord} MileageHistoryRecord
 * @typedef {import("../local-db/fuel-db.js").FuelRecord} FuelRecord
 */

/**
 * Main state of the application
 * @typedef {object} AppState
 * @property {boolean} onboarding Forces the vehicle form open and blocks dismissal until a first vehicle exists
 * @property {boolean} editingItem
 * @property {boolean} showVehicleForm
 * @property {boolean} showMileageForm
 * @property {boolean} showMileageHistory
 * @property {boolean} showItemForm
 * @property {boolean} showServiceForm
 * @property {boolean} showSearch
 * @property {boolean} showCostAnalytics
 * @property {boolean} showFuelForm
 * @property {boolean} showFuelHistory
 * @property {Views} currentView
 *
 * @typedef {'MaintenanceList'|'SingleItem'} Views
 *
 * @typedef {object} DataState
 * @property {Vehicle|null} currentVehicle
 * @property {MaintenanceItem|null} currentItem
 */

/**
 * Cached records from the db
 * @typedef {object} DBStore
 * @property {Vehicle[]} vehicles
 * @property {MaintenanceItem[]} maintenanceItems
 * @property {Record<string, ServiceRecord[]>} serviceHistory
 * @property {Record<string, MileageHistoryRecord[]>} mileageHistory
 * @property {Record<string, FuelRecord[]>} fuelHistory
 */

/**
 * Note: appState will be overwritten by initAppState
 * @type {AppState} State of which features are active
 */
const appState = {
    onboarding: false,
    editingItem: false,
    showVehicleForm: false,
    showMileageForm: false,
    showMileageHistory: false,
    showItemForm: false,
    showServiceForm: false,
    showSearch: false,
    showCostAnalytics: false,
    showFuelForm: false,
    showFuelHistory: false,
    currentView: 'MaintenanceList',
};

/**
 * State of data stored in memory
 * @type {DataState}
 */
const dataState = {
    currentVehicle: null,
    currentItem: null,
};

/**
 * Cached records from the db
 * @type {DBStore}
 */
const dbStore = {
    vehicles: [],
    maintenanceItems: [],
    /** Key is maintenance item ID, value is the service history array */
    serviceHistory: {},
    /** Key is vehicle ID, value is the mileage history array */
    mileageHistory: {},
    /** Key is vehicle ID, value is the fuel history array */
    fuelHistory: {},
};

const $app = $('app');

/**
 * @param {keyof AppState} field 
 * @param {*} value
 */
function setStateField(field, value) {
    // @ts-ignore // TODO: check this
    appState[field] = value;
    $app.dataset[field] = value;
}

/**
 * @param {Views} view 
 */
function setCurrentView(view) {
    appState.currentView = view;
    $app.dataset.currentView = view;
}

function initAppState() {
    setStateField('onboarding', false);
    setStateField('editingItem', false);
    setStateField('showVehicleForm', false);
    setStateField('showMileageForm', false);
    setStateField('showMileageHistory', false);
    setStateField('showItemForm', false);
    setStateField('showServiceForm', false);
    setStateField('showSearch', false);
    setStateField('showCostAnalytics', false);
    setStateField('showFuelForm', false);
    setStateField('showFuelHistory', false);
    setCurrentView('MaintenanceList');
}

export { appState, dataState, dbStore, initAppState, setStateField, setCurrentView };