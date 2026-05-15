// src/ui.js

import { buildExportFileName } from './export-filenames.js';
import { createDownloadHelpers } from './ui-downloads.js';
import { buildAdvancedOptionsState } from './ui-options.js';
import { detectSourceKind } from './importers/sourceKind.js';
import { createLogger, setEnabled as setLogEnabled } from './logging.js';

const logger = createLogger('ui');

const STATUS_EMPTY = 'Empty';
const STATUS_UNSUPPORTED = 'Unsupported';
const UNSUPPORTED_MESSAGE = 'This file type is not supported in the current release.';
const AUTO_CONVERT_NOTICE_COPY = {
  enabled: {
    lead: 'Files are converted automatically when added to the queue.',
    detail: 'You can change this behaviour in Advanced options.'
  },
  disabled: {
    lead: 'Files stay in the queue until you convert them manually.',
    detail: "When you're ready, click Convert queued files."
  }
};

const DRAFT_DB_NAME = 'onc-homepage-drafts';
const DRAFT_STORE_NAME = 'drafts';
const DRAFT_SESSION_KEY = 'oncHomepageDraftInstance';
const DRAFT_SESSION_SNAPSHOT_KEY = 'oncHomepageDraftSnapshot';
const DRAFT_SAVE_DEBOUNCE_MS = 120;
const DRAFT_STALE_AGE_MS = 24 * 60 * 60 * 1000;
const RESTORE_FILE_MISSING_MESSAGE = 'Original file data was not available after the page was restored. Please add the file again.';

const dom = {
  dropzone: null,
  importButton: null,
  fileInput: null,
  fileList: null,
  statusPanel: null,
  appStateBadge: null,
  statusSummary: null,
  clearFilesButton: null,
  downloadZip: null,
  convertButton: null,
  convertButtonWrapper: null,
  toolbarEnabled: null,
  toolbarStyle: null,
  autoConvertEnabled: null,
  externalizeCssEnabled: null,
  externalizeCssMode: null,
  experimentalExportEnabled: null,
  exportFormat: null,
  markdownFlavor: null,
  markdownFlavorContainer: null,
  exportFormatHelp: null,
  convertedPageThemeToggleEnabled: null,
  convertedPageThemeToggleOledBlack: null,
  convertedPageThemeHelp: null
};

const runtime = {
  dragCounter: 0,
  listenersBound: false,
  workerManager: null,
  successfulOutputs: new Map(),
  downloadHelpers: null,
  autoConvertEnabled: true,
  draftInstanceId: null,
  draftDbPromise: null,
  draftSaveTimer: null,
  restoringDraft: false,
  draftHasStoredEntries: false
};

export const state = {
  queue: []
};

function createDraftInstanceId() {
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDraftInstanceId() {
  try {
    let instanceId = sessionStorage.getItem(DRAFT_SESSION_KEY);
    if (!instanceId) {
      instanceId = createDraftInstanceId();
      sessionStorage.setItem(DRAFT_SESSION_KEY, instanceId);
    }
    return instanceId;
  } catch (_) {
    return null;
  }
}

function cloneSerializable(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeDraftAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;

  const serialized = {
    path: typeof asset.path === 'string' ? asset.path : '',
    type: typeof asset.type === 'string' ? asset.type : '',
    content: typeof asset.content === 'string' ? asset.content : ''
  };

  if (asset.bytes instanceof Uint8Array) {
    serialized.bytes = Array.from(asset.bytes);
  } else if (asset.bytes instanceof ArrayBuffer) {
    serialized.bytes = Array.from(new Uint8Array(asset.bytes));
  }

  return serialized;
}

function deserializeDraftAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;

  const restored = {
    path: typeof asset.path === 'string' ? asset.path : '',
    type: typeof asset.type === 'string' ? asset.type : '',
    content: typeof asset.content === 'string' ? asset.content : ''
  };

  if (Array.isArray(asset.bytes)) {
    restored.bytes = new Uint8Array(asset.bytes);
  }

  return restored;
}

function serializeQueueEntry(entry) {
  const normalizedStatus = entry.status === 'working' ? 'queued' : (entry.status || 'queued');
  return {
    id: entry.id,
    name: entry.name || 'unnamed',
    size: Number.isFinite(entry.size) ? entry.size : 0,
    status: normalizedStatus,
    file: entry.file instanceof File ? entry.file : null,
    fileType: entry.file instanceof File && typeof entry.file.type === 'string' ? entry.file.type : '',
    fileText: typeof entry.fileText === 'string' ? entry.fileText : '',
    sourceKind: entry.sourceKind || detectSourceKind(entry.name, entry.file?.type),
    message: typeof entry.message === 'string' ? entry.message : '',
    outputHtml: typeof entry.outputHtml === 'string' ? entry.outputHtml : '',
    outputText: typeof entry.outputText === 'string' ? entry.outputText : '',
    outputFormat: getEntryOutputFormat(entry),
    outputAssets: Array.isArray(entry.outputAssets) ? entry.outputAssets.map(serializeDraftAsset).filter(Boolean) : [],
    conversionConfig: cloneSerializable(entry.conversionConfig),
    downloadFileName: typeof entry.downloadFileName === 'string' ? entry.downloadFileName : ''
  };
}

function serializeSessionQueueEntry(entry) {
  const serialized = serializeQueueEntry(entry);
  serialized.file = null;
  return serialized;
}

function deserializeQueueEntry(entry) {
  let restoredFile = entry.file instanceof File ? entry.file : null;
  if (!(restoredFile instanceof File) && typeof entry.fileText === 'string' && entry.fileText.length > 0) {
    restoredFile = new File([entry.fileText], entry.name || 'restored.mht', {
      type: typeof entry.fileType === 'string' && entry.fileType ? entry.fileType : 'multipart/related'
    });
  }

  const restored = {
    id: entry.id || createDraftInstanceId(),
    name: entry.name || 'unnamed',
    size: Number.isFinite(entry.size) ? entry.size : 0,
    status: entry.status === 'working' ? 'queued' : (entry.status || 'queued'),
    file: restoredFile,
    fileText: typeof entry.fileText === 'string' ? entry.fileText : '',
    sourceKind: entry.sourceKind || detectSourceKind(entry.name, restoredFile?.type),
    message: typeof entry.message === 'string' ? entry.message : '',
    outputHtml: typeof entry.outputHtml === 'string' ? entry.outputHtml : '',
    outputText: typeof entry.outputText === 'string' ? entry.outputText : '',
    outputFormat: entry.outputFormat === 'markdown' ? 'markdown' : 'html',
    outputAssets: Array.isArray(entry.outputAssets) ? entry.outputAssets.map(deserializeDraftAsset).filter(Boolean) : [],
    conversionConfig: cloneSerializable(entry.conversionConfig),
    downloadFileName: typeof entry.downloadFileName === 'string' ? entry.downloadFileName : ''
  };

  if (!(restored.file instanceof File) && restored.status === 'queued' && isSupportedSourceKind(restored.sourceKind)) {
    restored.status = 'error';
    restored.message = RESTORE_FILE_MISSING_MESSAGE;
  }

  return restored;
}

function openDraftDb() {
  if (runtime.draftDbPromise) return runtime.draftDbPromise;

  runtime.draftDbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      const request = indexedDB.open(DRAFT_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
          db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
          const store = tx.objectStore(DRAFT_STORE_NAME);
          const staleBefore = Date.now() - DRAFT_STALE_AGE_MS;
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const value = cursor.value;
            if (value && typeof value.updatedAt === 'number' && value.updatedAt < staleBefore) {
              cursor.delete();
            }
            cursor.continue();
          };
        } catch (_) {
          // best-effort cleanup only
        }

        resolve(db);
      };

      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });

  return runtime.draftDbPromise;
}

function getDraftRecord(db, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const request = tx.objectStore(DRAFT_STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

function putDraftRecord(db, value) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      tx.objectStore(DRAFT_STORE_NAME).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

function deleteDraftRecord(db, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      tx.objectStore(DRAFT_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

async function persistDraftStateNow() {
  if (runtime.restoringDraft) return false;
  if (!runtime.draftInstanceId) return false;

  const db = await openDraftDb();
  if (!db) return false;

  if (state.queue.length === 0) {
    try { sessionStorage.removeItem(DRAFT_SESSION_SNAPSHOT_KEY); } catch (_) {}

    if (!runtime.draftHasStoredEntries) {
      return true;
    }

    const deleted = await deleteDraftRecord(db, runtime.draftInstanceId);
    if (deleted) {
      runtime.draftHasStoredEntries = false;
    }
    return deleted;
  }

  try {
    sessionStorage.setItem(DRAFT_SESSION_SNAPSHOT_KEY, JSON.stringify({
      updatedAt: Date.now(),
      autoConvertEnabled: runtime.autoConvertEnabled,
      queue: state.queue.map(serializeSessionQueueEntry)
    }));
  } catch (_) {
    // best-effort same-tab backup only
  }

  const saved = await putDraftRecord(db, {
    id: runtime.draftInstanceId,
    updatedAt: Date.now(),
    autoConvertEnabled: runtime.autoConvertEnabled,
    queue: state.queue.map(serializeQueueEntry)
  });

  if (saved) {
    runtime.draftHasStoredEntries = true;
  }

  return saved;
}

function scheduleDraftPersist() {
  if (runtime.restoringDraft) return;
  if (runtime.draftSaveTimer) {
    clearTimeout(runtime.draftSaveTimer);
  }

  runtime.draftSaveTimer = setTimeout(() => {
    runtime.draftSaveTimer = null;
    void persistDraftStateNow();
  }, DRAFT_SAVE_DEBOUNCE_MS);
}

async function flushDraftPersist() {
  if (runtime.draftSaveTimer) {
    clearTimeout(runtime.draftSaveTimer);
    runtime.draftSaveTimer = null;
  }
  return persistDraftStateNow();
}

async function restoreDraftState() {
  if (!runtime.draftInstanceId) return false;

  const db = await openDraftDb();
  if (!db) return false;

  let draft = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    draft = await getDraftRecord(db, runtime.draftInstanceId);
    if (draft && Array.isArray(draft.queue) && draft.queue.length > 0) {
      break;
    }
    draft = null;
    if (attempt < 4) {
      await delay(75);
    }
  }

  if (!draft) {
    try {
      const raw = sessionStorage.getItem(DRAFT_SESSION_SNAPSHOT_KEY);
      draft = raw ? JSON.parse(raw) : null;
    } catch (_) {
      draft = null;
    }
  }

  if (!draft || !Array.isArray(draft.queue) || draft.queue.length === 0) {
    return false;
  }

  runtime.restoringDraft = true;
  runtime.draftHasStoredEntries = true;
  try {
    state.queue = draft.queue.map(deserializeQueueEntry);
    if (typeof draft.autoConvertEnabled === 'boolean') {
      runtime.autoConvertEnabled = draft.autoConvertEnabled;
      if (dom.autoConvertEnabled) {
        dom.autoConvertEnabled.checked = runtime.autoConvertEnabled;
      }
      updateAutoConvertNotice();
    }
    return true;
  } finally {
    runtime.restoringDraft = false;
  }
}

function onDocumentVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void flushDraftPersist();
  }
}

function onWindowPageHide() {
  void flushDraftPersist();
}

/* === DEV / CONFIDENCE HELPERS === */

function logLayoutMode() {
  const width = window.innerWidth;
  let mode = 'Layout C · Mobile';

  if (width >= 1024) {
    mode = 'Layout A · Desktop';
  } else if (width >= 640) {
    mode = 'Layout B · Tablet / Laptop';
  }

  logger.info({ msg: `Active layout: ${mode} (${width}px)`, meta: { width, mode } });
}

function getWorkerManagerDiagnostics() {
  return runtime.workerManager ? runtime.workerManager.getDiagnostics() : [];
}

function registerDevHooks() {
  if (typeof window === 'undefined' || !window) {
    return;
  }

  const hooks = {
    version: 1,
    getRuntime: () => runtime,
    getWorkerManagerDiagnostics
  };

  // Keep these explicit for tests and local debugging until a dedicated
  // test harness replaces direct runtime access.
  try { window.__ONC_DEV_HOOKS = hooks; } catch (ignore) {}
  try { window.__getRuntime = hooks.getRuntime; } catch (ignore) {}
  try { window.__getWorkerManagerDiagnostics = hooks.getWorkerManagerDiagnostics; } catch (ignore) {}
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

function buildStatusSummary(counts) {
  const segments = [];

  if (counts.working > 0) {
    segments.push(`${counts.working} working`);
  }
  if (counts.queued > 0) {
    segments.push(`${counts.queued} queued`);
  }
  if (counts.success > 0) {
    segments.push(`${counts.success} complete`);
  }
  if (counts.unsupported > 0) {
    segments.push(`${counts.unsupported} unsupported`);
  }
  if (counts.error > 0) {
    segments.push(`${counts.error} error`);
  }

  if (segments.length === 0) {
    return 'Added files will appear here with progress, status, and downloads.';
  }

  return `${segments.join(', ')}.`;
}

function getBadgeState(counts) {
  if (counts.working > 0) {
    return {
      label: counts.working === 1 ? 'Working' : `${counts.working} working`,
      tone: 'working'
    };
  }

  if (counts.queued > 0) {
    return {
      label: counts.queued === 1 ? 'Queued' : `${counts.queued} queued`,
      tone: 'queued'
    };
  }

  if (counts.error > 0) {
    return {
      label: counts.error === 1 ? 'Error' : `${counts.error} errors`,
      tone: 'error'
    };
  }

  if (counts.unsupported > 0) {
    return {
      label: counts.unsupported === 1 ? STATUS_UNSUPPORTED : `${counts.unsupported} unsupported`,
      tone: 'unsupported'
    };
  }

  if (counts.success > 0) {
    return {
      label: counts.success === 1 ? 'Ready' : `${counts.success} ready`,
      tone: 'success'
    };
  }

  return {
    label: STATUS_EMPTY,
    tone: 'empty'
  };
}

function updateStatusVisibility() {
  const totalCount = state.queue.length;
  const counts = {
    queued: 0,
    working: 0,
    success: 0,
    unsupported: 0,
    error: 0
  };

  for (const entry of state.queue) {
    const tone = getStatusTone(entry.status || 'queued');
    if (tone in counts) {
      counts[tone] += 1;
    }
  }

  if (dom.statusPanel) {
    dom.statusPanel.classList.toggle('home-results-card--empty', totalCount === 0);
  }

  if (dom.statusSummary) {
    dom.statusSummary.textContent = buildStatusSummary(counts);
  }

  if (dom.appStateBadge) {
    const badge = getBadgeState(counts);
    dom.appStateBadge.textContent = badge.label;
    dom.appStateBadge.setAttribute('data-state', badge.tone);
  }

  updateZipButton();
  updateClearFilesButton();
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'working' || normalized === 'processing' || normalized === 'in-progress') return 'working';
  if (normalized === 'success' || normalized === 'completed' || normalized === 'done') return 'success';
  if (normalized === 'error' || normalized === 'failed') return 'error';
  if (normalized === 'unsupported') return 'unsupported';
  return 'neutral';
}

/* === DIAGNOSTICS UI === */

function formatDiagnosticForList(d) {
  try {
    const time = new Date(d.timestamp || Date.now()).toLocaleTimeString();
    const kind = escapeHtml(d.kind || (d.payload && d.payload.type) || 'diag');
    const brief = d.payload && d.payload.type ? escapeHtml(String(d.payload.type)) : '';
    const details = escapeHtml(JSON.stringify(d.payload || {}));
    return `<div class="mb-2 text-xs text-secondary"><strong>[${time}] ${kind}</strong> ${brief}<div class="mt-1 text-[11px] text-muted">${details}</div></div>`;
  } catch (e) {
    return `<div class="text-xs text-muted">diagnostic</div>`;
  }
}

function renderDiagnostics() {
  if (!dom.diagnosticsList) return;
  const diags = (runtime.workerManager && typeof runtime.workerManager.getDiagnostics === 'function')
    ? runtime.workerManager.getDiagnostics()
    : [];

  dom.diagnosticsList.innerHTML = diags.map(formatDiagnosticForList).join('\n') || '';
  if (dom.diagnosticsCount) dom.diagnosticsCount.textContent = `(${diags.length})`;
  if (dom.diagnosticsPanel) dom.diagnosticsPanel.classList.toggle('hidden', diags.length === 0);
}

function isSuccessStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'success' || normalized === 'completed';
}

function hasExternalizedCssAsset(entry) {
  if (!entry || !Array.isArray(entry.outputAssets)) return false;
  return entry.outputAssets.some((asset) => asset
    && asset.type === 'text/css'
    && typeof asset.content === 'string'
    && asset.content.trim().length > 0);
}

function getEntryOutputFormat(entry) {
  if (entry && typeof entry.outputFormat === 'string') {
    return entry.outputFormat === 'markdown' ? 'markdown' : 'html';
  }
  if (typeof entry?.outputText === 'string' && entry.outputText.length > 0) {
    return 'markdown';
  }
  return 'html';
}

function getEntryOutputContent(entry) {
  const format = getEntryOutputFormat(entry);
  if (format === 'markdown') {
    return typeof entry.outputText === 'string' ? entry.outputText : '';
  }
  return typeof entry.outputHtml === 'string' ? entry.outputHtml : '';
}

function getEntryDownloadFileName(entry) {
  if (typeof entry?.downloadFileName === 'string' && entry.downloadFileName) {
    return entry.downloadFileName;
  }

  return buildExportFileName({
    entryName: entry?.name || 'output',
    outputFormat: getEntryOutputFormat(entry),
    outputContent: getEntryOutputContent(entry)
  });
}

function getEntryDownloadMime(entry) {
  return getEntryOutputFormat(entry) === 'markdown' ? 'text/markdown' : 'text/html';
}

function updateZipButton() {
  if (!dom.downloadZip) return;
  dom.downloadZip.disabled = runtime.successfulOutputs.size === 0;
}

function updateClearFilesButton() {
  if (!dom.clearFilesButton) return;
  dom.clearFilesButton.disabled = state.queue.length === 0;
}

function updateExternalCssControls() {
  if (!dom.externalizeCssEnabled || !dom.externalizeCssMode) return;
  const enabled = dom.externalizeCssEnabled.checked === true;
  dom.externalizeCssMode.disabled = !enabled;
}

function updateToolbarStyleControls() {
  if (!dom.toolbarStyle) return;
  const enabled = dom.toolbarEnabled?.checked === true;
  dom.toolbarStyle.disabled = !enabled;
}

function updateExportFormatControls() {
  const advancedOptionsState = buildAdvancedOptionsState(dom);

  if (dom.exportFormat) {
    dom.exportFormat.disabled = !advancedOptionsState.experimentalEnabled;
    dom.exportFormat.classList.toggle('hidden', !advancedOptionsState.experimentalEnabled);
  }
  if (dom.markdownFlavorContainer) {
    dom.markdownFlavorContainer.classList.toggle('hidden', !advancedOptionsState.markdownSelected);
  }
  if (dom.markdownFlavor) {
    dom.markdownFlavor.disabled = !advancedOptionsState.markdownSelected;
  }
  if (dom.exportFormatHelp) {
    if (!advancedOptionsState.experimentalEnabled) {
      dom.exportFormatHelp.textContent = 'Enable experimental export formats to choose HTML or Markdown output.';
    } else if (advancedOptionsState.selectedExportFormat === 'markdown') {
      dom.exportFormatHelp.textContent = 'Markdown export is structure-first (layout not preserved).';
    } else {
      dom.exportFormatHelp.textContent = 'HTML export keeps the existing parity-first conversion path.';
    }
  }

  updateConvertedPageThemeControls(advancedOptionsState);
}

function updateConvertedPageThemeControls(advancedOptionsState = buildAdvancedOptionsState(dom)) {
  const htmlSelected = advancedOptionsState.htmlSelected;
  const toggleEnabled = advancedOptionsState.convertedPageThemeToggleChecked;

  if (dom.convertedPageThemeToggleEnabled) {
    dom.convertedPageThemeToggleEnabled.disabled = !htmlSelected;
  }

  if (dom.convertedPageThemeToggleOledBlack) {
    dom.convertedPageThemeToggleOledBlack.disabled = !htmlSelected || !toggleEnabled;
  }

  if (dom.convertedPageThemeHelp) {
    if (!htmlSelected) {
      dom.convertedPageThemeHelp.textContent = 'Converted-page theme toggle is available only for HTML export.';
    } else {
      dom.convertedPageThemeHelp.textContent = 'Enable to inject a symbol-based Light/Dark toggle into converted HTML pages (default Light). Optional OLED-black applies only when the toggle is enabled.';
    }
  }
}

function getActiveConversionConfig() {
  if (!runtime.downloadHelpers || typeof runtime.downloadHelpers.getConversionConfig !== 'function') {
    throw new Error('Download helpers are not initialized.');
  }

  return runtime.downloadHelpers.getConversionConfig();
}

function rebuildSuccessfulOutputs() {
  runtime.successfulOutputs.clear();

  for (const entry of state.queue) {
    if (!isSuccessStatus(entry.status)) continue;
    const content = getEntryOutputContent(entry);
    if (!content) continue;

    const filename = buildExportFileName({
      entryName: entry.name || 'output',
      outputFormat: getEntryOutputFormat(entry),
      outputContent: content,
      takenNames: runtime.successfulOutputs
    });

    entry.downloadFileName = filename;

    runtime.successfulOutputs.set(filename, {
      content,
      format: getEntryOutputFormat(entry),
      assets: Array.isArray(entry.outputAssets) ? entry.outputAssets : [],
      config: entry.conversionConfig || null
    });
  }

  updateZipButton();
}

function processQueue() {
  for (const entry of state.queue) {
    if (entry.status !== 'queued') continue;
    if (!isSupportedSourceKind(entry.sourceKind)) continue;
    processEntry(entry);
  }
}

function updateConvertButton() {
  if (!dom.convertButton) return;
  const hasQueued = state.queue.some((e) => e.status === 'queued' && isSupportedSourceKind(e.sourceKind));
  const anyWorking = state.queue.some((e) => e.status === 'working');
  dom.convertButton.disabled = runtime.autoConvertEnabled || !hasQueued || anyWorking;

  // Tooltip handling: show only when auto-convert is enabled and button disabled
  const tooltip = document.getElementById('convertTooltip');
  const wrapper = dom.convertButtonWrapper;
  if (tooltip) {
    const show = runtime.autoConvertEnabled && dom.convertButton.disabled;
    if (show) {
      tooltip.classList.remove('hidden');
      tooltip.setAttribute('aria-hidden', 'false');
      if (wrapper) wrapper.setAttribute('aria-describedby', 'convertTooltip');
    } else {
      tooltip.classList.add('hidden');
      tooltip.setAttribute('aria-hidden', 'true');
      if (wrapper) wrapper.removeAttribute('aria-describedby');
    }
  }
}

function onConvertClick(event) {
  event.preventDefault();
  processQueue();
  updateConvertButton();
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
  updateAutoConvertNotice();
  // convert button state and tooltip depend on auto-convert toggles
  updateConvertButton();
  scheduleDraftPersist();
}

function updateAutoConvertNotice() {
  if (!dom.autoConvertNotice || !dom.autoConvertNoticeLead || !dom.autoConvertNoticeDetail) {
    return;
  }

  const copy = runtime.autoConvertEnabled
    ? AUTO_CONVERT_NOTICE_COPY.enabled
    : AUTO_CONVERT_NOTICE_COPY.disabled;

  dom.autoConvertNotice.dataset.mode = runtime.autoConvertEnabled ? 'auto' : 'manual';
  dom.autoConvertNoticeLead.textContent = copy.lead;
  dom.autoConvertNoticeDetail.textContent = copy.detail;
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

export function clearQueue() {
  if (state.queue.length === 0) return;
  state.queue = [];
  renderFileList();
  void flushDraftPersist();
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

async function primeEntryDraftFileText(entry) {
  if (!entry || typeof entry !== 'object') return;
  if (entry.fileText || !(entry.file instanceof File) || !isSupportedSourceKind(entry.sourceKind)) return;

  try {
    entry.fileText = await readFileAsText(entry.file);
    scheduleDraftPersist();
  } catch (_) {
    // best-effort backup only
  }
}

async function processEntryWithWorker(entry) {
  try {
    const conversionConfig = getActiveConversionConfig();
    entry.conversionConfig = conversionConfig;
    const sourceKind = detectSourceKind(entry.name, entry.file.type);
    const payload = {
      id: entry.id,
      fileName: entry.name,
      relativePath: entry.name,
      mimetype: entry.file.type || '',
      sourceKind,
      config: conversionConfig
    };

    let transferList = [];
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      const bytes = await readFileAsArrayBuffer(entry.file);
      payload.bytes = bytes;
      transferList = [bytes];
    } else {
      payload.html = await readFileAsText(entry.file);
      entry.fileText = payload.html;
    }

    logger.info({ id: entry.id, msg: 'Dispatching entry to worker', meta: { name: entry.name } });
    const result = await runtime.workerManager.enqueue(payload, null, transferList);

    logger.info({ id: entry.id, msg: 'Worker returned for entry', meta: { status: (result && result.status) ? result.status : 'unknown' } });

    if (result && typeof result.outputHtml === 'string') {
      entry.outputHtml = result.outputHtml;
      entry.outputText = '';
      entry.outputFormat = 'html';
      entry.outputAssets = Array.isArray(result.outputAssets) ? result.outputAssets : [];
      updateEntryStatus(entry.id, 'success');
      return;
    }

    if (result && typeof result.outputText === 'string') {
      entry.outputText = result.outputText;
      entry.outputHtml = '';
      entry.outputFormat = result.outputFormat === 'markdown' ? 'markdown' : 'markdown';
      entry.outputAssets = [];
      updateEntryStatus(entry.id, 'success');
      return;
    }

    if (result && typeof result.error === 'string') {
      entry.message = result.error;
    }

    updateEntryStatus(entry.id, 'error');
  } catch (err) {
    logger.error({ id: entry.id, msg: 'worker processing error', meta: { error: err && err.message ? err.message : String(err) } });
    entry.message = err && err.message ? err.message : String(err);
    updateEntryStatus(entry.id, 'error');
  }
}

function processEntry(entry) {
  updateEntryStatus(entry.id, 'working');
  entry.conversionConfig = getActiveConversionConfig();

  if (runtime.workerManager) {
    void processEntryWithWorker(entry);
    return;
  }

  if (typeof window.processFileEntry === 'function') {
    try {
      window.processFileEntry(entry.file, (result) => {
        if (result && typeof result.outputHtml === 'string') {
          entry.outputHtml = result.outputHtml;
          entry.outputText = '';
          entry.outputFormat = 'html';
          entry.outputAssets = Array.isArray(result.outputAssets) ? result.outputAssets : [];
        } else if (result && typeof result.outputText === 'string') {
          entry.outputText = result.outputText;
          entry.outputHtml = '';
          entry.outputFormat = 'markdown';
          entry.outputAssets = [];
        }

        const status = result && typeof result.status === 'string'
          ? result.status
          : 'success';

        updateEntryStatus(entry.id, status);
      }, entry.conversionConfig || {});
      return;
    } catch (err) {
      logger.error({ id: entry.id, msg: 'processing error', meta: { error: err && err.message ? err.message : String(err) } });
      updateEntryStatus(entry.id, 'error');
      return;
    }
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
    const statusTone = getStatusTone(displayStatus);
    const safeSize = escapeHtml(formatBytes(entry.size));
    const safeMessage = entry.message ? escapeHtml(entry.message) : '';
    const outputFormat = getEntryOutputFormat(entry);
    const hasOutput = getEntryOutputContent(entry).length > 0;
    const singleDownloadBlocked = Boolean(
      outputFormat === 'html'
      &&
      entry.conversionConfig
      && entry.conversionConfig.ExternalizeCssEnabled === true
      && hasExternalizedCssAsset(entry)
    );
    const canDownload = hasOutput && !singleDownloadBlocked;
    const downloadLabel = outputFormat === 'markdown' ? 'Download Markdown' : 'Download HTML';

    return `
      <div class="file-item rounded-xl border p-4" data-id="${entry.id}" data-status="${statusTone}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">${safeName}</p>
            <p class="mt-1 flex items-center gap-2 text-xs text-muted">
              <span>${safeSize}</span>
              <span aria-hidden="true">&middot;</span>
              <span class="status-pill status-pill--${statusTone}">${safeStatus}</span>
            </p>
            ${safeMessage ? `<p class="mt-1 text-xs text-muted">${safeMessage}</p>` : ''}
          </div>
          <button
            type="button"
            class="remove-item btn-secondary"
            data-remove-id="${entry.id}"
            aria-label="Remove ${safeName}">
            Remove
          </button>
        </div>

        ${canDownload ? `
          <div class="mt-3">
            <button
              type="button"
              class="btn-primary"
              data-download-id="${entry.id}">
              ${downloadLabel}
            </button>
          </div>
        ` : ''}
        ${hasOutput && singleDownloadBlocked ? `
          <p class="mt-3 text-xs text-muted">Single-file download disabled while external CSS is enabled. Use Download ZIP.</p>
        ` : ''}
      </div>
    `;
  }).join('');

  dom.fileList.innerHTML = markup;
  rebuildSuccessfulOutputs();
  updateStatusVisibility();
  updateConvertButton();
  scheduleDraftPersist();
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

  for (const entry of processableEntries) {
    void primeEntryDraftFileText(entry);
  }

  if (runtime.autoConvertEnabled) {
    logger.info({ msg: 'autoConvertEnabled=true — starting processing', meta: { count: processableEntries.length } });
    for (const entry of processableEntries) {
      processEntry(entry);
    }
  } else {
    logger.info({ msg: 'autoConvertEnabled=false — files added to queue' });
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
    if (!entry) return;
    const content = getEntryOutputContent(entry);
    if (!content) return;
    if (getEntryOutputFormat(entry) === 'html' && entry.conversionConfig && entry.conversionConfig.ExternalizeCssEnabled === true && hasExternalizedCssAsset(entry)) return;

    const filename = getEntryDownloadFileName(entry);
    const mime = getEntryDownloadMime(entry);

    if (runtime.downloadHelpers && typeof runtime.downloadHelpers.downloadBlob === 'function') {
      runtime.downloadHelpers.downloadBlob(filename, content, mime);
    }
  }
}

async function onDownloadZipClick() {
  if (!runtime.downloadHelpers || typeof runtime.downloadHelpers.downloadZip !== 'function') return;
  await runtime.downloadHelpers.downloadZip();
}

function onClearFilesClick() {
  clearQueue();
}

function onAdvancedOptionsChange() {
  updateToolbarStyleControls();
  updateExternalCssControls();
  updateExportFormatControls();
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
  dom.clearFilesButton?.addEventListener('click', onClearFilesClick);
  dom.downloadZip?.addEventListener('click', onDownloadZipClick);
  dom.convertButton?.addEventListener('click', onConvertClick);
  dom.toolbarEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.toolbarStyle?.addEventListener('change', onAdvancedOptionsChange);
  dom.externalizeCssEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.externalizeCssMode?.addEventListener('change', onAdvancedOptionsChange);
  dom.experimentalExportEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.exportFormat?.addEventListener('change', onAdvancedOptionsChange);
  dom.markdownFlavor?.addEventListener('change', onAdvancedOptionsChange);
  dom.convertedPageThemeToggleEnabled?.addEventListener('change', onAdvancedOptionsChange);
  dom.convertedPageThemeToggleOledBlack?.addEventListener('change', onAdvancedOptionsChange);
  document.addEventListener('paste', onPaste);
  dom.autoConvertEnabled?.addEventListener('change', onAutoConvertChange);

  // Help modal events
  dom.helpButton?.addEventListener('click', (e) => {
    e.preventDefault();
    openHelpModal();
  });

  dom.helpCloseButton?.addEventListener('click', (e) => {
    e.preventDefault();
    closeHelpModal();
  });

  // Close modal on Escape and click outside; open/close help with '?' shortcut
  document.addEventListener('keydown', (e) => {
    // Ignore shortcuts when typing in inputs, textareas, or contenteditable elements
    const tgt = e.target;
    const tag = tgt && tgt.tagName ? tgt.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (tgt && tgt.isContentEditable)) return;

    if (e.key === 'Escape') {
      closeHelpModal();
      return;
    }

    // Open/close help on '?' (Shift+/) or literal '?'
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      // toggle modal visibility
      if (dom.helpModal && !dom.helpModal.classList.contains('hidden')) {
        closeHelpModal();
      } else {
        openHelpModal();
      }
    }
  });

  dom.helpModal?.addEventListener('click', (e) => {
    if (e.target === dom.helpModal) closeHelpModal();
  });

  window.addEventListener('resize', logLayoutMode);
  document.addEventListener('visibilitychange', onDocumentVisibilityChange);
  window.addEventListener('pagehide', onWindowPageHide);

  runtime.listenersBound = true;
}


/* === INIT === */

export async function initUI(workerManager, options = {}) {
  try { setLogEnabled(typeof window !== 'undefined' && window && window.LOGGING_ENABLED !== false); } catch (_) {}
  dom.dropzone = document.getElementById('dropzone');
  dom.importButton = document.getElementById('importButton');
  dom.fileInput = document.getElementById('fileInput');
  dom.fileList = document.getElementById('fileList');
  dom.statusPanel = document.getElementById('statusPanel');
  dom.appStateBadge = document.getElementById('appStateBadge');
  dom.statusSummary = document.getElementById('statusSummary');
  dom.clearFilesButton = document.getElementById('clearFilesButton');
  dom.downloadZip = document.getElementById('downloadZip');
  dom.convertButton = document.getElementById('convertButton');
  dom.convertButtonWrapper = document.querySelector('.convert-button-wrapper');
  dom.toolbarEnabled = document.getElementById('toolbarEnabled');
  dom.toolbarStyle = document.getElementById('toolbarStyle');
  dom.autoConvertEnabled = document.getElementById('autoConvertEnabled');
  dom.externalizeCssEnabled = document.getElementById('externalizeCssEnabled');
  dom.externalizeCssMode = document.getElementById('externalizeCssMode');
  dom.experimentalExportEnabled = document.getElementById('experimentalExportEnabled');
  dom.exportFormat = document.getElementById('exportFormat');
  dom.markdownFlavor = document.getElementById('markdownFlavor');
  dom.markdownFlavorContainer = document.getElementById('markdownFlavorContainer');
  dom.exportFormatHelp = document.getElementById('exportFormatHelp');
  dom.convertedPageThemeToggleEnabled = document.getElementById('convertedPageThemeToggleEnabled');
  dom.convertedPageThemeToggleOledBlack = document.getElementById('convertedPageThemeToggleOledBlack');
  dom.convertedPageThemeHelp = document.getElementById('convertedPageThemeHelp');
  dom.autoConvertNotice = document.getElementById('autoConvertNotice');
  dom.autoConvertNoticeLead = document.getElementById('autoConvertNoticeLead');
  dom.autoConvertNoticeDetail = document.getElementById('autoConvertNoticeDetail');
  dom.diagnosticsPanel = document.getElementById('diagnosticsPanel');
  dom.diagnosticsList = document.getElementById('diagnosticsList');
  dom.diagnosticsCount = document.getElementById('diagnosticsCount');
  dom.helpButton = document.getElementById('helpButton');
  dom.helpModal = document.getElementById('helpModal');
  dom.helpCloseButton = document.getElementById('helpCloseButton');


  const { autoConvertEnabled = true } = options;
  runtime.autoConvertEnabled = Boolean(autoConvertEnabled);
  if (dom.autoConvertEnabled) {
    dom.autoConvertEnabled.checked = runtime.autoConvertEnabled;
  }
  updateAutoConvertNotice();

  runtime.workerManager = workerManager || null;
  runtime.draftInstanceId = getDraftInstanceId();
  registerDevHooks();

  // Diagnostics polling: reflect any worker diagnostics in the UI diagnostics panel
  if (runtime._diagnosticsPoll) {
    clearInterval(runtime._diagnosticsPoll);
    runtime._diagnosticsPoll = null;
  }
  if (runtime.workerManager && dom.diagnosticsList) {
    try {
      logger.info({ msg: 'initial diagnostics count', meta: { count: runtime.workerManager.getDiagnostics().length } });
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
    toolbarEnabled: dom.toolbarEnabled,
    toolbarStyle: dom.toolbarStyle,
    externalizeCssEnabled: dom.externalizeCssEnabled,
    externalizeCssMode: dom.externalizeCssMode,
    experimentalExportEnabled: dom.experimentalExportEnabled,
    exportFormat: dom.exportFormat,
    markdownFlavor: dom.markdownFlavor,
    convertedPageThemeToggleEnabled: dom.convertedPageThemeToggleEnabled,
    convertedPageThemeToggleOledBlack: dom.convertedPageThemeToggleOledBlack
  }, updateZipButton);

  if (window.JSZip) {
    logger.info({ msg: 'JSZip loaded' });
  } else {
    logger.warn({ msg: 'JSZip not found; ZIP downloads disabled', meta: { advice: 'include JSZip or use CDN in production' } });
  }

  runtime.dragCounter = 0;
  setDropzoneActive(false);
  updateToolbarStyleControls();
  updateExternalCssControls();
  updateExportFormatControls();

  bindEvents();
  const restoredDraft = await restoreDraftState();
  renderFileList();
  updateConvertButton();
  if (restoredDraft && runtime.autoConvertEnabled) {
    processQueue();
  }
  logLayoutMode();
}

/* === HELP MODAL === */

function openHelpModal() {
  if (!dom.helpModal || !dom.helpButton) return;
  dom.helpModal.classList.remove('hidden');
  dom.helpModal.classList.add('flex');
  dom.helpButton.setAttribute('aria-expanded', 'true');
  // focus the close button for keyboard users
  try { dom.helpCloseButton?.focus(); } catch (e) {}
}

function closeHelpModal() {
  if (!dom.helpModal || !dom.helpButton) return;
  dom.helpModal.classList.add('hidden');
  dom.helpModal.classList.remove('flex');
  dom.helpButton.setAttribute('aria-expanded', 'false');
  try { dom.helpButton?.focus(); } catch (e) {}
}