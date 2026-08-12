/**
 * Playwright's webServer readiness check only waits for a single successful
 * request to "/". The dev server (a minimal hand-rolled static file server,
 * freshly spawned) can still be cold right after that — enough that the
 * first test's burst of concurrent module requests times out. A few
 * sequential warm-up requests before tests start avoids that flake.
 */
export default async function globalSetup() {
  for (let i = 0; i < 5; i++) {
    try {
      await fetch('http://localhost:4000/');
    } catch {
      // ignore; the retry loop / test timeouts will surface a real outage
    }
  }
}
