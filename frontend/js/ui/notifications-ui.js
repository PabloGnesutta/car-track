import { $button } from "../lib/dom.js";
import { getNotificationPermission, notificationsSupported, requestNotificationPermission } from "../lib/notifications.js";
import { renderVehicleChips } from "./vehicle-ui.js";


/** @type {HTMLElement|null} */
let labelEl = null;

/**
 * Adds a "Notificaciones" toggle button to the given container (the app
 * footer) that requests Notification permission. No-op (button not shown)
 * where the Notification/serviceWorker APIs aren't supported.
 * @param {HTMLElement} container
 */
function initNotificationsUi(container) {
  if (!notificationsSupported()) { return; }

  $button({
    label: 'Activar notificaciones',
    class: 'notifications-toggle-btn',
    appendTo: container,
    listener: { fn: handleClick },
  });

  labelEl = container.querySelector('.notifications-toggle-btn .label');
  refreshLabel();
}

function refreshLabel() {
  if (!labelEl) { return; }
  const permission = getNotificationPermission();
  if (permission === 'granted') {
    labelEl.innerText = 'Notificaciones activadas';
  } else if (permission === 'denied') {
    labelEl.innerText = 'Notificaciones bloqueadas';
  } else {
    labelEl.innerText = 'Activar notificaciones';
  }
}

async function handleClick() {
  const permission = getNotificationPermission();
  if (permission === 'granted') { return; }

  if (permission === 'denied') {
    alert('Las notificaciones están bloqueadas para este sitio. Para activarlas, habilitalas desde la configuración del navegador.');
    return;
  }

  const result = await requestNotificationPermission();
  refreshLabel();
  if (result === 'granted') {
    await renderVehicleChips();
  }
}


export { initNotificationsUi };
