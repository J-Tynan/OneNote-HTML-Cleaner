export async function installRuntimeHarness(target) {
  await target.addInitScript(() => {
    if (typeof window === 'undefined' || !window || window.__ONC_TEST_HARNESS) {
      return;
    }

    const state = {
      enqueuePatched: false,
      lastPayload: null,
      markdownCapturePatched: false,
      markdownDownloads: []
    };

    function getRuntime() {
      try {
        const hooks = window.__ONC_DEV_HOOKS || null;
        if (hooks && typeof hooks.getRuntime === 'function') {
          return hooks.getRuntime();
        }
        if (typeof window.__getRuntime === 'function') {
          return window.__getRuntime();
        }
      } catch (error) {
        return null;
      }
      return null;
    }

    window.__ONC_TEST_HARNESS = {
      version: 1,
      hasWorkerManager() {
        const runtime = getRuntime();
        return !!(runtime && runtime.workerManager);
      },
      getWorkerDiagnostics() {
        try {
          const hooks = window.__ONC_DEV_HOOKS || null;
          if (hooks && typeof hooks.getWorkerManagerDiagnostics === 'function') {
            const diagnostics = hooks.getWorkerManagerDiagnostics();
            return Array.isArray(diagnostics) ? diagnostics : [];
          }
          if (typeof window.__getWorkerManagerDiagnostics === 'function') {
            const diagnostics = window.__getWorkerManagerDiagnostics();
            return Array.isArray(diagnostics) ? diagnostics : [];
          }
        } catch (error) {
          return [];
        }
        return [];
      },
      async patchWorkerManagerEnqueueCapture() {
        const runtime = getRuntime();
        if (!runtime || !runtime.workerManager) {
          return false;
        }
        if (state.enqueuePatched) {
          return true;
        }

        const originalEnqueue = runtime.workerManager.enqueue.bind(runtime.workerManager);
        runtime.workerManager.enqueue = async (payload, onprogress, transferList) => {
          const result = await originalEnqueue(payload, onprogress, transferList);
          state.lastPayload = Object.assign({}, payload);
          return result;
        };
        state.enqueuePatched = true;
        return true;
      },
      async enqueueWorkerManager(payload) {
        const runtime = getRuntime();
        if (!runtime || !runtime.workerManager) {
          return { error: 'runtime or workerManager missing' };
        }

        state.lastPayload = null;
        try {
          const result = await runtime.workerManager.enqueue(payload);
          return {
            sent: state.lastPayload,
            result
          };
        } catch (error) {
          return {
            sent: state.lastPayload,
            result: { error }
          };
        }
      },
      getConversionConfig() {
        const runtime = getRuntime();
        if (!runtime || !runtime.downloadHelpers || typeof runtime.downloadHelpers.getConversionConfig !== 'function') {
          return null;
        }
        return runtime.downloadHelpers.getConversionConfig();
      },
      installMarkdownDownloadCapture() {
        const runtime = getRuntime();
        if (!runtime || !runtime.downloadHelpers || typeof runtime.downloadHelpers.downloadBlob !== 'function') {
          throw new Error('downloadHelpers not available');
        }
        if (state.markdownCapturePatched) {
          return;
        }

        state.markdownDownloads = [];
        const originalDownloadBlob = runtime.downloadHelpers.downloadBlob.bind(runtime.downloadHelpers);
        runtime.downloadHelpers.downloadBlob = (filename, text, mime) => {
          state.markdownDownloads.push({
            filename: String(filename || ''),
            text: String(text || ''),
            mime: String(mime || '')
          });
          return undefined;
        };
        runtime.downloadHelpers.__markdownOriginalDownloadBlob = originalDownloadBlob;
        state.markdownCapturePatched = true;
      },
      getLastMarkdownDownload() {
        return state.markdownDownloads.length > 0
          ? state.markdownDownloads[state.markdownDownloads.length - 1]
          : null;
      }
    };
  });
}

export async function getWorkerDiagnostics(page) {
  return page.evaluate(() => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.getWorkerDiagnostics !== 'function') {
      return [];
    }
    const diagnostics = harness.getWorkerDiagnostics();
    return Array.isArray(diagnostics) ? diagnostics : [];
  });
}

export async function waitForWorkerManager(page, timeout = 5000) {
  await page.waitForFunction(() => {
    const harness = window.__ONC_TEST_HARNESS || null;
    return !!(harness && typeof harness.hasWorkerManager === 'function' && harness.hasWorkerManager());
  }, { timeout });
}

export async function patchWorkerManagerEnqueueCapture(page) {
  return page.evaluate(async () => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.patchWorkerManagerEnqueueCapture !== 'function') {
      return false;
    }
    return harness.patchWorkerManagerEnqueueCapture();
  });
}

export async function enqueueWorkerManager(page, payload) {
  return page.evaluate(async (nextPayload) => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.enqueueWorkerManager !== 'function') {
      return { error: 'runtime harness unavailable' };
    }
    return harness.enqueueWorkerManager(nextPayload);
  }, payload);
}

export async function getConversionConfig(page) {
  return page.evaluate(() => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.getConversionConfig !== 'function') {
      return null;
    }
    return harness.getConversionConfig();
  });
}

export async function installMarkdownDownloadCapture(page) {
  return page.evaluate(() => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.installMarkdownDownloadCapture !== 'function') {
      throw new Error('runtime harness unavailable');
    }
    harness.installMarkdownDownloadCapture();
  });
}

export async function getLastMarkdownDownload(page) {
  return page.evaluate(() => {
    const harness = window.__ONC_TEST_HARNESS || null;
    if (!harness || typeof harness.getLastMarkdownDownload !== 'function') {
      return null;
    }
    return harness.getLastMarkdownDownload();
  });
}