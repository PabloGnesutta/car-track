import { $button, $new, $newInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { toYYYYMMDD } from "../lib/date.js";
import { exportAllData, restoreAllData } from "../local-db/backup-db.js";


/** @type {HTMLInputElement} */
let fileInput;

/**
 * Adds "Exportar"/"Importar" buttons to the given container (the app footer)
 * for full-database JSON backup/restore.
 * @param {HTMLElement} container
 */
function initBackupUi(container) {
  $button({
    label: 'Exportar datos',
    appendTo: container,
    listener: { fn: downloadBackup },
  });

  fileInput = $newInput({ type: 'file', accept: '.json,application/json', class: 'display-none' });
  fileInput.addEventListener('change', handleFileSelected);
  document.body.append(fileInput);

  $button({
    label: 'Importar datos',
    appendTo: container,
    listener: { fn: () => fileInput.click() },
  });
}

async function downloadBackup() {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `cartrack-backup-${toYYYYMMDD(new Date())}.json`);
}

/**
 * @param {Event} e
 */
async function handleFileSelected(e) {
  const target = /** @type {HTMLInputElement} */ (e.target);
  const file = target.files?.[0];
  target.value = '';
  if (!file) { return; }

  if (!confirm('Esto va a reemplazar todos los datos actuales por los del archivo importado. ¿Continuar?')) { return; }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await restoreAllData(data);
    if (!result.data) {
      alert(result.errorMsg);
      return;
    }
    alert('Datos importados correctamente. La página se va a recargar.');
    window.location.reload();
  } catch (err) {
    _error('Error importando backup', err);
    alert('No se pudo leer el archivo. Verificá que sea un backup válido de CarTrack.');
  }
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = $new({ tag: 'a' });
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


export { initBackupUi };
