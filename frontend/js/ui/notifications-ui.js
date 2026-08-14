import { $button, $new } from "../lib/dom.js";
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
 * Adds a bell icon-button to the given container (the app footer) that
 * requests Notification permission. A colored dot reflects the current
 * permission state (green = granted, red = blocked); the bell itself swaps
 * to a slashed variant when blocked, so the state isn't color-only. No-op
 * (button not shown) where the Notification/serviceWorker APIs aren't supported.
 * @param {HTMLElement} container
 */
function initNotificationsUi(container) {
  if (!notificationsSupported()) { return; }

  $button({
    class: 'icon-btn notifications-toggle-btn',
    svgFn: svg_bell,
    appendTo: container,
    listener: { fn: handleClick },
  });

  btnEl = container.querySelector('.notifications-toggle-btn');
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
