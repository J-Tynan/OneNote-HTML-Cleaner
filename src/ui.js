// src/ui.js

const STATUS_EMPTY = 'Empty';

const dom = {
  dropzone: null,
  importButton: null,
  fileInput: null,
  fileList: null,
  statusPanel: null,
  appStateBadge: null,
  downloadZip: null
};

const runtime = {
  dragCounter: 0,
  listenersBound: false
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

  console.debug(`[UI] Active layout: ${mode} (${width}px)`);
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
      console.error('[ui] processing error', err);
      updateEntryStatus(entry.id, 'error');
      return;
    }
  }

  setTimeout(() => {
    updateEntryStatus(entry.id, 'success');
  }, 200);
}

/* === RENDERING === */

export function renderFileList() {
  if (!dom.fileList) return;

  const markup = state.queue.map((entry) => {
    const safeName = escapeHtml(entry.name);
    const safeStatus = escapeHtml(entry.status || 'queued');
    const safeSize = escapeHtml(formatBytes(entry.size));
    const hasOutput = typeof entry.outputHtml === 'string' && entry.outputHtml.length > 0;

    return `
      <div class="file-item rounded-xl border border-slate-200 bg-white p-4" data-id="${entry.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">${safeName}</p>
            <p class="mt-1 text-xs text-slate-500">${safeSize} · ${safeStatus}</p>
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

  const addedEntries = list.map((file) => ({
    id: nextId(),
    name: file.name || 'unnamed',
    size: Number.isFinite(file.size) ? file.size : 0,
    status: 'queued',
    file
  }));

  state.queue = [...state.queue, ...addedEntries];
  renderFileList();

  for (const entry of addedEntries) {
    processEntry(entry);
  }
}

/* === EVENT HANDLERS === */

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

    if (typeof window.downloadBlob === 'function') {
      window.downloadBlob(filename, entry.outputHtml, 'text/html');
    }
  }
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
  document.addEventListener('paste', onPaste);

  window.addEventListener('resize', logLayoutMode);

  runtime.listenersBound = true;
}

/* === INIT === */

export function initUI() {
  dom.dropzone = document.getElementById('dropzone');
  dom.importButton = document.getElementById('importButton');
  dom.fileInput = document.getElementById('fileInput');
  dom.fileList = document.getElementById('fileList');
  dom.statusPanel = document.getElementById('statusPanel');
  dom.appStateBadge = document.getElementById('appStateBadge');
  dom.downloadZip = document.getElementById('downloadZip');

  runtime.dragCounter = 0;
  setDropzoneActive(false);
  bindEvents();
  renderFileList();
  logLayoutMode();
}
