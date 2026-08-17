import { $, $getInner, fold, unfold } from "./dom.js";


const toastEl = $('undoToast');
const messageEl = $getInner(toastEl, '.message');
const undoBtn = $getInner(toastEl, '.undo-btn');

/** @type {ReturnType<typeof setTimeout>|undefined} */
let hideTimeout;
/** @type {(() => void)|null} */
let currentHandler = null;

/**
 * Shows a toast with an "undo" action for a few seconds. Calling this again
 * before the previous toast's window elapses supersedes it (the previous
 * action stays committed, matching how most undo-toasts behave).
 * @param {string} message
 * @param {() => void} onUndo
 * @param {{durationMs?: number, onExpire?: () => void}} [options] - `onExpire`
 *   fires once the window elapses without an undo click - used to defer an
 *   actual persistence call (e.g. an API delete) until the undo window is
 *   truly gone, so undo itself never needs to touch the network.
 */
function showUndoToast(message, onUndo, { durationMs = 5000, onExpire } = {}) {
  clearTimeout(hideTimeout);
  if (currentHandler) {
    undoBtn.removeEventListener('click', currentHandler);
  }

  messageEl.innerText = message;
  unfold(toastEl);

  currentHandler = () => {
    clearTimeout(hideTimeout);
    undoBtn.removeEventListener('click', /** @type {() => void} */(currentHandler));
    currentHandler = null;
    fold(toastEl);
    onUndo();
  };
  undoBtn.addEventListener('click', currentHandler);

  hideTimeout = setTimeout(() => {
    undoBtn.removeEventListener('click', /** @type {() => void} */(currentHandler));
    currentHandler = null;
    fold(toastEl);
    onExpire?.();
  }, durationMs);
}


export { showUndoToast };
