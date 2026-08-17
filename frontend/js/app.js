import { initializeCache } from "./initializeCache.js";
import { _info, _log } from "./lib/logger.js";
import { initializeIndexedDb } from "./lib/indexedDb.js";
import { dbugBtns, initUi } from "./ui/ui.js";
import { initAppState } from "./common/state.js";
import { eventBus } from "./lib/utils.js";
import { $ } from "./lib/dom.js";
import { bootApp } from "./appBoot.js";
import { initAuthUi } from "./ui/auth-ui.js";
import { seedDb } from "./local-db/seed.js";
import { initBackupUi } from "./ui/backup-ui.js";
import { initNotificationsUi } from "./ui/notifications-ui.js";
import { initVoiceMileageUi } from "./ui/voice-mileage-ui.js";


_info(' (!) App started');

initializeCache();

initializeIndexedDb();

/**
 * Hides the loading skeleton shown while IndexedDB initializes. Also
 * called by a safety-net timeout in case initialization never completes
 * (e.g. IndexedDB unavailable), so the app doesn't get stuck behind it.
 */
let skeletonHidden = false;
function hideLoadingSkeleton() {
    if (skeletonHidden) { return; }
    skeletonHidden = true;
    clearTimeout(skeletonSafetyTimeout);
    const skeleton = $('loadingSkeleton');
    if (!skeleton) { return; }
    skeleton.classList.add('hidden');
    setTimeout(() => skeleton.remove(), 300);
}
const skeletonSafetyTimeout = setTimeout(hideLoadingSkeleton, 8000);

/** Callback for Indexed DB initialization */
eventBus.on('IndexedDbInited', async ({ version }) => {
    // await seedDb();
    // return;
    _info(' (!) DB Callback');
    $('cacheMajorVersion').innerText = localStorage.getItem('cacheMajorVersion') || '';
    $('indexedDbVersion').innerText = version;

    await bootApp();

    hideLoadingSkeleton();
});

initAppState();
initUi();
dbugBtns();
initAuthUi($('mainFooter'));
initBackupUi($('mainFooter'));
initNotificationsUi($('mainFooter'));
initVoiceMileageUi();
