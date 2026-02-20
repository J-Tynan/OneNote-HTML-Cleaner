# Service Worker updates & cache rollout

Purpose
- Ensure clients do not run stale `worker.js` after a release.
- Provide deterministic rollout, operator remediation steps, and a small automated test.

Key points
- Worker files (`/src/worker.js`, `/src/worker-globals.js`) should be included in the precache so clients fetch updated worker code during a release.
- Bump the cache name (e.g. `onenote-cleaner-v2` → `onenote-cleaner-v3`) on release so the new service worker installs and the old cache is removed during activation.
- Prefer an opt-in in-app update control for users/support; provide an explicit `unregister()` + reload instruction for support staff.

Developer checklist
1. Precache: add worker files to the `ASSETS` list in `service-worker.js` (already present).
2. Cache-name: update the `CACHE` constant to a new value on release.
   - Recommended: use the release helper script to bump the cache name automatically:

```bash
# preview the change (no-write)
node scripts/bump-sw-cache.cjs --set=onenote-cleaner-v3

# apply the change to service-worker.js
node scripts/bump-sw-cache.cjs --set=onenote-cleaner-v3 --yes
```

3. Activation: ensure `activate` handler deletes outdated caches and calls `clients.claim()` as needed.
4. SKIP_WAITING message: add a `message` handler that accepts `{ type: 'SKIP_WAITING' }` and calls `self.skipWaiting()` so an in‑app update control or release automation can force activation. Prefer this explicit flow over unconditional `skipWaiting()` during `install`.
5. Document the release steps and how support staff can force an update.

Example operator steps (manual)
- Force-update (support):

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
location.reload(true);
```

- In-app (recommended dev-only control):
  - `registration.waiting.postMessage({ type: 'SKIP_WAITING' });` then `window.location.reload()` after activation.

Testing guidance
- Add a Playwright test that:
  1. Registers the service worker.
  2. Replaces the served `service-worker.js` with a version containing a bumped cache name and `skipWaiting()`.
  3. Calls `registration.update()` and waits for the new service worker to become active.
  4. Verifies the new cache exists and contains `src/worker.js` (or checks `workerHash`/diagnostic differences).

Release-note snippet
- Bumped service worker cache to `<CACHE_NAME>`; worker assets (`/src/worker.js`, `/src/worker-globals.js`) are now precached so clients will pick up worker updates after the next page reload or after calling the in-app update control.

Troubleshooting
- If users continue to run old worker code after release, instruct them to run the manual unregister snippet above and hard reload.
- Use `workerHash` (visible in diagnostics) to correlate client-reported failures with the deployed worker version.

Keep this doc updated when the service-worker cache policy or update flow changes.
