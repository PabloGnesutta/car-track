/**
 * @typedef {object} CostEntry
 * @property {string} itemName
 * @property {number} cost
 * @property {Date} date
 */

/**
 * @typedef {object} CostBreakdown
 * @property {number} total
 * @property {Array<{name: string, total: number}>} byItem - sorted highest spend first
 * @property {Array<{month: string, total: number}>} byMonth - "YYYY-MM", sorted chronologically
 */

/**
 * Aggregates raw cost entries (one per service record with a recorded cost)
 * into a total, a per-item breakdown, and a per-month trend. Entries with no
 * cost recorded (undefined/null/0) are skipped — cost tracking is optional
 * per service, so most history may have nothing to aggregate.
 * @param {CostEntry[]} entries
 * @returns {CostBreakdown}
 */
function computeCostBreakdown(entries) {
  let total = 0;
  /** @type {Map<string, number>} */
  const byItemMap = new Map();
  /** @type {Map<string, number>} */
  const byMonthMap = new Map();

  for (const entry of entries) {
    const cost = entry.cost;
    if (!cost || cost <= 0) { continue; }

    total += cost;
    byItemMap.set(entry.itemName, (byItemMap.get(entry.itemName) || 0) + cost);

    const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
    byMonthMap.set(monthKey, (byMonthMap.get(monthKey) || 0) + cost);
  }

  const byItem = [...byItemMap.entries()]
    .map(([name, itemTotal]) => ({ name, total: itemTotal }))
    .sort((a, b) => b.total - a.total);

  const byMonth = [...byMonthMap.entries()]
    .map(([month, monthTotal]) => ({ month, total: monthTotal }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { total, byItem, byMonth };
}

/**
 * Spanish "Month YYYY" label for a "YYYY-MM" key, e.g. "2026-03" -> "marzo 2026".
 * @param {string} monthKey
 * @returns {string}
 */
function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}


export { computeCostBreakdown, formatMonthLabel };
