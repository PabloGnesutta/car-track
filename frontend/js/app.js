import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { dbugBtns, initUi } from "./ui/ui.js";
import { initAppState } from "./common/state.js";
import { eventBus } from "./lib/utils.js";
import { $ } from "./lib/dom.js";
import { fetchVehicles, resolveCurrentVehicle } from "./local-db/vehicle-db.js";
import { activateVehicle, openVehicleForm } from "./ui/vehicle-ui.js";
import { seedDb } from "./local-db/seed.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();

/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async ({ version }) => {
    // await seedDb();
    // return;
    _info(' (!) DB Callback');
    $('cacheMajorVersion').innerText = localStorage.getItem('cacheMajorVersion') || '';
    $('indexedDbVersion').innerText = version;

    const vehicles = await fetchVehicles();
    const currentVehicle = resolveCurrentVehicle(vehicles);

    if (!currentVehicle) {
        openVehicleForm(true);
    } else {
        await activateVehicle(currentVehicle);
    }
});

initAppState();
initUi();
dbugBtns();
