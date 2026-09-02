// @ts-check

// src/ui.js

import { createDownloadHelpers } from './ui-downloads.js';
import { buildAdvancedOptionsState } from './ui-options.js';
import { buildWorkerPayloadForEntry } from './ui-worker-payload.js';
import {
  buildSuccessfulOutputRecord,
  getEntryDownloadFileName,
  getEntryDownloadMime,
  getEntryOutputContent,
  getEntryOutputFormat,
  getStatusTone,
  hasExternalizedCssAsset
} from './ui-output-records.js';
import { detectSourceKind } from './importers/sourceKind.js';
import { createLogger, setEnabled as setLogEnabled } from './logging.js';

/**
 * @typedef {import('./contracts.js').OutputAsset} OutputAsset
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('./contracts.js').SourceKind} SourceKind
 * @typedef {import('./contracts.js').WorkerQueuedPayload} WorkerQueuedPayload
 * @typedef {ReturnType<typeof buildAdvancedOptionsState>} AdvancedOptionsState
 * @typedef {ReturnType<typeof createDownloadHelpers>} DownloadHelpers
 * @typedef {import('./ui-output-records.js').StatusTone} StatusTone
 * @typedef {'queued' | 'working' | 'success' | 'error' | 'unsupported'} QueueStatus
 * @typedef {'html' | 'markdown'} QueueOutputFormat
 * @typedef {string | { content?: string, html?: string, format?: string, assets?: OutputAsset[], config?: PipelineConfigInput | null }} UiSuccessfulOutputValue
 * @typedef {{ path: string, type: string, content: string, bytes?: number[] }} SerializedDraftAsset
 * @typedef {OutputAsset & { path?: string, type?: string, content?: string, bytes?: Uint8Array | ArrayBuffer }} QueueOutputAsset
 * @typedef {{ id?: string, name?: string, size?: number, status?: QueueStatus | string, file?: File | null, fileType?: string, fileText?: string, sourceKind?: SourceKind | string, message?: string, outputHtml?: string, outputText?: string, outputFormat?: QueueOutputFormat | string, outputAssets?: OutputAsset[], conversionConfig?: PipelineConfigInput | null, downloadFileName?: string }} QueueEntry
 * @typedef {{ id: string, name: string, size: number, status: QueueStatus | string, file: File | null, fileType: string, fileText: string, sourceKind: SourceKind | string, message: string, outputHtml: string, outputText: string, outputFormat: QueueOutputFormat, outputAssets: SerializedDraftAsset[], conversionConfig: PipelineConfigInput | null, downloadFileName: string }} StoredQueueEntry
 * @typedef {{ id: string, updatedAt: number, autoConvertEnabled: boolean, queue: StoredQueueEntry[] }} DraftRecord
 * @typedef {{
 *   dropzone: HTMLElement | null,
 *   importButton: HTMLButtonElement | null,
 *   fileInput: HTMLInputElement | null,
 *   fileList: HTMLElement | null,
 *   statusPanel: HTMLElement | null,
 *   appStateBadge: HTMLElement | null,
 *   statusSummary: HTMLElement | null,
 *   clearFilesButton: HTMLButtonElement | null,
 *   downloadZip: HTMLButtonElement | null,
 *   convertButton: HTMLButtonElement | null,
 *   convertButtonWrapper: HTMLElement | null,
 *   toolbarEnabled: HTMLInputElement | null,
 *   toolbarStyleContainer: HTMLElement | null,
 *   toolbarStyle: HTMLSelectElement | null,
 *   autoConvertEnabled: HTMLInputElement | null,
 *   externalizeCssEnabled: HTMLInputElement | null,
 *   externalizeCssMode: HTMLSelectElement | null,
 *   experimentalExportEnabled: HTMLInputElement | null,
 *   exportFormat: HTMLSelectElement | null,
 *   markdownFlavor: HTMLSelectElement | null,
 *   markdownFlavorContainer: HTMLElement | null,
 *   exportFormatHelp: HTMLElement | null,
 *   toolbarStyleHelp: HTMLElement | null,
 *   convertedPageThemeToggleEnabled: HTMLInputElement | null,
 *   convertedPageThemeHelp: HTMLElement | null,
 *   autoConvertNotice: HTMLElement | null,
 *   autoConvertNoticeLead: HTMLElement | null,
 *   autoConvertNoticeDetail: HTMLElement | null,
 *   diagnosticsPanel: HTMLElement | null,
 *   diagnosticsList: HTMLElement | null,
 *   diagnosticsCount: HTMLElement | null,
 *   helpButton: HTMLButtonElement | null,
 *   helpModal: HelpDialogElement | null,
 *   helpCloseButton: HTMLButtonElement | null
 * }} UiDomRefs
 * @typedef {{ version: 1, getRuntime: () => UiRuntimeState, getWorkerManagerDiagnostics: () => UiDiagnosticEntry[] }} UiDevHooks
 * @typedef {{ dragCounter: number, listenersBound: boolean, workerManager: WorkerManagerLike | null, successfulOutputs: Map<string, UiSuccessfulOutputValue>, downloadHelpers: DownloadHelpers | null, autoConvertEnabled: boolean, draftInstanceId: string | null, draftDbPromise: Promise<IDBDatabase | null> | null, draftSaveTimer: number | null, restoringDraft: boolean, draftHasStoredEntries: boolean, _diagnosticsPoll: number | null }} UiRuntimeState
 * @typedef {{ queued: number, working: number, success: number, unsupported: number, error: number, neutral?: number }} StatusCounts
 * @typedef {{ label: string, tone: StatusTone | 'empty' }} StatusBadgeState
 * @typedef {{ type?: string, [key: string]: unknown }} UiDiagnosticPayload
 * @typedef {{ timestamp?: number | string, kind?: string, id?: string, preview?: string, payload?: UiDiagnosticPayload | null }} UiDiagnosticEntry
 * @typedef {{ status?: string, outputHtml?: string, outputText?: string, outputFormat?: string, outputAssets?: OutputAsset[], error?: string }} WorkerUiResult
 * @typedef {{ enqueue: (payload: WorkerQueuedPayload, onprogress?: ((message: unknown) => void) | null, transferList?: Transferable[]) => Promise<WorkerUiResult>, getDiagnostics: () => UiDiagnosticEntry[] }} WorkerManagerLike
 * @typedef {(file: File | null | undefined, ondone: (result: WorkerUiResult | null | undefined) => void, config: PipelineConfigInput) => void} LegacyProcessFileEntryFn
 * @typedef {Window & typeof globalThis & { LOGGING_ENABLED?: boolean, JSZip?: unknown, processFileEntry?: LegacyProcessFileEntryFn, __ONC_DEV_HOOKS?: UiDevHooks, __getRuntime?: () => UiRuntimeState, __getWorkerManagerDiagnostics?: () => UiDiagnosticEntry[] }} UiWindow
 * @typedef {HTMLElement & Partial<Pick<HTMLDialogElement, 'open' | 'showModal' | 'close'>>} HelpDialogElement
 * @typedef {{ autoConvertEnabled?: unknown }} UiInitOptions
 */

const logger = createLogger('ui');

const STATUS_EMPTY = 'Empty';
const STATUS_UNSUPPORTED = 'Unsupported';
const UNSUPPORTED_MESSAGE = 'This file type is not supported in the current release.';
const AUTO_CONVERT_NOTICE_COPY = {
  enabled: {
    lead: 'Files are converted automatically when added to the queue.',
    detail: 'Change this in Advanced options if you prefer manual conversion.'
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

/** @type {UiDomRefs} */
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
  toolbarStyleContainer: null,
  toolbarStyle: null,
  autoConvertEnabled: null,
  externalizeCssEnabled: null,
  externalizeCssMode: null,
  experimentalExportEnabled: null,
  exportFormat: null,
  markdownFlavor: null,
  markdownFlavorContainer: null,
  exportFormatHelp: null,
  toolbarStyleHelp: null,
  convertedPageThemeToggleEnabled: null,
  convertedPageThemeHelp: null,
  autoConvertNotice: null,
  autoConvertNoticeLead: null,
  autoConvertNoticeDetail: null,
  diagnosticsPanel: null,
  diagnosticsList: null,
  diagnosticsCount: null,
  helpButton: null,
  helpModal: null,
  helpCloseButton: null
};

/** @type {UiRuntimeState} */
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
  draftHasStoredEntries: false,
  _diagnosticsPoll: null
};

/** @type {{ queue: QueueEntry[] }} */
export const state = {
  queue: []
};

/** @returns {string} */
function createDraftInstanceId() {
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** @returns {string | null} */
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

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneSerializable(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {QueueOutputAsset | SerializedDraftAsset | null | undefined} asset
 * @returns {SerializedDraftAsset | null}
 */
function serializeDraftAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;

  /** @type {SerializedDraftAsset} */
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

/**
 * @param {SerializedDraftAsset | null | undefined} asset
 * @returns {QueueOutputAsset | null}
 */
function deserializeDraftAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;

  /** @type {QueueOutputAsset} */
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

/**
 * @param {QueueEntry} entry
 * @returns {StoredQueueEntry}
 */
function serializeQueueEntry(entry) {
  const normalizedStatus = entry.status === 'working'
    ? 'queued'
    : (entry.status === 'success' || entry.status === 'error' || entry.status === 'unsupported' ? entry.status : 'queued');
  return {
    id: typeof entry.id === 'string' ? entry.id : createDraftInstanceId(),
    name: entry.name || 'unnamed',
    size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0,
    status: normalizedStatus,
    file: entry.file instanceof File ? entry.file : null,
    fileType: entry.file instanceof File && typeof entry.file.type === 'string' ? entry.file.type : '',
    fileText: typeof entry.fileText === 'string' ? entry.fileText : '',
    sourceKind: entry.sourceKind || detectSourceKind(entry.name, entry.file?.type),
    message: typeof entry.message === 'string' ? entry.message : '',
    outputHtml: typeof entry.outputHtml === 'string' ? entry.outputHtml : '',
    outputText: typeof entry.outputText === 'string' ? entry.outputText : '',
    outputFormat: getEntryOutputFormat(entry),
    outputAssets: Array.isArray(entry.outputAssets)
      ? entry.outputAssets.map(serializeDraftAsset).filter((item) => item !== null)
      : [],
    conversionConfig: /** @type {PipelineConfigInput | null} */ (cloneSerializable(entry.conversionConfig)),
    downloadFileName: typeof entry.downloadFileName === 'string' ? entry.downloadFileName : ''
  };
}

/**
 * @param {QueueEntry} entry
 * @returns {StoredQueueEntry}
 */
function serializeSessionQueueEntry(entry) {
  const serialized = serializeQueueEntry(entry);
  serialized.file = null;
  return serialized;
}

/**
 * @param {StoredQueueEntry} entry
 * @returns {QueueEntry}
 */
function deserializeQueueEntry(entry) {
  let restoredFile = entry.file instanceof File ? entry.file : null;
  if (!(restoredFile instanceof File) && typeof entry.fileText === 'string' && entry.fileText.length > 0) {
    restoredFile = new File([entry.fileText], entry.name || 'restored.mht', {
      type: typeof entry.fileType === 'string' && entry.fileType ? entry.fileType : 'multipart/related'
    });
  }

  /** @type {QueueEntry} */
  const restored = {
    id: entry.id || createDraftInstanceId(),
    name: entry.name || 'unnamed',
    size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0,
    status: entry.status === 'working' ? 'queued' : (entry.status || 'queued'),
    file: restoredFile,
    fileText: typeof entry.fileText === 'string' ? entry.fileText : '',
    sourceKind: entry.sourceKind || detectSourceKind(entry.name, restoredFile?.type),
    message: typeof entry.message === 'string' ? entry.message : '',
    outputHtml: typeof entry.outputHtml === 'string' ? entry.outputHtml : '',
    outputText: typeof entry.outputText === 'string' ? entry.outputText : '',
    outputFormat: entry.outputFormat === 'markdown' ? 'markdown' : 'html',
    outputAssets: Array.isArray(entry.outputAssets)
      ? entry.outputAssets.map(deserializeDraftAsset).filter((item) => item !== null)
      : [],
    conversionConfig: /** @type {PipelineConfigInput | null} */ (cloneSerializable(entry.conversionConfig)),
    downloadFileName: typeof entry.downloadFileName === 'string' ? entry.downloadFileName : ''
  };

  if (!(restored.file instanceof File) && restored.status === 'queued' && isSupportedSourceKind(restored.sourceKind)) {
    restored.status = 'error';
    restored.message = RESTORE_FILE_MISSING_MESSAGE;
  }

  return restored;
}

/** @returns {Promise<IDBDatabase | null>} */
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

/**
 * @param {IDBDatabase} db
 * @param {string} id
 * @returns {Promise<DraftRecord | null>}
 */
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

/**
 * @param {IDBDatabase} db
 * @param {DraftRecord} value
 * @returns {Promise<boolean>}
 */
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

/**
 * @param {IDBDatabase} db
 * @param {string} id
 * @returns {Promise<boolean>}
 */
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

/** @returns {Promise<boolean>} */
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

/** @returns {void} */
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

/** @returns {Promise<boolean>} */
async function flushDraftPersist() {
  if (runtime.draftSaveTimer) {
    clearTimeout(runtime.draftSaveTimer);
    runtime.draftSaveTimer = null;
  }
  return persistDraftStateNow();
}

/** @returns {Promise<boolean>} */
async function restoreDraftState() {
  if (!runtime.draftInstanceId) return false;

  const db = await openDraftDb();
  if (!db) return false;

  /** @type {DraftRecord | null} */
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

/** @returns {void} */
function onDocumentVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void flushDraftPersist();
  }
}

/** @returns {void} */
function onWindowPageHide() {
  void flushDraftPersist();
}

/* === DEV / CONFIDENCE HELPERS === */

/** @returns {void} */
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

/** @returns {UiDiagnosticEntry[]} */
function getWorkerManagerDiagnostics() {
  return runtime.workerManager ? runtime.workerManager.getDiagnostics() : [];
}

/** @returns {void} */
function registerDevHooks() {
  if (typeof window === 'undefined' || !window) {
    return;
  }

  const appWindow = /** @type {UiWindow} */ (window);

  /** @type {UiDevHooks} */
  const hooks = {
    version: 1,
    getRuntime: () => runtime,
    getWorkerManagerDiagnostics
  };

  // Keep these explicit for tests and local debugging until a dedicated
  // test harness replaces direct runtime access.
  try { appWindow.__ONC_DEV_HOOKS = hooks; } catch (ignore) {}
  try { appWindow.__getRuntime = hooks.getRuntime; } catch (ignore) {}
  try { appWindow.__getWorkerManagerDiagnostics = hooks.getWorkerManagerDiagnostics; } catch (ignore) {}
}

/* === UTILITIES === */

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  const replacements = /** @type {Record<string, string>} */ ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  });
  return String(value).replace(/[&<>"']/g, (ch) => replacements[ch] || ch);
}

/**
 * @param {unknown} size
 * @returns {string}
 */
function formatBytes(size) {
  const numericSize = typeof size === 'number' ? size : Number(size);
  if (!Number.isFinite(numericSize) || numericSize <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(numericSize) / Math.log(1024)), units.length - 1);
  const value = numericSize / (1024 ** power);
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

/* === STATUS VISIBILITY === */

/**
 * @param {StatusCounts} counts
 * @returns {string}
 */
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

/**
 * @param {StatusCounts} counts
 * @returns {{ label: string, tone: StatusTone | 'empty' }}
 */
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

/**
 * @param {number} previousHeight
 * @returns {void}
 */
function preserveStatusSummaryHeight(previousHeight) {
  if (!dom.statusSummary) return;

  const currentHeight = dom.statusSummary.getBoundingClientRect().height;
  const storedHeight = Number(dom.statusSummary.dataset.preservedMinHeight || '0');
  const nextHeight = Math.max(storedHeight, previousHeight, currentHeight);

  if (nextHeight > 0) {
    dom.statusSummary.style.minHeight = `${nextHeight}px`;
    dom.statusSummary.dataset.preservedMinHeight = String(nextHeight);
  }
}

/** @returns {void} */
function updateStatusVisibility() {
  const totalCount = state.queue.length;
  const previousSummaryHeight = dom.statusSummary
    ? dom.statusSummary.getBoundingClientRect().height
    : 0;
  /** @type {StatusCounts} */
  const counts = {
    queued: 0,
    working: 0,
    success: 0,
    unsupported: 0,
    error: 0,
    neutral: 0
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

  preserveStatusSummaryHeight(previousSummaryHeight);

  if (dom.appStateBadge) {
    const badge = getBadgeState(counts);
    dom.appStateBadge.textContent = badge.label;
    dom.appStateBadge.setAttribute('data-state', badge.tone);
  }

  updateZipButton();
  updateClearFilesButton();
}

/* === DIAGNOSTICS UI === */

/**
 * @param {any} d
 * @returns {string}
 */
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

/** @returns {void} */
function renderDiagnostics() {
  if (!dom.diagnosticsList) return;
  /** @type {UiDiagnosticEntry[]} */
  const diags = (runtime.workerManager && typeof runtime.workerManager.getDiagnostics === 'function')
    ? runtime.workerManager.getDiagnostics()
    : [];

  dom.diagnosticsList.innerHTML = diags.map(formatDiagnosticForList).join('\n') || '';
  if (dom.diagnosticsCount) dom.diagnosticsCount.textContent = `(${diags.length})`;
  if (dom.diagnosticsPanel) dom.diagnosticsPanel.classList.toggle('hidden', diags.length === 0);
}

/** @returns {void} */
function updateZipButton() {
  if (!dom.downloadZip) return;
  dom.downloadZip.disabled = runtime.successfulOutputs.size === 0;
}

/** @returns {void} */
function updateClearFilesButton() {
  if (!dom.clearFilesButton) return;
  dom.clearFilesButton.disabled = state.queue.length === 0;
}

/** @returns {void} */
function updateExternalCssControls() {
  if (!dom.externalizeCssEnabled || !dom.externalizeCssMode) return;
  const enabled = dom.externalizeCssEnabled.checked === true;
  dom.externalizeCssMode.disabled = !enabled;
}

/**
 * @param {AdvancedOptionsState} [advancedOptionsState=buildAdvancedOptionsState(dom)]
 * @returns {void}
 */
function updateToolbarStyleControls(advancedOptionsState = buildAdvancedOptionsState(dom)) {
  if (!dom.toolbarStyle) return;
  const htmlSelected = advancedOptionsState.htmlSelected;
  const toolbarChecked = advancedOptionsState.toolbarEnabledChecked;
  const styleVisible = htmlSelected && toolbarChecked;

  if (dom.toolbarEnabled) {
    dom.toolbarEnabled.disabled = !htmlSelected;
  }

  if (dom.toolbarStyleContainer) {
    dom.toolbarStyleContainer.classList.toggle('hidden', !styleVisible);
  }

  if (dom.toolbarStyle) {
    dom.toolbarStyle.disabled = !styleVisible;
  }

  if (dom.toolbarStyleHelp) {
    if (!htmlSelected) {
      dom.toolbarStyleHelp.textContent = 'Toolbar presets are available only for HTML export.';
    } else if (!toolbarChecked) {
      dom.toolbarStyleHelp.textContent = 'Enable toolbar injection to choose a toolbar chrome preset before conversion.';
    } else {
      dom.toolbarStyleHelp.textContent = 'Compact keeps controls small for narrow screens. Office uses an Office 97-inspired chrome, and Ribbon uses a larger modern Office-style chrome.';
    }
  }
}

/** @returns {void} */
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
      dom.exportFormatHelp.textContent = 'Enable experimental export formats to choose HTML or Markdown output when you need it.';
    } else if (advancedOptionsState.selectedExportFormat === 'markdown') {
      dom.exportFormatHelp.textContent = 'Markdown export prioritizes structure over visual layout.';
    } else {
      dom.exportFormatHelp.textContent = 'HTML keeps the default parity-first conversion path.';
    }
  }

  updateConvertedPageThemeControls(advancedOptionsState);
  updateToolbarStyleControls(advancedOptionsState);
}

/**
 * @param {AdvancedOptionsState} [advancedOptionsState=buildAdvancedOptionsState(dom)]
 * @returns {void}
 */
function updateConvertedPageThemeControls(advancedOptionsState = buildAdvancedOptionsState(dom)) {
  const htmlSelected = advancedOptionsState.htmlSelected;

  if (dom.convertedPageThemeToggleEnabled) {
    dom.convertedPageThemeToggleEnabled.disabled = !htmlSelected;
  }

  if (dom.convertedPageThemeHelp) {
    if (!htmlSelected) {
      dom.convertedPageThemeHelp.textContent = 'Converted-page theme toggle is available only for HTML export.';
    } else {
      dom.convertedPageThemeHelp.textContent = 'Enable a symbol-based Light or Black toggle in converted HTML pages.';
    }
  }
}

/** @returns {PipelineConfigInput} */
function getActiveConversionConfig() {
  if (!runtime.downloadHelpers || typeof runtime.downloadHelpers.getConversionConfig !== 'function') {
    throw new Error('Download helpers are not initialized.');
  }

  return runtime.downloadHelpers.getConversionConfig();
}

/** @returns {void} */
function rebuildSuccessfulOutputs() {
  runtime.successfulOutputs.clear();

  for (const entry of state.queue) {
    const built = buildSuccessfulOutputRecord(entry, runtime.successfulOutputs);
    if (!built) continue;

    entry.downloadFileName = built.filename;

    runtime.successfulOutputs.set(built.filename, built.record);
  }

  updateZipButton();
}

/** @returns {void} */
function processQueue() {
  for (const entry of state.queue) {
    if (entry.status !== 'queued') continue;
    if (!isSupportedSourceKind(entry.sourceKind)) continue;
    processEntry(entry);
  }
}

/** @returns {void} */
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

/** @param {Event} event */
function onConvertClick(event) {
  event.preventDefault();
  processQueue();
  updateConvertButton();
}

/**
 * @param {unknown} sourceKind
 * @returns {boolean}
 */
function isSupportedSourceKind(sourceKind) {
  return sourceKind === 'mht';
}

/** @param {unknown} value */
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

/** @returns {void} */
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

/** @param {Event} event */
function onAutoConvertChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  setAutoConvertEnabled(target.checked);
}

/* === DROPZONE STATE === */

/** @param {boolean} active */
function setDropzoneActive(active) {
  if (!dom.dropzone) return;
  dom.dropzone.classList.toggle('border-sky-500', active);
}

/* === QUEUE HELPERS === */

/** @returns {string} */
function nextId() {
  return crypto.randomUUID();
}

/**
 * @param {unknown} id
 * @returns {QueueEntry | null}
 */
function getQueueEntry(id) {
  return state.queue.find((entry) => entry.id === id) || null;
}

/**
 * @param {unknown} id
 * @param {unknown} status
 * @returns {void}
 */
function updateEntryStatus(id, status) {
  const entry = getQueueEntry(id);
  if (!entry) return;
  entry.status = String(status || 'queued');
  renderFileList();
}

/** @returns {void} */
export function clearQueue() {
  if (state.queue.length === 0) return;
  state.queue = [];
  renderFileList();
  void flushDraftPersist();
}

/* === PROCESSING === */

/**
 * @param {Blob} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file as text'));
    reader.readAsText(file);
  });
}

/**
 * @param {Blob} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
    reader.onerror = () => reject(reader.error || new Error('Could not read file as bytes'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * @param {QueueEntry} entry
 * @returns {Promise<void>}
 */
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

/**
 * @param {QueueEntry} entry
 * @returns {Promise<void>}
 */
async function processEntryWithWorker(entry) {
  try {
    if (typeof entry.id !== 'string' || !entry.id) {
      entry.id = nextId();
    }
    if (!(entry.file instanceof File)) {
      entry.message = RESTORE_FILE_MISSING_MESSAGE;
      updateEntryStatus(entry.id, 'error');
      return;
    }

    const conversionConfig = getActiveConversionConfig();
    entry.conversionConfig = conversionConfig;
    const workerEntry = {
      id: entry.id,
      name: typeof entry.name === 'string' && entry.name ? entry.name : (entry.file.name || 'unnamed'),
      file: entry.file
    };
    const { sourceKind, payload } = buildWorkerPayloadForEntry(workerEntry, conversionConfig);
    const workerManager = /** @type {WorkerManagerLike | null} */ (runtime.workerManager);
    if (!workerManager) {
      updateEntryStatus(entry.id, 'error');
      return;
    }

    const transferList = /** @type {ArrayBuffer[]} */ ([]);
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      const bytes = await readFileAsArrayBuffer(entry.file);
      payload.bytes = bytes;
      transferList.push(bytes);
    } else {
      payload.html = await readFileAsText(entry.file);
      entry.fileText = payload.html;
    }

    logger.info({ id: entry.id, msg: 'Dispatching entry to worker', meta: { name: entry.name } });
    const result = await workerManager.enqueue(/** @type {WorkerQueuedPayload} */ (payload), null, transferList);

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
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ id: entry.id, msg: 'worker processing error', meta: { error: errorMessage } });
    entry.message = errorMessage;
    updateEntryStatus(entry.id, 'error');
  }
}

/**
 * @param {QueueEntry} entry
 * @returns {void}
 */
function processEntry(entry) {
  updateEntryStatus(entry.id, 'working');
  entry.conversionConfig = getActiveConversionConfig();

  if (runtime.workerManager) {
    void processEntryWithWorker(entry);
    return;
  }

  const appWindow = /** @type {UiWindow} */ (window);
  const processFileEntry = appWindow.processFileEntry;
  if (typeof processFileEntry === 'function') {
    try {
      processFileEntry(entry.file, (result) => {
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
      logger.error({ id: entry.id, msg: 'processing error', meta: { error: err instanceof Error ? err.message : String(err) } });
      updateEntryStatus(entry.id, 'error');
      return;
    }
  }

  updateEntryStatus(entry.id, 'error');
}

/* === RENDERING === */

/** @returns {void} */
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
      <div class="file-item rounded-xl border p-3" data-id="${entry.id}" data-status="${statusTone}">
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
          <div class="file-item__actions">
            <button
              type="button"
              class="remove-item btn-secondary secondary-action-button file-item__remove-button"
              data-remove-id="${entry.id}"
              aria-label="Remove ${safeName}">
              Remove
            </button>
            ${canDownload ? `
              <button
                type="button"
                class="btn-primary file-item__download-button"
                data-download-id="${entry.id}">
                ${downloadLabel}
              </button>
            ` : ''}
          </div>
        </div>
        ${hasOutput && singleDownloadBlocked ? `
          <p class="mt-2 text-xs text-muted">Single-file download disabled while external CSS is enabled. Use Download ZIP.</p>
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

/** @param {unknown} id */
export function removeFromQueue(id) {
  const next = state.queue.filter((entry) => entry.id !== id);
  if (next.length === state.queue.length) return;
  state.queue = next;
  renderFileList();
}

/** @param {FileList | File[] | null | undefined} files */
export function addFilesToQueue(files) {
  /** @type {File[]} */
  const list = Array.from(files || []).filter((file) => file instanceof File);
  if (list.length === 0) return;

  /** @type {QueueEntry[]} */
  const addedEntries = [];
  /** @type {QueueEntry[]} */
  const processableEntries = [];

  for (const file of list) {
    const sourceKind = detectSourceKind(file.name, file.type);
    const supported = isSupportedSourceKind(sourceKind);
    /** @type {QueueEntry} */
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

/** @param {DragEvent} event */
function onDropzoneDragEnter(event) {
  event.preventDefault();
  runtime.dragCounter += 1;
  setDropzoneActive(true);
}

/** @param {DragEvent} event */
function onDropzoneDragOver(event) {
  event.preventDefault();
}

/** @param {DragEvent} event */
function onDropzoneDragLeave(event) {
  event.preventDefault();
  runtime.dragCounter = Math.max(0, runtime.dragCounter - 1);
  if (runtime.dragCounter === 0) {
    setDropzoneActive(false);
  }
}

/** @param {DragEvent} event */
function onDropzoneDrop(event) {
  event.preventDefault();
  runtime.dragCounter = 0;
  setDropzoneActive(false);
  addFilesToQueue(event.dataTransfer?.files || []);
}

/** @param {KeyboardEvent} event */
function onDropzoneKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  dom.fileInput?.click();
}

/** @returns {void} */
function onImportButtonClick() {
  dom.fileInput?.click();
}

/** @param {Event} event */
function onFileInputChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  addFilesToQueue(target.files || []);
  target.value = '';
  dom.dropzone?.focus();
}

/** @param {ClipboardEvent} event */
function onPaste(event) {
  if (event.clipboardData?.files?.length) {
    addFilesToQueue(event.clipboardData.files);
  }
}

/** @param {MouseEvent} event */
function onFileListClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const removeButton = target.closest('[data-remove-id]');
  if (removeButton) {
    const removeId = removeButton.getAttribute('data-remove-id');
    if (removeId) {
      removeFromQueue(removeId);
    }
    return;
  }

  const downloadButton = target.closest('[data-download-id]');
  if (downloadButton) {
    const id = downloadButton.getAttribute('data-download-id');
    if (!id) return;
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

/** @returns {Promise<void>} */
async function onDownloadZipClick() {
  if (!runtime.downloadHelpers || typeof runtime.downloadHelpers.downloadZip !== 'function') return;
  await runtime.downloadHelpers.downloadZip();
}

/** @returns {void} */
function onClearFilesClick() {
  clearQueue();
}

/** @returns {void} */
function onAdvancedOptionsChange() {
  updateToolbarStyleControls();
  updateExternalCssControls();
  updateExportFormatControls();
  rebuildSuccessfulOutputs();
}

/** @returns {boolean} */
function supportsNativeHelpDialog() {
  const helpModal = /** @type {HelpDialogElement | null} */ (dom.helpModal);
  return Boolean(helpModal && typeof helpModal.showModal === 'function' && typeof helpModal.close === 'function');
}

/* === EVENT BINDING === */

/** @returns {void} */
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
  document.addEventListener('paste', onPaste);
  dom.autoConvertEnabled?.addEventListener('change', onAutoConvertChange);

  // Help modal events
  dom.helpButton?.addEventListener('click', /** @param {MouseEvent} e */ (e) => {
    e.preventDefault();
    openHelpModal();
  });

  dom.helpButton?.addEventListener('keydown', /** @param {KeyboardEvent} e */ (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openHelpModal();
    }
  });

  dom.helpCloseButton?.addEventListener('click', /** @param {MouseEvent} e */ (e) => {
    e.preventDefault();
    closeHelpModal();
  });

  // Close modal on Escape and click outside; open/close help with '?' shortcut
  document.addEventListener('keydown', /** @param {KeyboardEvent} e */ (e) => {
    // Ignore shortcuts when typing in inputs, textareas, or contenteditable elements
    const tgt = e.target;
    const elementTarget = tgt instanceof HTMLElement ? tgt : null;
    const tag = elementTarget && elementTarget.tagName ? elementTarget.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (elementTarget && elementTarget.isContentEditable)) return;

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

  dom.helpModal?.addEventListener('click', /** @param {MouseEvent} e */ (e) => {
    if (e.target === dom.helpModal) closeHelpModal();
  });

  dom.helpModal?.addEventListener('cancel', /** @param {Event} e */ (e) => {
    e.preventDefault();
    closeHelpModal();
  });

  window.addEventListener('resize', logLayoutMode);
  document.addEventListener('visibilitychange', onDocumentVisibilityChange);
  window.addEventListener('pagehide', onWindowPageHide);

  runtime.listenersBound = true;
}


/* === INIT === */

/**
 * @param {WorkerManagerLike | null | undefined} workerManager
 * @param {UiInitOptions} [options={}]
 * @returns {Promise<void>}
 */
export async function initUI(workerManager, options = {}) {
  const appWindow = /** @type {UiWindow} */ (window);
  try { setLogEnabled(typeof window !== 'undefined' && appWindow && appWindow.LOGGING_ENABLED !== false); } catch (_) {}
  dom.dropzone = /** @type {HTMLElement | null} */ (document.getElementById('dropzone'));
  dom.importButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('importButton'));
  dom.fileInput = /** @type {HTMLInputElement | null} */ (document.getElementById('fileInput'));
  dom.fileList = /** @type {HTMLElement | null} */ (document.getElementById('fileList'));
  dom.statusPanel = /** @type {HTMLElement | null} */ (document.getElementById('statusPanel'));
  dom.appStateBadge = /** @type {HTMLElement | null} */ (document.getElementById('appStateBadge'));
  dom.statusSummary = /** @type {HTMLElement | null} */ (document.getElementById('statusSummary'));
  dom.clearFilesButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('clearFilesButton'));
  dom.downloadZip = /** @type {HTMLButtonElement | null} */ (document.getElementById('downloadZip'));
  dom.convertButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('convertButton'));
  dom.convertButtonWrapper = /** @type {HTMLElement | null} */ (document.querySelector('.convert-button-wrapper'));
  dom.toolbarEnabled = /** @type {HTMLInputElement | null} */ (document.getElementById('toolbarEnabled'));
  dom.toolbarStyleContainer = /** @type {HTMLElement | null} */ (document.getElementById('toolbarStyleContainer'));
  dom.toolbarStyle = /** @type {HTMLSelectElement | null} */ (document.getElementById('toolbarStyle'));
  dom.autoConvertEnabled = /** @type {HTMLInputElement | null} */ (document.getElementById('autoConvertEnabled'));
  dom.externalizeCssEnabled = /** @type {HTMLInputElement | null} */ (document.getElementById('externalizeCssEnabled'));
  dom.externalizeCssMode = /** @type {HTMLSelectElement | null} */ (document.getElementById('externalizeCssMode'));
  dom.experimentalExportEnabled = /** @type {HTMLInputElement | null} */ (document.getElementById('experimentalExportEnabled'));
  dom.exportFormat = /** @type {HTMLSelectElement | null} */ (document.getElementById('exportFormat'));
  dom.markdownFlavor = /** @type {HTMLSelectElement | null} */ (document.getElementById('markdownFlavor'));
  dom.markdownFlavorContainer = /** @type {HTMLElement | null} */ (document.getElementById('markdownFlavorContainer'));
  dom.exportFormatHelp = /** @type {HTMLElement | null} */ (document.getElementById('exportFormatHelp'));
  dom.toolbarStyleHelp = /** @type {HTMLElement | null} */ (document.getElementById('toolbarStyleHelp'));
  dom.convertedPageThemeToggleEnabled = /** @type {HTMLInputElement | null} */ (document.getElementById('convertedPageThemeToggleEnabled'));
  dom.convertedPageThemeHelp = /** @type {HTMLElement | null} */ (document.getElementById('convertedPageThemeHelp'));
  dom.autoConvertNotice = /** @type {HTMLElement | null} */ (document.getElementById('autoConvertNotice'));
  dom.autoConvertNoticeLead = /** @type {HTMLElement | null} */ (document.getElementById('autoConvertNoticeLead'));
  dom.autoConvertNoticeDetail = /** @type {HTMLElement | null} */ (document.getElementById('autoConvertNoticeDetail'));
  dom.diagnosticsPanel = /** @type {HTMLElement | null} */ (document.getElementById('diagnosticsPanel'));
  dom.diagnosticsList = /** @type {HTMLElement | null} */ (document.getElementById('diagnosticsList'));
  dom.diagnosticsCount = /** @type {HTMLElement | null} */ (document.getElementById('diagnosticsCount'));
  dom.helpButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('helpButton'));
  dom.helpModal = /** @type {HelpDialogElement | null} */ (document.getElementById('helpModal'));
  dom.helpCloseButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('helpCloseButton'));


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

  runtime.downloadHelpers = /** @type {DownloadHelpers} */ (createDownloadHelpers({
    successfulOutputs: runtime.successfulOutputs,
    downloadZipButton: dom.downloadZip,
    toolbarEnabled: dom.toolbarEnabled,
    toolbarStyle: dom.toolbarStyle,
    externalizeCssEnabled: dom.externalizeCssEnabled,
    externalizeCssMode: dom.externalizeCssMode,
    experimentalExportEnabled: dom.experimentalExportEnabled,
    exportFormat: dom.exportFormat,
    markdownFlavor: dom.markdownFlavor,
    convertedPageThemeToggleEnabled: dom.convertedPageThemeToggleEnabled
  }, updateZipButton));

  if (appWindow.JSZip) {
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

/** @returns {void} */
function openHelpModal() {
  const helpModal = /** @type {HelpDialogElement | null} */ (dom.helpModal);
  const helpButton = /** @type {HTMLElement | null} */ (dom.helpButton);
  if (!helpModal || !helpButton) return;
  if (supportsNativeHelpDialog()) {
    if (!helpModal.open) {
      helpModal.classList.remove('hidden');
      helpModal.showModal && helpModal.showModal();
    }
  } else {
    helpModal.classList.remove('hidden');
    helpModal.classList.add('flex');
  }
  helpButton.setAttribute('aria-expanded', 'true');
  // focus the close button for keyboard users
  try { dom.helpCloseButton?.focus(); } catch (e) {}
}

/** @returns {void} */
function closeHelpModal() {
  const helpModal = /** @type {HelpDialogElement | null} */ (dom.helpModal);
  const helpButton = /** @type {HTMLElement | null} */ (dom.helpButton);
  if (!helpModal || !helpButton) return;
  if (supportsNativeHelpDialog() && helpModal.open) {
    helpModal.close && helpModal.close();
  }
  helpModal.classList.add('hidden');
  helpModal.classList.remove('flex');
  helpButton.setAttribute('aria-expanded', 'false');
  try { helpButton.focus(); } catch (e) {}
}