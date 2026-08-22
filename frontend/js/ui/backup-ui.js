import { $, $button, $new, $newInput } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { toYYYYMMDD } from "../lib/date.js";
import { svg_download, svg_upload } from "../svg/svgFn.js";
import { exportAllData, restoreAllData } from "../local-db/backup-db.js";
import { showAlert, showConfirm } from "./confirm-ui.js";


/** @type {HTMLInputElement} */
let fileInput;

/**
 * Adds "Exportar"/"Importar" header-menu items for full-database JSON
 * backup/restore.
 */
function initBackupUi() {
  $button({
    class: 'horizontal export-btn',
    label: 'Exportar datos',
    svgFn: svg_download,
    appendTo: $('exportDataBtn'),
    listener: { fn: downloadBackup },
  });

  fileInput = $newInput({ type: 'file', accept: '.json,application/json', class: 'display-none' });
  fileInput.addEventListener('change', handleFileSelected);
  document.body.append(fileInput);

  $button({
    class: 'horizontal import-btn',
    label: 'Importar datos',
    svgFn: svg_upload,
    appendTo: $('importDataBtn'),
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

  const confirmed = await showConfirm('Esto va a reemplazar todos los datos actuales por los del archivo importado. ¿Continuar?', { danger: true });
  if (!confirmed) { return; }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await restoreAllData(data);
    if (!result.data) {
      await showAlert(result.errorMsg);
      return;
    }
    await showAlert('Datos importados correctamente. La página se va a recargar.');
    window.location.reload();
  } catch (err) {
    _error('Error importando backup', err);
    await showAlert('No se pudo leer el archivo. Verificá que sea un backup válido de CarTrack.');
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
