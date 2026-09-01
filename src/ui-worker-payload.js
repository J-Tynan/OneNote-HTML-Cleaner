// @ts-check
import { detectSourceKind } from './importers/sourceKind.js';

/**
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('./contracts.js').SourceKind} SourceKind
 * @typedef {import('./contracts.js').WorkerQueuedPayload} WorkerQueuedPayload
 * @typedef {{ id: string, name: string, file: File }} WorkerPayloadQueueEntry
 * @typedef {{ sourceKind: SourceKind, payload: WorkerQueuedPayload & { fileName: string, relativePath: string, mimetype: string, sourceKind: SourceKind, config: PipelineConfigInput } }} WorkerPayloadBuildResult
 */

/**
 * @param {WorkerPayloadQueueEntry} entry
 * @param {PipelineConfigInput} conversionConfig
 * @returns {WorkerPayloadBuildResult}
 */
export function buildWorkerPayloadForEntry(entry, conversionConfig) {
  const sourceKind = detectSourceKind(entry.name, entry.file.type);

  return {
    sourceKind,
    payload: {
      id: entry.id,
      fileName: entry.name,
      relativePath: entry.name,
      mimetype: entry.file.type || '',
      sourceKind,
      config: conversionConfig
    }
  };
}