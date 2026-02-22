// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';
import { initTheme } from './theme.js';
import { info as logInfo } from './logging.js';

const AUTO_CONVERT_STORAGE_KEY = 'autoConvertEnabled';
const DEFAULT_AUTO_CONVERT = true;

document.addEventListener('DOMContentLoaded', () => {
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
  logInfo('app', { msg: 'WorkerManager created' });

  // Initialise UI with resolved preferences
  initUI(wm, {
    autoConvertEnabled
  });
});