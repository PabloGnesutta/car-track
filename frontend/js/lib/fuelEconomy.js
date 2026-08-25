/**
 * @typedef {object} FuelEntry
 * @property {number} mileage
 * @property {number} liters
 * @property {Date} date
 */

/**
 * @typedef {FuelEntry & {
 *   distance: number|null,
 *   litersPer100Km: number|null,
 * }} FuelEfficiencyPoint
 * distance - km since the previous fill-up; null for the first entry (no prior reference)
 * litersPer100Km - null when distance is null or zero
 */

/**
 * Computes L/100km between each consecutive fill-up, assuming every entry
 * is a full-tank fill-up (see fuel-db.js's FuelRecord doc for why). Entries
 * must be sorted oldest-first by mileage. Every other field on the input
 * entry (cost, notes, _key, ...) passes through onto the point unchanged,
 * so callers can render/act on it without a second lookup.
 * @param {FuelEntry[]} entriesOldestFirst
 * @returns {FuelEfficiencyPoint[]}
 */
function computeFuelEfficiency(entriesOldestFirst) {
  /** @type {FuelEfficiencyPoint[]} */
  const points = [];
  /** @type {number|null} */
  let previousMileage = null;

  for (const entry of entriesOldestFirst) {
    const distance = previousMileage !== null ? entry.mileage - previousMileage : null;
    const litersPer100Km = (distance !== null && distance > 0) ? (entry.liters / distance) * 100 : null;
    points.push({ ...entry, distance, litersPer100Km });
    previousMileage = entry.mileage;
  }

  return points;
}

/**
 * Overall average L/100km across all computable points (the first fill-up
 * never counts — there's no prior reading to measure distance from).
 * @param {FuelEfficiencyPoint[]} points
 * @returns {number|null}
 */
function averageFuelEfficiency(points) {
  const valid = points.filter(p => p.litersPer100Km !== null);
  const totalLiters = valid.reduce((sum, p) => sum + p.liters, 0);
  const totalDistance = valid.reduce((sum, p) => sum + /** @type {number} */(p.distance), 0);
  return totalDistance > 0 ? (totalLiters / totalDistance) * 100 : null;
}


export { computeFuelEfficiency, averageFuelEfficiency };
