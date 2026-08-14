import { debug } from '../logger/logger.js';
import { SECURITY_HEADERS } from './securityHeaders.js';


/**
 * @param {import('./types').ApiResponse} res
 * @param {string} msg
 * @param {number} [status=400] - Default 400
 */
export function errorResponse(res, msg, status = 400) {
  debug(' @errorResponse:', msg);
  res.writeHead(status, { 'content-type': 'application/json', ...SECURITY_HEADERS });
  return res.end(JSON.stringify({ error: msg }));
}
