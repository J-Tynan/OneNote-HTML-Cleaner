// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';
import { initTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', () => {
  // Apply persisted or system theme preference before rendering UI
  initTheme();

  const wm = new WorkerManager('src/worker.js');
  initUI(wm);
});
