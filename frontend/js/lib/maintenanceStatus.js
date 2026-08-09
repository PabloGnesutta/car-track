/**
 * @typedef {'ok'|'due-soon'|'overdue'} MaintenanceStatus
 * @typedef {{ status: MaintenanceStatus, kmRemaining: number|null, daysRemaining: number|null }} StatusResult
 */

const DUE_SOON_KM = 500;
const DUE_SOON_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Computes whether a maintenance item is due, based on the vehicle's current
 * mileage/date vs. the item's interval since it was last serviced.
 * Due when EITHER the km interval or the day interval has elapsed.
 * @param {import("../local-db/maintenance-db.js").MaintenanceItem} item
 * @param {number} currentMileage
 * @param {Date} [currentDate]
 * @returns {StatusResult}
 */
function computeStatus(item, currentMileage, currentDate = new Date()) {
  const kmRemaining = (item.intervalKm != null && item.lastServiceMileage != null)
    ? (item.lastServiceMileage + item.intervalKm) - currentMileage
    : null;

  const daysRemaining = (item.intervalDays != null && item.lastServiceDate)
    ? daysBetween(currentDate, addDays(item.lastServiceDate, item.intervalDays))
    : null;

  const overdue = (kmRemaining !== null && kmRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0);
  const dueSoon = !overdue && (
    (kmRemaining !== null && kmRemaining <= DUE_SOON_KM) ||
    (daysRemaining !== null && daysRemaining <= DUE_SOON_DAYS)
  );

  return {
    status: overdue ? 'overdue' : (dueSoon ? 'due-soon' : 'ok'),
    kmRemaining,
    daysRemaining,
  };
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Whole calendar days between two dates (ignores time-of-day, so the result
 * doesn't drift depending on what time "now" happens to be).
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight.getTime() - fromMidnight.getTime()) / MS_PER_DAY);
}

/**
 * Spanish label for the due-detail row, e.g. "en 2.300 km / en 12 días" or
 * "vencido hace 3 días".
 * @param {StatusResult} result
 * @returns {string}
 */
function formatDueDetail({ kmRemaining, daysRemaining }) {
  const parts = [];
  if (kmRemaining !== null) {
    parts.push(kmRemaining >= 0 ? `en ${formatKm(kmRemaining)} km` : `vencido hace ${formatKm(-kmRemaining)} km`);
  }
  if (daysRemaining !== null) {
    parts.push(daysRemaining >= 0 ? `en ${daysRemaining} días` : `vencido hace ${-daysRemaining} días`);
  }
  return parts.join(' / ') || 'Sin datos';
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatKm(n) {
  return Math.round(n).toLocaleString('es');
}

export { computeStatus, formatDueDetail };
