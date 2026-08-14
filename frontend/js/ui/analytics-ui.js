import { $, $new, $queryOne } from "../lib/dom.js";
import { dataState, dbStore, setStateField } from "../common/state.js";
import { getServiceHistory } from "../local-db/service-db.js";
import { computeCostBreakdown, formatMonthLabel } from "../lib/costAnalytics.js";


const totalEl = $queryOne('#costAnalyticsModal .cost-total .value');
const emptyEl = $queryOne('#costAnalyticsModal .cost-empty');
const byItemContainer = $queryOne('#costAnalyticsModal .cost-by-item');
const byMonthContainer = $queryOne('#costAnalyticsModal .cost-by-month');

/**
 * Fetches every service record for the current vehicle's maintenance items,
 * aggregates costs, and opens the cost analytics modal.
 */
async function openCostAnalytics() {
  const vehicle = dataState.currentVehicle;
  if (!vehicle) { return; }

  /** @type {import("../lib/costAnalytics.js").CostEntry[]} */
  const entries = [];
  for (const item of dbStore.maintenanceItems) {
    if (item._key == null) { continue; }
    const history = await getServiceHistory(item._key);
    for (const record of history) {
      if (record.cost) { entries.push({ itemName: item.name, cost: record.cost, date: record.date }); }
    }
  }

  renderBreakdown(computeCostBreakdown(entries));
  setStateField('showCostAnalytics', true);
}

/**
 * @param {import("../lib/costAnalytics.js").CostBreakdown} breakdown
 */
function renderBreakdown(breakdown) {
  totalEl.innerText = formatMoney(breakdown.total);

  if (!breakdown.byItem.length) {
    emptyEl.classList.remove('display-none');
  } else {
    emptyEl.classList.add('display-none');
  }

  byItemContainer.innerHTML = '';
  breakdown.byItem.forEach(({ name, total }) => {
    byItemContainer.append($new({
      class: 'cost-row',
      children: [
        $new({ class: 'cost-row-label', text: name }),
        $new({ class: 'cost-row-value', text: formatMoney(total) }),
      ],
    }));
  });

  byMonthContainer.innerHTML = '';
  breakdown.byMonth.slice().reverse().forEach(({ month, total }) => {
    byMonthContainer.append($new({
      class: 'cost-row',
      children: [
        $new({ class: 'cost-row-label', text: formatMonthLabel(month) }),
        $new({ class: 'cost-row-value', text: formatMoney(total) }),
      ],
    }));
  });
}

/**
 * @param {number} amount
 * @returns {string}
 */
function formatMoney(amount) {
  return `$${amount.toLocaleString('es', { maximumFractionDigits: 2 })}`;
}


export { openCostAnalytics };
