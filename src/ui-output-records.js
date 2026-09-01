// @ts-check
import { buildExportFileName } from './export-filenames.js';

/**
 * @typedef {import('./contracts.js').OutputAsset} OutputAsset
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {'html' | 'markdown'} EntryOutputFormat
 * @typedef {'queued' | 'working' | 'success' | 'error' | 'unsupported' | 'neutral'} StatusTone
 * @typedef {{ name?: string, status?: string, outputHtml?: string, outputText?: string, outputFormat?: string, outputAssets?: OutputAsset[], conversionConfig?: PipelineConfigInput | null, downloadFileName?: string }} QueueOutputEntry
 * @typedef {{ content: string, format: EntryOutputFormat, assets: OutputAsset[], config: PipelineConfigInput | null }} SuccessfulOutputRecord
 * @typedef {{ filename: string, record: SuccessfulOutputRecord }} SuccessfulOutputBuildResult
 */

/**
 * @param {unknown} status
 * @returns {StatusTone}
 */
export function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'working' || normalized === 'processing' || normalized === 'in-progress') return 'working';
  if (normalized === 'success' || normalized === 'completed' || normalized === 'done') return 'success';
  if (normalized === 'error' || normalized === 'failed') return 'error';
  if (normalized === 'unsupported') return 'unsupported';
  return 'neutral';
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
export function isSuccessStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'success' || normalized === 'completed';
}

/**
 * @param {QueueOutputEntry | null | undefined} entry
 * @returns {boolean}
 */
export function hasExternalizedCssAsset(entry) {
  if (!entry || !Array.isArray(entry.outputAssets)) return false;
  return entry.outputAssets.some((asset) => asset
    && asset.type === 'text/css'
    && typeof asset.content === 'string'
    && asset.content.trim().length > 0);
}

/**
 * @param {QueueOutputEntry | null | undefined} entry
 * @returns {EntryOutputFormat}
 */
export function getEntryOutputFormat(entry) {
  if (entry && typeof entry.outputFormat === 'string') {
    return entry.outputFormat === 'markdown' ? 'markdown' : 'html';
  }
  if (typeof entry?.outputText === 'string' && entry.outputText.length > 0) {
    return 'markdown';
  }
  return 'html';
}

/**
 * @param {QueueOutputEntry | null | undefined} entry
 * @returns {string}
 */
export function getEntryOutputContent(entry) {
  const format = getEntryOutputFormat(entry);
  if (format === 'markdown') {
    return typeof entry?.outputText === 'string' ? entry.outputText : '';
  }
  return typeof entry?.outputHtml === 'string' ? entry.outputHtml : '';
}

/**
 * @param {QueueOutputEntry | null | undefined} entry
 * @returns {string}
 */
export function getEntryDownloadFileName(entry) {
  if (typeof entry?.downloadFileName === 'string' && entry.downloadFileName) {
    return entry.downloadFileName;
  }

  return buildExportFileName({
    entryName: entry?.name || 'output',
    outputFormat: getEntryOutputFormat(entry),
    outputContent: getEntryOutputContent(entry)
  });
}

/**
 * @param {QueueOutputEntry | null | undefined} entry
 * @returns {string}
 */
export function getEntryDownloadMime(entry) {
  return getEntryOutputFormat(entry) === 'markdown' ? 'text/markdown' : 'text/html';
}

/**
 * @param {QueueOutputEntry} entry
 * @param {Map<string, unknown>} takenNames
 * @returns {SuccessfulOutputBuildResult | null}
 */
export function buildSuccessfulOutputRecord(entry, takenNames) {
  if (!isSuccessStatus(entry.status)) return null;
  const content = getEntryOutputContent(entry);
  if (!content) return null;

  const format = getEntryOutputFormat(entry);
  const filename = buildExportFileName({
    entryName: entry.name || 'output',
    outputFormat: format,
    outputContent: content,
    takenNames
  });

  return {
    filename,
    record: {
      content,
      format,
      assets: Array.isArray(entry.outputAssets) ? entry.outputAssets : [],
      config: entry.conversionConfig || null
    }
  };
}