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
  listenersBound: false,
  cleanup: null
};

export const state = {
  queue: []
};

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

function updateStatusVisibility() {
  const count = state.queue.length;
  if (dom.statusPanel) {
    dom.statusPanel.classList.toggle('hidden', count === 0);
  }
  if (dom.appStateBadge) {
    dom.appStateBadge.textContent = count === 0 ? STATUS_EMPTY : `${count} queued`;
  }
}

function setDropzoneActive(active) {
  if (!dom.dropzone) return;
  dom.dropzone.classList.toggle('border-sky-500', active);
  dom.dropzone.classList.toggle('bg-sky-50', active);
}

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

function processEntry(entry) {
  updateEntryStatus(entry.id, 'processing');

  if (typeof window.processFileEntry === 'function') {
    try {
      window.processFileEntry(entry.file, (result) => {
        const status = result && typeof result.status === 'string' ? result.status : 'completed';
        updateEntryStatus(entry.id, status);
      });
      return;
    } catch (_error) {
      updateEntryStatus(entry.id, 'error');
      return;
    }
  }

  setTimeout(() => {
    updateEntryStatus(entry.id, 'completed');
  }, 200);
}

/**
 * Render the current queue into `#fileList`.
 * Idempotent: replaces list markup based on current state only.
 */
export function renderFileList() {
  if (!dom.fileList) return;

  const markup = state.queue.map((entry) => {
    const safeName = escapeHtml(entry.name);
    const safeStatus = escapeHtml(entry.status || 'queued');
    const safeSize = escapeHtml(formatBytes(entry.size));
    return `
      <div class="file-item rounded-xl border border-slate-200 bg-white p-4" data-id="${entry.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">${safeName}</p>
            <p class="mt-1 text-xs text-slate-500">${safeSize} · ${safeStatus}</p>
          </div>
          <button type="button" class="remove-item inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" data-remove-id="${entry.id}" aria-label="Remove ${safeName}">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  dom.fileList.innerHTML = markup;
  updateStatusVisibility();
}

/**
 * Remove an entry by id from the queue and re-render.
 * @param {string} id Queue entry id.
 */
export function removeFromQueue(id) {
  const next = state.queue.filter((entry) => entry.id !== id);
  if (next.length === state.queue.length) return;
  state.queue = next;
  renderFileList();
}

/**
 * Add files to queue and trigger processing per newly added entry.
 * @param {File[] | FileList | Iterable<File>} files Files to enqueue.
 */
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
  const files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : [];
  addFilesToQueue(files);
}

function onDropzoneKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (dom.fileInput) {
    dom.fileInput.click();
  }
}

function onImportButtonClick() {
  if (dom.fileInput) {
    dom.fileInput.click();
  }
}

function onFileInputChange(event) {
  const input = event.target;
  addFilesToQueue(input.files || []);
  input.value = '';
}

function onPaste(event) {
  const clipboardFiles = event.clipboardData && event.clipboardData.files
    ? event.clipboardData.files
    : null;
  if (!clipboardFiles || clipboardFiles.length === 0) return;
  addFilesToQueue(clipboardFiles);
}

function onFileListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const removeButton = target.closest('[data-remove-id]');
  if (!removeButton) return;
  const id = removeButton.getAttribute('data-remove-id');
  if (!id) return;
  removeFromQueue(id);
}

async function onDownloadZipClick() {
  if (!dom.downloadZip) return;
  if (typeof window.createZip !== 'function') return;

  dom.downloadZip.disabled = true;
  try {
    await Promise.resolve(window.createZip(state.queue));
  } catch (_error) {
  } finally {
    dom.downloadZip.disabled = false;
  }
}

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
  dom.downloadZip?.addEventListener('click', onDownloadZipClick);

  runtime.listenersBound = true;
  runtime.cleanup = () => {
    dom.dropzone?.removeEventListener('dragenter', onDropzoneDragEnter);
    dom.dropzone?.removeEventListener('dragover', onDropzoneDragOver);
    dom.dropzone?.removeEventListener('dragleave', onDropzoneDragLeave);
    dom.dropzone?.removeEventListener('drop', onDropzoneDrop);
    dom.dropzone?.removeEventListener('keydown', onDropzoneKeyDown);

    dom.importButton?.removeEventListener('click', onImportButtonClick);
    dom.fileInput?.removeEventListener('change', onFileInputChange);
    dom.fileList?.removeEventListener('click', onFileListClick);
    document.removeEventListener('paste', onPaste);
    dom.downloadZip?.removeEventListener('click', onDownloadZipClick);

    runtime.listenersBound = false;
    runtime.cleanup = null;
  };
}

/**
 * Initialize UI wiring for queue, dropzone, and optional zip creation.
 * @param {unknown} _workerManager Reserved argument for compatibility.
 */
export function initUI(_workerManager) {
  if (typeof runtime.cleanup === 'function') {
    runtime.cleanup();
  }

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
}