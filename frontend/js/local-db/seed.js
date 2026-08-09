import { createVehicle } from "./vehicle-db.js";
import { createMaintenanceItem } from "./maintenance-db.js";
import { markItemServiced } from "./service-db.js";


/**
 * Dev helper: seeds a vehicle with a couple of maintenance items
 * (one overdue, one ok) so the list has something to look at.
 */
async function seedDb() {
    const today = new Date();
    const monthsAgo = n => new Date(today.getFullYear(), today.getMonth() - n, today.getDate());

    const { data: vehicle } = await createVehicle('Auto de prueba', 40000, monthsAgo(6));
    if (!vehicle) { return; }

    const { data: oilChange } = await createMaintenanceItem(vehicle._key || '', 'Cambio de aceite', {
        intervalKm: 10000,
        intervalDays: 180,
        lastServiceMileage: 28000,
        lastServiceDate: monthsAgo(7),
    });
    if (oilChange) {
        await markItemServiced(oilChange, 28000, monthsAgo(7));
    }

    await createMaintenanceItem(vehicle._key || '', 'Rotación de neumáticos', {
        intervalKm: 10000,
        lastServiceMileage: 38000,
        lastServiceDate: monthsAgo(1),
    });
}


export { seedDb };
