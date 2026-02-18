// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';
import { initTheme } from './theme.js';

// DEBUG_APP: toggle to true for local development to see app-level informational logs.
const DEBUG_APP = false;
function debugApp(...args) {
  if (!DEBUG_APP) return;
  console.log('[App]', ...args);
}

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
  debugApp('[app] WorkerManager created');

  // Initialise UI with resolved preferences
  initUI(wm, {
    autoConvertEnabled
  });
});