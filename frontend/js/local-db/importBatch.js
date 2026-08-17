import { apiCall } from "../api-caller/apiCaller.js";


/**
 * @typedef {object} ImportBatch
 * @property {any[]} vehicles
 * @property {any[]} maintenanceItems
 * @property {any[]} serviceHistory
 * @property {any[]} mileageHistory
 * @property {any[]} fuelHistory
 */

/**
 * Uploads a batch of vehicles/items/history in the old locally-keyed shape
 * (as read from IndexedDB or a parsed backup file - both carry `_key` on
 * each record and `vehicleKey`/`itemKey` foreign-key references, with Date
 * instances for date fields) to the backend, in dependency order: vehicles
 * first, then maintenance items, then service/mileage/fuel history. Builds
 * an old-key -> new-server-id map and rewrites child foreign keys before
 * posting them, since the server assigns its own ids.
 *
 * Best-effort: skips (rather than aborting) a child record if its parent
 * failed to import, and returns a summary rather than throwing. This is a
 * one-time convenience for pre-existing local data, not a guaranteed
 * lossless migration.
 * @param {ImportBatch} batch
 * @returns {Promise<{vehicles: number, maintenanceItems: number, serviceHistory: number, mileageHistory: number, fuelHistory: number}>}
 */
async function importBatch({ vehicles, maintenanceItems, serviceHistory, mileageHistory, fuelHistory }) {
  const vehicleIdMap = new Map();
  const itemIdMap = new Map();
  const counts = { vehicles: 0, maintenanceItems: 0, serviceHistory: 0, mileageHistory: 0, fuelHistory: 0 };

  for (const vehicle of vehicles) {
    const created = await apiCall('vehicles/create', {
      name: vehicle.name,
      initialMileage: vehicle.initialMileage,
      date: (vehicle.createdAt || vehicle.currentMileageDate).getTime(),
    });
    if (!created.data) { continue; }
    vehicleIdMap.set(vehicle._key, created.data.id);
    counts.vehicles++;

    // Replay this vehicle's mileage history (oldest first) so current
    // mileage ends up correct - skip entries at the initial mileage, since
    // vehicles/create already recorded that one itself.
    const ownHistory = mileageHistory
      .filter(m => m.vehicleKey === vehicle._key && m.mileage > vehicle.initialMileage)
      .sort((a, b) => a.mileage - b.mileage);
    for (const record of ownHistory) {
      const logged = await apiCall('vehicles/logMileage', {
        vehicleId: created.data.id,
        mileage: record.mileage,
        date: record.date.getTime(),
        notes: record.notes || '',
      });
      if (logged.data) { counts.mileageHistory++; }
    }
  }

  for (const item of maintenanceItems) {
    const newVehicleId = vehicleIdMap.get(item.vehicleKey);
    if (newVehicleId == null) { continue; }

    const created = await apiCall('maintenanceItems/create', {
      vehicleId: newVehicleId,
      name: item.name,
      normalizedName: item.normalizedName,
      intervalKm: item.intervalKm,
      intervalDays: item.intervalDays,
      lastServiceMileage: item.lastServiceMileage,
      lastServiceDate: item.lastServiceDate ? item.lastServiceDate.getTime() : null,
      notes: item.notes || '',
    });
    if (!created.data) { continue; }
    itemIdMap.set(item._key, created.data.id);
    counts.maintenanceItems++;
  }

  for (const [oldItemKey, newItemId] of itemIdMap) {
    // Oldest first, so the last markServiced call leaves the item's
    // last-service fields matching its newest record (same as before import).
    const ownHistory = serviceHistory
      .filter(s => s.itemKey === oldItemKey)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const record of ownHistory) {
      const marked = await apiCall('serviceHistory/markServiced', {
        itemId: newItemId,
        mileage: record.mileage,
        date: record.date.getTime(),
        notes: record.notes || '',
        cost: record.cost ?? null,
      });
      if (marked.data) { counts.serviceHistory++; }
    }
  }

  for (const record of fuelHistory) {
    const newVehicleId = vehicleIdMap.get(record.vehicleKey);
    if (newVehicleId == null) { continue; }
    const created = await apiCall('fuelHistory/create', {
      vehicleId: newVehicleId,
      mileage: record.mileage,
      liters: record.liters,
      date: record.date.getTime(),
      cost: record.cost ?? null,
      notes: record.notes || '',
    });
    if (created.data) { counts.fuelHistory++; }
  }

  return counts;
}


export { importBatch };
