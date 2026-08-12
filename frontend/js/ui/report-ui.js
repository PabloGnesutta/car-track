import { dataState, dbStore } from "../common/state.js";
import { getServiceHistory } from "../local-db/service-db.js";
import { getMileageHistory } from "../local-db/mileage-db.js";
import { computeStatus, STATUS_LABELS } from "../lib/maintenanceStatus.js";
import { formatDateEs, toYYYYMMDD } from "../lib/date.js";
import { _error } from "../lib/logger.js";


/**
 * @typedef {import("../local-db/vehicle-db.js").Vehicle} Vehicle
 * @typedef {import("../local-db/maintenance-db.js").MaintenanceItem} MaintenanceItem
 * @typedef {import("../local-db/service-db.js").ServiceRecord} ServiceRecord
 * @typedef {import("../local-db/mileage-db.js").MileageHistoryRecord} MileageHistoryRecord
 */

/**
 * Builds a standalone, printable HTML report of the current vehicle's full
 * maintenance/service/mileage history and shares or opens it. Useful e.g.
 * when selling the car and wanting to hand over proof of upkeep.
 */
async function shareVehicleReport() {
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  const items = dbStore.maintenanceItems;

  /** @type {Record<string, ServiceRecord[]>} */
  const historyByItem = {};
  for (const item of items) {
    if (item._key == null) { continue; }
    historyByItem[item._key.toString()] = await getServiceHistory(item._key);
  }
  const mileageHistory = vehicle._key != null ? await getMileageHistory(vehicle._key) : [];

  const html = buildReportHtml(vehicle, items, historyByItem, mileageHistory);
  const filename = `cartrack-${slugify(vehicle.name)}-${toYYYYMMDD(new Date())}.html`;

  await shareOrOpenHtml(html, filename, vehicle.name);
}

/**
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  const slug = name.trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'vehiculo';
}

/**
 * Shares the report as a file via the Web Share API when available
 * (typically mobile — opens the native share sheet), otherwise opens it in
 * a new tab so it can be read, printed, or saved from there.
 * @param {string} html
 * @param {string} filename
 * @param {string} vehicleName
 */
async function shareOrOpenHtml(html, filename, vehicleName) {
  const blob = new Blob([html], { type: 'text/html' });

  try {
    const file = new File([blob], filename, { type: 'text/html' });
    // @ts-ignore - File Web Share isn't in the standard lib.dom types yet
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // @ts-ignore
      await navigator.share({
        files: [file],
        title: `Historial de ${vehicleName}`,
        text: `Historial de mantenimiento de ${vehicleName}`,
      });
      return;
    }
  } catch (e) {
    // @ts-ignore
    if (e && e.name === 'AbortError') { return; }
    _error('Error compartiendo el reporte', e);
  }

  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {Vehicle} vehicle
 * @param {MaintenanceItem[]} items
 * @param {Record<string, ServiceRecord[]>} historyByItem
 * @param {MileageHistoryRecord[]} mileageHistory
 * @returns {string}
 */
function buildReportHtml(vehicle, items, historyByItem, mileageHistory) {
  const itemRows = items.map(item => {
    const { status } = computeStatus(item, vehicle.currentMileage, vehicle.currentMileageDate);
    const interval = [
      item.intervalKm ? `${item.intervalKm.toLocaleString('es')} km` : null,
      item.intervalDays ? `${item.intervalDays} días` : null,
    ].filter(Boolean).join(' / ') || '—';

    return `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td><span class="status status-${status}">${STATUS_LABELS[status]}</span></td>
      <td>${interval}</td>
      <td>${item.lastServiceMileage.toLocaleString('es')} km — ${formatDateEs(item.lastServiceDate)}</td>
      <td>${escapeHtml(item.notes || '')}</td>
    </tr>`;
  }).join('');

  const serviceSections = items.map(item => {
    const key = (item._key ?? '').toString();
    const history = historyByItem[key] || [];
    if (!history.length) { return ''; }

    const rows = history.map(record => `<tr>
      <td>${formatDateEs(record.date)}</td>
      <td>${record.mileage.toLocaleString('es')} km</td>
      <td>${escapeHtml(record.notes || '')}</td>
    </tr>`).join('');

    return `<h3>${escapeHtml(item.name)}</h3>
    <table><thead><tr><th>Fecha</th><th>Km</th><th>Notas</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');

  const mileageRows = mileageHistory.map(record => `<tr>
    <td>${formatDateEs(record.date)}</td>
    <td>${record.mileage.toLocaleString('es')} km</td>
    <td>${record.distance >= 0 ? '+' : ''}${record.distance.toLocaleString('es')} km</td>
    <td>${escapeHtml(record.notes || '')}</td>
  </tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Historial de ${escapeHtml(vehicle.name)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(vehicle.name)}</h1>
    <p>Kilometraje actual: <strong>${vehicle.currentMileage.toLocaleString('es')} km</strong> · Generado el ${formatDateEs(new Date())}</p>
  </header>

  <section>
    <h2>Ítems de mantenimiento</h2>
    ${items.length
      ? `<table><thead><tr><th>Ítem</th><th>Estado</th><th>Intervalo</th><th>Último realizado</th><th>Notas</th></tr></thead><tbody>${itemRows}</tbody></table>`
      : '<p class="empty">Sin ítems de mantenimiento registrados.</p>'}
  </section>

  <section>
    <h2>Historial de servicios</h2>
    ${serviceSections || '<p class="empty">Sin servicios registrados.</p>'}
  </section>

  <section>
    <h2>Historial de kilometraje</h2>
    ${mileageHistory.length
      ? `<table><thead><tr><th>Fecha</th><th>Km</th><th>Distancia</th><th>Notas</th></tr></thead><tbody>${mileageRows}</tbody></table>`
      : '<p class="empty">Sin registros de kilometraje.</p>'}
  </section>

  <footer><p>Generado con CarTrack</p></footer>
</body>
</html>`;
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  /** @type {Record<string, string>} */
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, c => escapes[c]);
}

const REPORT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 2rem; color: #1a1a1a; background: #fff; max-width: 800px; margin-inline: auto; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { margin: 0 0 0.25rem; font-size: 28px; }
  h2 { font-size: 20px; margin: 2rem 0 0.75rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
  h3 { font-size: 16px; margin: 1.25rem 0 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 14px; }
  th { background: #f2f2f2; }
  .status { padding: 2px 8px; border-radius: 999px; font-size: 12px; color: #fff; white-space: nowrap; }
  .status-ok { background: #1c8a3f; }
  .status-due-soon { background: #b8860b; }
  .status-overdue { background: #b0132f; }
  .empty { color: #666; font-style: italic; }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ccc; color: #888; font-size: 12px; text-align: center; }
  @media print { body { padding: 0.5rem; } }
`;


export { shareVehicleReport };
