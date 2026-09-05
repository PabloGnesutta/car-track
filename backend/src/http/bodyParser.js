export const INVALID_JSON_MESSAGE = 'JSON inválido';
export const BODY_TOO_LARGE_MESSAGE = 'Solicitud demasiado grande';

// Generous for this app's payloads (small JSON objects - vehicle/item/service
// records), while still bounding how much an unauthenticated POST can force
// the server to buffer in memory per request.
const MAX_BODY_BYTES = 1024 * 1024; // 1MB

/**
 * Reads and JSON-parses a request body. Resolves {} for an empty body.
 * Rejects (and stops reading) once the body exceeds MAX_BODY_BYTES.
 * @param {import('./types').ApiRequest} req
 * @returns {Promise<Object>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    let rejected = false;
    req.on('data', chunk => {
      if (rejected) { return; } // already over the cap - drain and discard the rest
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        rejected = true;
        // Don't req.destroy() here: req and res share one socket, so
        // destroying it would tear down the connection before apiRouter
        // gets a chance to write the 413 response back.
        reject(new Error(BODY_TOO_LARGE_MESSAGE));
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (rejected) { return; }
      if (!raw) { return resolve({}); }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error(INVALID_JSON_MESSAGE));
      }
    });
    req.on('error', err => {
      if (!rejected) { reject(err); }
    });
  });
}
