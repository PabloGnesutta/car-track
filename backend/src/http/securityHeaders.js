/**
 * Applied to every response. The app is fully self-contained (single
 * same-origin script, no inline scripts/styles, no external resources,
 * no third-party embeds), so a strict CSP costs nothing here.
 * @type {Record<string, string>}
 */
export const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};
