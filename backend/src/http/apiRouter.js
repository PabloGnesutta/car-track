import { db } from '../db/db.js';
import { readJsonBody, INVALID_JSON_MESSAGE } from './bodyParser.js';
import { errorResponse, successResponse } from './httpResponses.js';
import { createAuthService } from '../services/authService.js';
import { createVehicleService } from '../services/vehicleService.js';
import { createMaintenanceService } from '../services/maintenanceService.js';
import { createServiceHistoryService } from '../services/serviceHistoryService.js';
import { createMileageService } from '../services/mileageService.js';
import { createFuelService } from '../services/fuelService.js';
import { ServiceError } from '../services/ServiceError.js';
import { error } from '../logger/logger.js';


const authService = createAuthService(db);
const vehicleService = createVehicleService(db);
const maintenanceService = createMaintenanceService(db);
const serviceHistoryService = createServiceHistoryService(db);
const mileageService = createMileageService(db);
const fuelService = createFuelService(db);

/**
 * @param {import('./types').ApiRequest} req
 */
function getBearerUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const [, token] = authHeader.split(' ');
  return token ? authService.getUserBySessionToken(token) : null;
}

/**
 * Routes /api/* requests. All routes are POST-only, matching the frontend's
 * apiCaller.js, which always does `fetch('/api/' + path, {method: 'POST'})`.
 * @param {import('./types').ApiRequest} req
 * @param {import('./types').ApiResponse} res
 * @param {string[]} segments - path segments after 'api', e.g. ['vehicles','create']
 */
export async function handleApiRequest(req, res, segments) {
  const route = segments.join('/');
  try {
    const body = await readJsonBody(req);

    if (route === 'signup') {
      const user = authService.createUser(body.email, body.password, body.name);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }
    if (route === 'login') {
      const user = authService.verifyLogin(body.email, body.password);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }

    // Every route below requires a valid bearer token.
    const user = getBearerUser(req);
    if (!user) { return errorResponse(res, 'No autorizado', 401); }

    if (route === 'whoami') { return successResponse(res, user); }
    if (route === 'logout') {
      const [, token] = (req.headers['authorization'] || '').split(' ');
      authService.deleteSession(token);
      return successResponse(res, { ok: true });
    }

    if (route === 'vehicles/fetch') { return successResponse(res, vehicleService.listVehicles(user.id)); }
    if (route === 'vehicles/create') { return successResponse(res, vehicleService.createVehicle(user.id, body)); }
    if (route === 'vehicles/update') { return successResponse(res, vehicleService.updateVehicle(user.id, body.vehicleId, body)); }
    if (route === 'vehicles/delete') {
      vehicleService.deleteVehicle(user.id, body.vehicleId);
      return successResponse(res, { ok: true });
    }
    if (route === 'vehicles/logMileage') { return successResponse(res, vehicleService.logMileage(user.id, body.vehicleId, body)); }

    if (route === 'maintenanceItems/fetch') { return successResponse(res, maintenanceService.listForVehicle(user.id, body.vehicleId)); }
    if (route === 'maintenanceItems/fetchAllForStatus') { return successResponse(res, maintenanceService.listAllForStatus(user.id)); }
    if (route === 'maintenanceItems/create') { return successResponse(res, maintenanceService.createItem(user.id, body.vehicleId, body)); }
    if (route === 'maintenanceItems/update') { return successResponse(res, maintenanceService.updateItem(user.id, body.itemId, body)); }
    if (route === 'maintenanceItems/delete') {
      maintenanceService.deleteItem(user.id, body.itemId);
      return successResponse(res, { ok: true });
    }

    if (route === 'serviceHistory/fetch') { return successResponse(res, serviceHistoryService.listForItem(user.id, body.itemId)); }
    if (route === 'serviceHistory/markServiced') { return successResponse(res, serviceHistoryService.markServiced(user.id, body.itemId, body)); }
    if (route === 'serviceHistory/delete') { return successResponse(res, serviceHistoryService.deleteRecord(user.id, body.recordId)); }

    if (route === 'mileageHistory/fetch') { return successResponse(res, mileageService.listForVehicle(user.id, body.vehicleId)); }

    if (route === 'fuelHistory/fetch') { return successResponse(res, fuelService.listForVehicle(user.id, body.vehicleId)); }
    if (route === 'fuelHistory/create') { return successResponse(res, fuelService.createRecord(user.id, body.vehicleId, body)); }

    return errorResponse(res, 'Ruta de API no encontrada: ' + route, 404);
  } catch (err) {
    if (err instanceof ServiceError) { return errorResponse(res, err.message, 400); }
    if (err instanceof Error && err.message === INVALID_JSON_MESSAGE) {
      return errorResponse(res, err.message, 400);
    }
    error('---Error @handleApiRequest', err);
    return errorResponse(res, 'Something went wrong', 500);
  }
}
