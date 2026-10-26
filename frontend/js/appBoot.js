import { apiLogout, isLoggedIn } from "./api-caller/apiCaller.js";
import { setAuthStage, dataState, dbStore } from "./common/state.js";
import { clearArray, clearObj, eventBus } from "./lib/utils.js";
import { _error } from "./lib/logger.js";
import { fetchVehicles, resolveCurrentVehicle } from "./local-db/vehicle-db.js";
import { activateVehicle, openVehicleForm } from "./ui/vehicle-ui.js";
import { maybeImportLegacyData } from "./local-db/legacyImport.js";
import { showAlert } from "./ui/confirm-ui.js";


/**
 * Called on every app boot. Gates on whether a session token already exists
 * locally (no round trip - a stale/revoked token just fails the first real
 * API call with a 401, which apiCall() turns into a 'SessionExpired' event
 * that lands back on the login screen, see resetToLogin()).
 */
async function bootApp() {
  if (!isLoggedIn()) {
    setAuthStage('login');
    return;
  }
  await afterLogin();
}

/**
 * Runs right after a successful login/signup (and on every subsequent boot
 * while already logged in): offers the one-time legacy-data import, then
 * loads the account's vehicles same as the old local-first boot sequence did.
 */
async function afterLogin() {
  setAuthStage('ready');
  await maybeImportLegacyData();

  const result = await fetchVehicles();
  if (result.status === 401) { return; } // already back on the login screen
  if (result.errorMsg) {
    await showAlert('No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.');
    return;
  }

  const currentVehicle = resolveCurrentVehicle(result.data || []);
  if (!currentVehicle) {
    openVehicleForm(true);
  } else {
    await activateVehicle(currentVehicle);
  }
}

async function logout() {
  await apiLogout();
  resetToLogin();
}

/** Clears all in-memory account data and shows the login screen. */
function resetToLogin() {
  dataState.currentVehicle = null;
  dataState.currentItem = null;
  clearArray(dbStore.vehicles);
  clearArray(dbStore.maintenanceItems);
  clearObj(dbStore.serviceHistory);
  clearObj(dbStore.mileageHistory);
  clearObj(dbStore.fuelHistory);
  localStorage.removeItem('lastUsedVehicleKey');

  setAuthStage('login');
}

eventBus.on('SessionExpired', resetToLogin);


export { bootApp, afterLogin, logout };
