const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

/** @type {Map<string, {count: number, resetAt: number}>} */
const attempts = new Map();

// Single-process server (see index.js) - an in-memory map is fine, no need
// for a shared store. Sweep expired entries periodically so long-running
// processes don't accumulate one entry per distinct IP forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now >= entry.resetAt) { attempts.delete(key); }
  }
}, WINDOW_MS).unref();

/**
 * Fixed-window rate limiter. Keyed by caller (e.g. IP), since pre-auth
 * endpoints like /api/login have no user id yet to key on.
 * @param {string} key
 * @returns {{allowed: boolean, retryAfterSeconds: number}}
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
