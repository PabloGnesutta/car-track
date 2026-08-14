import { $, $button, $getInner, $queryOne } from "../lib/dom.js";
import { haptic } from "../lib/haptics.js";


const dialog = $('confirmDialog');
const messageEl = $getInner(dialog, '.confirm-message');
const backdrop = $getInner(dialog, '.backdrop');

$button({ label: 'Cancelar', appendTo: $queryOne('#confirmDialog .confirm-cancel'), listener: { fn: () => close(false) } });
$button({ label: 'Confirmar', appendTo: $queryOne('#confirmDialog .confirm-ok'), listener: { fn: () => { haptic(); close(true); } } });

const cancelBtnEl = $queryOne('#confirmDialog .confirm-cancel');
const okBtnEl = $queryOne('#confirmDialog .confirm-ok');
const cancelBtnLabel = $getInner(cancelBtnEl, '.label');
const okBtnLabel = $getInner(okBtnEl, '.label');

backdrop.addEventListener('click', () => close(false));

/** @type {((result: boolean) => void) | null} */
let activeResolve = null;

/**
 * @param {boolean} result
 */
function close(result) {
  dialog.classList.remove('show');
  if (activeResolve) {
    const resolve = activeResolve;
    activeResolve = null;
    resolve(result);
  }
}

/**
 * @param {string} message
 * @param {{okLabel?: string, cancelLabel?: string|null, danger?: boolean}} [opts]
 * @returns {Promise<boolean>}
 */
function open(message, { okLabel = 'Aceptar', cancelLabel = null, danger = false } = {}) {
  messageEl.innerText = message;
  okBtnLabel.innerText = okLabel;
  okBtnEl.classList.toggle('danger', danger);

  if (cancelLabel) {
    cancelBtnEl.classList.remove('display-none');
    cancelBtnLabel.innerText = cancelLabel;
  } else {
    cancelBtnEl.classList.add('display-none');
  }

  dialog.classList.add('show');
  return new Promise(resolve => { activeResolve = resolve; });
}

/**
 * Custom, app-themed replacement for the native `confirm()`. Resolves
 * `true` if the user confirms, `false` if they cancel or dismiss.
 * @param {string} message
 * @param {{danger?: boolean}} [opts] - `danger: true` styles the confirm button red (destructive actions).
 * @returns {Promise<boolean>}
 */
function showConfirm(message, opts = {}) {
  return open(message, { okLabel: 'Confirmar', cancelLabel: 'Cancelar', danger: opts.danger });
}

/**
 * Custom, app-themed replacement for the native `alert()`.
 * @param {string} message
 * @returns {Promise<void>}
 */
async function showAlert(message) {
  await open(message, { okLabel: 'Aceptar' });
}


export { showConfirm, showAlert };
