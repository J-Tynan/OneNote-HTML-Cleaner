# Service worker and offline updates

The app registers `service-worker.js` from the application directory. On installation, the worker caches the app shell, runtime modules, export styles, and the locally shipped JSZip distribution. Paths resolve relative to the registration scope, including the GitHub Pages subpath.

Offline use requires an initial online load and a successful service-worker installation. Clearing site data or disabling service workers removes or prevents the offline cache. The app logs registration failures in the browser console.

## Release checklist

1. Update the precache list in `service-worker.js` when runtime assets change. Keep `assets/vendor/jszip.min.js` and its license in sync with the installed JSZip package.
2. Bump the fallback cache name for every release that changes cached assets:

   ```powershell
   npm run bump-sw-cache -- --increment
   npm run bump-sw-cache -- --increment --yes
   ```

3. Run `npm run test:sw-update` and `npm run test:sw-bump`. The first test exercises the actual worker at a subpath, update activation, offline conversion and ZIP downloads.
4. Verify the deployed app in a clean browser profile: load it online, wait for the worker to install, then reopen and convert offline.

An updated worker waits while existing controlled pages remain open. Close all app tabs and reopen, or explicitly activate the waiting worker and reload after activation. The worker removes old `onenote-cleaner-` caches, not unrelated application caches.

## Troubleshooting stale assets

Reload first. If an old worker remains active, close all app tabs and reopen. As a last resort, unregister the app's worker and reload while online:

```js
const registration = await navigator.serviceWorker.getRegistration();
if (registration) await registration.unregister();
location.reload();
```

Unregistering does not itself delete cached data; clearing the app's site data also removes the offline cache and browser-stored preferences.
