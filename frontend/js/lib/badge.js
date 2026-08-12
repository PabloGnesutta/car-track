/**
 * Sets the PWA home-screen icon badge to the given count (Badging API).
 * No-op where unsupported (most desktop browsers, non-installed contexts) —
 * feature-detected and best-effort, never throws.
 * @param {number} count
 */
async function setAppBadge(count) {
  // @ts-ignore - setAppBadge/clearAppBadge aren't in the standard lib.dom types yet
  if (!('setAppBadge' in navigator)) { return; }
  try {
    if (count > 0) {
      // @ts-ignore
      await navigator.setAppBadge(count);
    } else {
      // @ts-ignore
      await navigator.clearAppBadge();
    }
  } catch (e) {
    // Best-effort only: some browsers advertise the API but reject calls
    // outside an installed PWA context.
  }
}


export { setAppBadge };
