// @ts-check
// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';
import { initTheme } from './theme.js';
import { createLogger } from './logging.js';
const logger = createLogger('app');

/**
 * @typedef {{ autoConvertEnabled: boolean }} InitUiOptions
 */

const AUTO_CONVERT_STORAGE_KEY = 'autoConvertEnabled';
const DEFAULT_AUTO_CONVERT = true;

/** @returns {boolean} */
function readAutoConvertEnabledPreference() {
  let autoConvertEnabled = DEFAULT_AUTO_CONVERT;

  try {
    const storedValue = localStorage.getItem(AUTO_CONVERT_STORAGE_KEY);
    if (storedValue !== null) {
      autoConvertEnabled = storedValue === 'true';
    }
  } catch (_err) {
    // If localStorage is unavailable, fall back to default.
    autoConvertEnabled = DEFAULT_AUTO_CONVERT;
  }

  return autoConvertEnabled;
}

/** @returns {Promise<void>} */
async function initializeApplication() {
  // Apply persisted or system theme preference before rendering UI
  initTheme();

  // Resolve auto-convert preference
  const autoConvertEnabled = readAutoConvertEnabledPreference();

  const wm = new WorkerManager('./worker.js');
  logger.info({ msg: 'WorkerManager created' });

  // Initialise UI with resolved preferences
  /** @type {InitUiOptions} */
  const initOptions = {
    autoConvertEnabled
  };
  await initUI(wm, initOptions);
}

/** @returns {void} */
function registerApplicationStartup() {
  document.addEventListener('DOMContentLoaded', () => {
    void initializeApplication();
  });
}

registerApplicationStartup();