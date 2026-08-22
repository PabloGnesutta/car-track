import { $, $button, $new } from "../lib/dom.js";
import { svg_bell, svg_bell_off } from "../svg/svgFn.js";
import { getNotificationPermission, notificationsSupported, requestNotificationPermission } from "../lib/notifications.js";
import { renderVehicleChips } from "./vehicle-ui.js";
import { showAlert } from "./confirm-ui.js";


/** @type {HTMLElement|null} */
let btnEl = null;
/** @type {HTMLElement|null} */
let iconEl = null;

/** @type {Record<string, string>} */
const LABELS = {
  granted: 'Notificaciones activadas',
  denied: 'Notificaciones bloqueadas',
  default: 'Activar notificaciones',
};

/**
 * Adds a bell header-menu item that requests Notification permission. A
 * colored dot reflects the current permission state (green = granted, red =
 * blocked); the bell itself swaps to a slashed variant when blocked, and the
 * label text mirrors the state too, so it isn't color-only. No-op (item not
 * shown) where the Notification/serviceWorker APIs aren't supported.
 */
function initNotificationsUi() {
  if (!notificationsSupported()) { return; }

  $button({
    class: 'horizontal notifications-toggle-btn',
    label: LABELS.default,
    svgFn: svg_bell,
    appendTo: $('notificationsToggleBtn'),
    listener: { fn: handleClick },
  });

  btnEl = $('notificationsToggleBtn').querySelector('.notifications-toggle-btn');
  iconEl = btnEl.querySelector('.icon');
  iconEl.append($new({ class: 'dot' }));
  refreshState();
}

function refreshState() {
  if (!btnEl || !iconEl) { return; }
  const permission = getNotificationPermission();
  const label = LABELS[permission] || LABELS.default;

  btnEl.dataset.permission = permission;
  btnEl.setAttribute('aria-label', label);
  btnEl.title = label;
  const labelEl = btnEl.querySelector('.label');
  if (labelEl) { labelEl.innerText = label; }

  const dot = iconEl.querySelector('.dot');
  iconEl.innerHTML = permission === 'denied' ? svg_bell_off() : svg_bell();
  iconEl.append(dot);
}

async function handleClick() {
  const permission = getNotificationPermission();
  if (permission === 'granted') { return; }

  if (permission === 'denied') {
    await showAlert('Las notificaciones están bloqueadas para este sitio. Para activarlas, habilitalas desde la configuración del navegador.');
    return;
  }

  const result = await requestNotificationPermission();
  refreshState();
  if (result === 'granted') {
    await renderVehicleChips();
  }
}


export { initNotificationsUi };
