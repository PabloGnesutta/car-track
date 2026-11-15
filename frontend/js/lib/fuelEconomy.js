/**
 * @typedef {object} FuelEntry
 * @property {number} mileage
 * @property {number} liters
 * @property {Date} date
 */

/**
 * @typedef {FuelEntry & {
 *   distance: number|null,
 *   kmPerLiter: number|null,
 * }} FuelEfficiencyPoint
 * distance - km since the previous fill-up; null for the first entry (no prior reference)
 * kmPerLiter - null when distance is null or zero (or liters is zero)
 */

/**
 * Computes km/L between each consecutive fill-up, assuming every entry
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
    const kmPerLiter = (distance !== null && distance > 0 && entry.liters > 0) ? distance / entry.liters : null;
    points.push({ ...entry, distance, kmPerLiter });
    previousMileage = entry.mileage;
  }

  return points;
}

/**
 * Overall average km/L across all computable points (the first fill-up
 * never counts — there's no prior reading to measure distance from).
 * Total distance / total liters, not a plain mean of per-fill-up values.
 * @param {FuelEfficiencyPoint[]} points
 * @returns {number|null}
 */
function averageKmPerLiter(points) {
  const valid = points.filter(p => p.kmPerLiter !== null);
  const totalLiters = valid.reduce((sum, p) => sum + p.liters, 0);
  const totalDistance = valid.reduce((sum, p) => sum + /** @type {number} */(p.distance), 0);
  return totalLiters > 0 ? totalDistance / totalLiters : null;
}

/**
 * Overall average fuel cost per km. Under the full-tank assumption, a
 * fill-up's cost pays for the distance driven since the previous fill-up,
 * so only points with both a computable distance and a recorded cost count
 * (cost is optional — skipping cost-less points keeps them from diluting
 * the average with "free" kilometers).
 * @param {(FuelEfficiencyPoint & { cost?: number|null })[]} points
 * @returns {number|null}
 */
function averageCostPerKm(points) {
  const valid = points.filter(p => p.distance !== null && p.distance > 0 && typeof p.cost === 'number' && p.cost > 0);
  const totalCost = valid.reduce((sum, p) => sum + /** @type {number} */(p.cost), 0);
  const totalDistance = valid.reduce((sum, p) => sum + /** @type {number} */(p.distance), 0);
  return totalDistance > 0 ? totalCost / totalDistance : null;
}


export { computeFuelEfficiency, averageKmPerLiter, averageCostPerKm };
