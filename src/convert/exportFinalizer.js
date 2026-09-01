// @ts-check
import { normalizeExportConfig } from '../pipeline/config.js';
import { convertSanitizedHtmlToMarkdown } from './markdownCore.js';

/**
 * @typedef {import('../contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('../contracts.js').PipelineLogEntry} PipelineLogEntry
 * @typedef {import('../contracts.js').PipelineResult} PipelineResult
 * @typedef {import('../contracts.js').WorkerHtmlDoneResponse} WorkerHtmlDoneResponse
 * @typedef {import('../contracts.js').WorkerMarkdownDoneResponse} WorkerMarkdownDoneResponse
 * @typedef {{ config?: PipelineConfigInput, relativePath?: string, fileName?: string }} FinalizePayload
 * @typedef {{ id: string, payload?: FinalizePayload, result?: Partial<PipelineResult> }} FinalizePipelineOutputOptions
 */

/**
 * @param {FinalizePipelineOutputOptions} options
 * @returns {WorkerHtmlDoneResponse | WorkerMarkdownDoneResponse}
 */
export function finalizePipelineOutput({ id, payload = {}, result = {} }) {
  const exportConfig = normalizeExportConfig(payload.config || {});
  const relativePath = payload.relativePath || payload.fileName;
  const logs = /** @type {PipelineLogEntry[]} */ (result.logs || []);
  const outputHtml = typeof result.output === 'string' ? result.output : '';

  if (exportConfig.ExportFormat === 'markdown') {
    const outputMarkdown = convertSanitizedHtmlToMarkdown(outputHtml, {
      flavor: exportConfig.MarkdownFlavor
    });

    return {
      id,
      status: 'done',
      outputText: outputMarkdown,
      outputFormat: 'markdown',
      outputAssets: [],
      relativePath,
      logs
    };
  }

  return {
    id,
    status: 'done',
    outputHtml,
    outputFormat: 'html',
    outputAssets: Array.isArray(result.assets) ? result.assets : [],
    relativePath,
    logs
  };
}