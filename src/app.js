// src/app.js
import { initUI } from './ui.js';
import WorkerManager from './worker-wrapper.js';

document.addEventListener('DOMContentLoaded', () => {
  const wm = new WorkerManager('src/worker.js');
  initUI(wm);
});
