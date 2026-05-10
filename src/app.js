// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';
import { initTheme } from './theme.js';
import { createLogger } from './logging.js';
const logger = createLogger('app');

const AUTO_CONVERT_STORAGE_KEY = 'autoConvertEnabled';
const DEFAULT_AUTO_CONVERT = true;

document.addEventListener('DOMContentLoaded', async () => {
  // Apply persisted or system theme preference before rendering UI
  initTheme();

  // Resolve auto-convert preference
  let autoConvertEnabled = DEFAULT_AUTO_CONVERT;

  try {
    const storedValue = localStorage.getItem(AUTO_CONVERT_STORAGE_KEY);
    if (storedValue !== null) {
      autoConvertEnabled = storedValue === 'true';
    }
  } catch (err) {
    // If localStorage is unavailable, fall back to default
    autoConvertEnabled = DEFAULT_AUTO_CONVERT;
  }

  const wm = new WorkerManager('./worker.js');
  logger.info({ msg: 'WorkerManager created' });

  // Initialise UI with resolved preferences
  await initUI(wm, {
    autoConvertEnabled
  });
});