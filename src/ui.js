// src/ui.js

import { createDownloadHelpers } from './ui-downloads.js';
import { baseNameFromFile, detectSourceKind } from './importers/sourceKind.js';
import { info as logInfo, warn as logWarn, error as logError } from './logging.js';

const STATUS_EMPTY = 'Empty';
const STATUS_UNSUPPORTED = 'Unsupported';
const UNSUPPORTED_MESSAGE = 'This file type is not supported in the current release.';

const dom = {
  dropzone: null,
  importButton: null,
  fileInput: null,
  fileList: null,
  statusPanel: null,
  appStateBadge: null,
  downloadZip: null,
  conversionProfile: null,
  toolbarEnabled: null,
  toolbarEditToggleEnabled: null,
  toolbarMetadataToggleEnabled: null
  ,
  autoConvertEnabled: null
};

const runtime = {
  dragCounter: 0,
  listenersBound: false,
  workerManager: null,
  successfulOutputs: new Map(),
  downloadHelpers: null
  ,
  autoConvertEnabled: true
};

export const state = {
  queue: []
};

/* === DEV / CONFIDENCE HELPERS === */

function logLayoutMode() {
  const width = window.innerWidth;
  let mode = 'Layout C · Mobile';

  if (width >= 1024) {
    mode = 'Layout A · Desktop';
  } else if (width >= 640) {
    mode = 'Layout B · Tablet / Laptop';
  }

  logInfo('ui', { msg: `Active layout: ${mode} (${width}px)`, meta: { width, mode } });
}

/* === UTILITIES === */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / (1024 ** power);
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

/* === STATUS VISIBILITY === */

function updateStatusVisibility() {
  const count = state.queue.length;

  if (dom.statusPanel) {
    dom.statusPanel.classList.toggle('hidden', count === 0);
  }

  if (dom.appStateBadge) {
    dom.appStateBadge.textContent = count === 0
      ? STATUS_EMPTY
      : `${count} queued`;
  }

  updateZipButton();
}

/* === DIAGNOSTICS UI === */

function formatDiagnosticForList(d) {
  try {
    const time = new Date(d.timestamp || Date.now()).toLocaleTimeString();
    const kind = escapeHtml(d.kind || (d.payload && d.payload.type) || 'diag');
    const brief = d.payload && d.payload.type ? escapeHtml(String(d.payload.type)) : '';
    const details = escapeHtml(JSON.stringify(d.payload || {}));
    return `<div class="mb-2 text-xs text-slate-700"><strong>[${time}] ${kind}</strong> ${brief}<div class="mt-1 text-[11px] text-muted">${details}</div></div>`;
  } catch (e) {
    return `<div class="text-xs text-muted">diagnostic</div>`;
  }
}

function renderDiagnostics() {
  if (!dom.diagnosticsList) return;
  const diags = (runtime.workerManager && typeof runtime.workerManager.getDiagnostics === 'function')
    ? runtime.workerManager.getDiagnostics()
    : [];
  try { logInfo('ui', { msg: 'renderDiagnostics — count', meta: { count: diags.length } }); } catch (ignore) {}

  dom.diagnosticsList.innerHTML = diags.map(formatDiagnosticForList).join('\n') || '';
  if (dom.diagnosticsCount) dom.diagnosticsCount.textContent = `(${diags.length})`;
  if (dom.diagnosticsPanel) dom.diagnosticsPanel.classList.toggle('hidden', diags.length === 0);
}

function isSuccessStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'success' || normalized === 'completed';
}

function updateZipButton() {
  if (!dom.downloadZip) return;
  dom.downloadZip.disabled = runtime.successfulOutputs.size === 0;
}

function rebuildSuccessfulOutputs() {
  runtime.successfulOutputs.clear();

  for (const entry of state.queue) {
    if (!isSuccessStatus(entry.status)) continue;
    if (typeof entry.outputHtml !== 'string' || entry.outputHtml.length === 0) continue;

    const stem = baseNameFromFile(entry.name || 'output');
    let filename = `${stem}.html`;
    let index = 2;

    while (runtime.successfulOutputs.has(filename)) {
      filename = `${stem} (${index}).html`;
      index += 1;
    }

    runtime.successfulOutputs.set(filename, entry.outputHtml);
  }

  updateZipButton();
}

function isSupportedSourceKind(sourceKind) {
  return sourceKind === 'mht';
}

function setAutoConvertEnabled(value) {
  runtime.autoConvertEnabled = Boolean(value);
  try {
    localStorage.setItem('autoConvertEnabled', runtime.autoConvertEnabled ? 'true' : 'false');
  } catch (err) {
    // best-effort persistence
  }
  if (dom.autoConvertNotice) {
    dom.autoConvertNotice.classList.toggle('hidden', !runtime.autoConvertEnabled);
  }
}

function onAutoConvertChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  setAutoConvertEnabled(target.checked);
}

/* === DROPZONE STATE === */

function setDropzoneActive(active) {
  if (!dom.dropzone) return;
  dom.dropzone.classList.toggle('border-sky-500', active);
}

/* === QUEUE HELPERS === */

function nextId() {
  return crypto.randomUUID();
}

function getQueueEntry(id) {
  return state.queue.find((entry) => entry.id === id) || null;
}

function updateEntryStatus(id, status) {
  const entry = getQueueEntry(id);
  if (!entry) return;
  entry.status = status;
  renderFileList();
}

/* === PROCESSING === */

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file as text'));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file as bytes'));
    reader.readAsArrayBuffer(file);
  });
}

async function processEntryWithWorker(entry) {
  try {
    const sourceKind = detectSourceKind(entry.name, entry.file.type);
    const payload = {
      id: entry.id,
      fileName: entry.name,
      relativePath: entry.name,
      mimetype: entry.file.type || '',
      sourceKind,
      config: runtime.downloadHelpers
        ? runtime.downloadHelpers.getConversionConfig()
        : { Profile: 'cornell', TailwindCssHref: 'assets/tailwind-output.css' }
    };

    let transferList = [];
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      const bytes = await readFileAsArrayBuffer(entry.file);
      payload.bytes = bytes;
      transferList = [bytes];
    } else {
      payload.html = await readFileAsText(entry.file);
    }

    logInfo('ui', { id: entry.id, msg: 'Dispatching entry to worker', meta: { name: entry.name } });
    const result = await runtime.workerManager.enqueue(payload, null, transferList);

    logInfo('ui', { id: entry.id, msg: 'Worker returned for entry', meta: { status: (result && result.status) ? result.status : 'unknown' } });

    if (result && typeof result.outputHtml === 'string') {
      entry.outputHtml = result.outputHtml;
      updateEntryStatus(entry.id, 'success');
      return;
    }

    updateEntryStatus(entry.id, 'error');
  } catch (err) {
    logError('ui', { id: entry.id, msg: 'worker processing error', meta: { error: err && err.message ? err.message : String(err) } });
    updateEntryStatus(entry.id, 'error');
  }
}

function processEntry(entry) {
  updateEntryStatus(entry.id, 'working');

  if (typeof window.processFileEntry === 'function') {
    try {
      window.processFileEntry(entry.file, (result) => {
        if (result && typeof result.outputHtml === 'string') {
          entry.outputHtml = result.outputHtml;
        }

        const status = result && typeof result.status === 'string'
          ? result.status
          : 'success';

        updateEntryStatus(entry.id, status);
      });
      return;
    } catch (err) {
      logError('ui', { id: entry.id, msg: 'processing error', meta: { error: err && err.message ? err.message : String(err) } });
      updateEntryStatus(entry.id, 'error');
      return;
    }
  }

  if (runtime.workerManager) {
    void processEntryWithWorker(entry);
    return;
  }

  updateEntryStatus(entry.id, 'error');
}

/* === RENDERING === */

export function renderFileList() {
  if (!dom.fileList) return;

  const markup = state.queue.map((entry) => {
    const safeName = escapeHtml(entry.name);
    const displayStatus = entry.status === 'unsupported' ? STATUS_UNSUPPORTED : (entry.status || 'queued');
    const safeStatus = escapeHtml(displayStatus);
    const safeSize = escapeHtml(formatBytes(entry.size));
    const safeMessage = entry.message ? escapeHtml(entry.message) : '';
    const hasOutput = typeof entry.outputHtml === 'string' && entry.outputHtml.length > 0;

    return `
      <div class="file-item rounded-xl border border-slate-200 bg-white p-4" data-id="${entry.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">${safeName}</p>
            <p class="mt-1 text-xs text-slate-500">${safeSize} · ${safeStatus}</p>
            ${safeMessage ? `<p class="mt-1 text-xs text-muted">${safeMessage}</p>` : ''}
          </div>
          <button
            type="button"
            class="remove-item inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            data-remove-id="${entry.id}"
            aria-label="Remove ${safeName}">
            Remove
          </button>
        </div>

        ${hasOutput ? `
          <div class="mt-3">
            <button
              type="button"
              class="btn-primary text-xs px-3 py-1.5"
              data-download-id="${entry.id}">
              Download HTML
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  dom.fileList.innerHTML = markup;
  rebuildSuccessfulOutputs();
  updateStatusVisibility();
}

/* === QUEUE MUTATION === */

export function removeFromQueue(id) {
  const next = state.queue.filter((entry) => entry.id !== id);
  if (next.length === state.queue.length) return;
  state.queue = next;
  renderFileList();
}

export function addFilesToQueue(files) {
  const list = Array.from(files || []).filter((file) => file instanceof File);
  if (list.length === 0) return;

  const addedEntries = [];
  const processableEntries = [];

  for (const file of list) {
    const sourceKind = detectSourceKind(file.name, file.type);
    const supported = isSupportedSourceKind(sourceKind);
    const entry = {
      id: nextId(),
      name: file.name || 'unnamed',
      size: Number.isFinite(file.size) ? file.size : 0,
      status: supported ? 'queued' : 'unsupported',
      file,
      sourceKind
    };

    if (!supported) {
      entry.message = UNSUPPORTED_MESSAGE;
    } else {
      processableEntries.push(entry);
    }

    addedEntries.push(entry);
  }

  state.queue = [...state.queue, ...addedEntries];
  renderFileList();

  if (runtime.autoConvertEnabled) {
    logInfo('ui', { msg: 'autoConvertEnabled=true — starting processing', meta: { count: processableEntries.length } });
    for (const entry of processableEntries) {
      processEntry(entry);
    }
  } else {
    logInfo('ui', { msg: 'autoConvertEnabled=false — files added to queue' });
  }
}

function onDropzoneDragEnter(event) {
  event.preventDefault();
  runtime.dragCounter += 1;
  setDropzoneActive(true);
}

function onDropzoneDragOver(event) {
  event.preventDefault();
}

function onDropzoneDragLeave(event) {
  event.preventDefault();
  runtime.dragCounter = Math.max(0, runtime.dragCounter - 1);
  if (runtime.dragCounter === 0) {
    setDropzoneActive(false);
  }
}

function onDropzoneDrop(event) {
  event.preventDefault();
  runtime.dragCounter = 0;
  setDropzoneActive(false);
  addFilesToQueue(event.dataTransfer?.files || []);
}

function onDropzoneKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  dom.fileInput?.click();
}

function onImportButtonClick() {
  dom.fileInput?.click();
}

function onFileInputChange(event) {
  addFilesToQueue(event.target.files || []);
  event.target.value = '';
  dom.dropzone?.focus();
}

function onPaste(event) {
  if (event.clipboardData?.files?.length) {
    addFilesToQueue(event.clipboardData.files);
  }
}

function onFileListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const removeButton = target.closest('[data-remove-id]');
  if (removeButton) {
    removeFromQueue(removeButton.getAttribute('data-remove-id'));
    return;
  }

  const downloadButton = target.closest('[data-download-id]');
  if (downloadButton) {
    const id = downloadButton.getAttribute('data-download-id');
    const entry = getQueueEntry(id);
    if (!entry || !entry.outputHtml) return;

    const filename = entry.name.replace(/\.[^.]+$/, '') + '.html';

    if (runtime.downloadHelpers && typeof runtime.downloadHelpers.downloadBlob === 'function') {
      runtime.downloadHelpers.downloadBlob(filename, entry.outputHtml, 'text/html');
    }
  }
}

async function onDownloadZipClick() {
  if (!runtime.downloadHelpers || typeof runtime.downloadHelpers.downloadZip !== 'function') return;
  await runtime.downloadHelpers.downloadZip();
}

function onAdvancedOptionsChange() {
  rebuildSuccessfulOutputs();
}

/* === EVENT BINDING === */

function bindEvents() {
  if (runtime.listenersBound) return;

  dom.dropzone?.addEventListener('dragenter', onDropzoneDragEnter);
  dom.dropzone?.addEventListener('dragover', onDropzoneDragOver);
  dom.dropzone?.addEventListener('dragleave', onDropzoneDragLeave);
  dom.dropzone?.addEventListener('drop', onDropzoneDrop);
  dom.dropzone?.addEventListener('keydown', onDropzoneKeyDown);

  dom.importButton?.addEventListener('click', onImportButtonClick);
  dom.fileInput?.addEventListener('change', onFileInputChange);
  dom.fileList?.addEventListener('click', onFileListClick);
  dom.downloadZip?.addEventListener('click', onDownloadZipClick);
  dom.conversionProfile?.addEventListener('change', onAdvancedOptionsChange);
  dom.toolbarEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.toolbarEditToggleEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.toolbarMetadataToggleEnabled?.addEventListener('change', onAdvancedOptionsChange);
  document.addEventListener('paste', onPaste);
  dom.autoConvertEnabled?.addEventListener('change', onAutoConvertChange);

  window.addEventListener('resize', logLayoutMode);

  runtime.listenersBound = true;
}

/* === INIT === */

export function initUI(workerManager, options = {}) {
  dom.dropzone = document.getElementById('dropzone');
  dom.importButton = document.getElementById('importButton');
  dom.fileInput = document.getElementById('fileInput');
  dom.fileList = document.getElementById('fileList');
  dom.statusPanel = document.getElementById('statusPanel');
  dom.appStateBadge = document.getElementById('appStateBadge');
  dom.downloadZip = document.getElementById('downloadZip');
  dom.conversionProfile = document.getElementById('conversionProfile');
  dom.toolbarEnabled = document.getElementById('toolbarEnabled');
  dom.toolbarEditToggleEnabled = document.getElementById('toolbarEditToggleEnabled');
  dom.toolbarMetadataToggleEnabled = document.getElementById('toolbarMetadataToggleEnabled');
  dom.autoConvertEnabled = document.getElementById('autoConvertEnabled');
  dom.autoConvertNotice = document.getElementById('autoConvertNotice');
  dom.diagnosticsPanel = document.getElementById('diagnosticsPanel');
  dom.diagnosticsList = document.getElementById('diagnosticsList');
  dom.diagnosticsCount = document.getElementById('diagnosticsCount');

  const { autoConvertEnabled = true } = options;
  runtime.autoConvertEnabled = Boolean(autoConvertEnabled);
  if (dom.autoConvertEnabled) {
    dom.autoConvertEnabled.checked = runtime.autoConvertEnabled;
  }
  // Ensure the notice visibility matches initial runtime state
  if (dom.autoConvertNotice) {
    dom.autoConvertNotice.classList.toggle('hidden', !runtime.autoConvertEnabled);
  }

  runtime.workerManager = workerManager || null;

  // Expose a test helper to read worker-manager diagnostics from page context
  try { window.__getWorkerManagerDiagnostics = () => (runtime.workerManager ? runtime.workerManager.getDiagnostics() : []); } catch (ignore) {}

  // Diagnostics polling: reflect any worker diagnostics in the UI diagnostics panel
  if (runtime._diagnosticsPoll) {
    clearInterval(runtime._diagnosticsPoll);
    runtime._diagnosticsPoll = null;
  }
  if (runtime.workerManager && dom.diagnosticsList) {
    try {
      logInfo('ui', { msg: 'initial diagnostics count', meta: { count: runtime.workerManager.getDiagnostics().length } });
    } catch (ignore) {}
    renderDiagnostics();
    runtime._diagnosticsPoll = setInterval(renderDiagnostics, 1000);
    // Immediate update when worker-wrapper dispatches a diagnostic event
    window.addEventListener('worker-diagnostic', renderDiagnostics);
  } else if (dom.diagnosticsPanel) {
    dom.diagnosticsPanel.classList.add('hidden');
  }

  runtime.downloadHelpers = createDownloadHelpers({
    successfulOutputs: runtime.successfulOutputs,
    downloadZipButton: dom.downloadZip,
    conversionProfile: dom.conversionProfile,
    toolbarEnabled: dom.toolbarEnabled,
    toolbarEditToggleEnabled: dom.toolbarEditToggleEnabled,
    toolbarMetadataToggleEnabled: dom.toolbarMetadataToggleEnabled
  }, updateZipButton);

  if (window.JSZip) {
    logInfo('ui', { msg: 'JSZip loaded' });
  } else {
    logWarn('ui', { msg: 'JSZip not found; ZIP downloads disabled', meta: { advice: 'include JSZip or use CDN in production' } });
  }

  runtime.dragCounter = 0;
  setDropzoneActive(false);
  bindEvents();
  renderFileList();
  logLayoutMode();
}