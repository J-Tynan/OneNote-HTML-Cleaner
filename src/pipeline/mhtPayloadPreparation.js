// @ts-check

import { detectSourceKind } from '../importers/sourceKind.js';

/**
 * @typedef {import('../contracts.js').ImageMap} ImageMap
 * @typedef {import('../contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('../contracts.js').PipelineLogEntry} PipelineLogEntry
 * @typedef {import('../contracts.js').SourceKind} SourceKind
 * @typedef {{ html?: string | null, imageMap?: ImageMap, imageDiagnostics?: PipelineLogEntry[], parts?: unknown[], boundary?: string | null }} MhtParseResult
 * @typedef {{ attempted: boolean, parseAvailable: boolean, parsed: boolean, partsCount: number, boundary: string | null }} MhtPreparation
 * @typedef {(rawText: string, options?: PipelineConfigInput) => MhtParseResult} ParseMhtFn
 * @typedef {{ mhtCharsetLogging?: boolean }} PayloadDebugOptions
 * @typedef {{ imageMap?: ImageMap }} PayloadConfigShape
 * @typedef {{ fileName?: string, relativePath?: string, mimetype?: string, sourceKind?: SourceKind, html?: string, config?: PipelineConfigInput & PayloadConfigShape, debug?: PayloadDebugOptions }} WorkerPayloadLike
 * @typedef {{ fileName: string, sourceKind: SourceKind, htmlInput: string, imageMap: ImageMap, parseWarnings: PipelineLogEntry[], mhtPreparation: MhtPreparation }} PreparedPipelineInput
 * @typedef {{ payload?: WorkerPayloadLike, parseMht?: ParseMhtFn | null, enableCharsetLogging?: (() => void) | null }} PreparePipelineInputOptions
 */

/**
 * @param {PreparePipelineInputOptions} [options={}]
 * @returns {PreparedPipelineInput}
 */
export function preparePipelineInputFromPayload({
  payload = {},
  parseMht,
  enableCharsetLogging
} = {}) {
  const fileName = payload.fileName || payload.relativePath || '';
  const detectedSourceKind = detectSourceKind(fileName, payload.mimetype);
  const sourceKind = payload.sourceKind === 'mht'
    ? 'mht'
    : /** @type {SourceKind} */ (payload.sourceKind || (detectedSourceKind === 'mht' ? 'mht' : 'html'));

  let htmlInput = payload.html || '';
  let imageMap = /** @type {ImageMap} */ ((payload.config && payload.config.imageMap) || {});
  let parseWarnings = /** @type {PipelineLogEntry[]} */ ([]);

  /** @type {MhtPreparation} */
  const mhtPreparation = {
    attempted: sourceKind === 'mht',
    parseAvailable: typeof parseMht === 'function',
    parsed: false,
    partsCount: 0,
    boundary: null
  };

  if (mhtPreparation.attempted && typeof parseMht === 'function') {
    if (payload && payload.debug && payload.debug.mhtCharsetLogging && typeof enableCharsetLogging === 'function') {
      enableCharsetLogging();
    }

    const parsed = parseMht(htmlInput, payload.config || {});
    if (parsed && parsed.html) {
      htmlInput = parsed.html;
      imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
      if (Array.isArray(parsed.imageDiagnostics) && parsed.imageDiagnostics.length) {
        parseWarnings = parseWarnings.concat(parsed.imageDiagnostics);
      }

      mhtPreparation.parsed = true;
      mhtPreparation.partsCount = Array.isArray(parsed.parts) ? parsed.parts.length : 0;
      mhtPreparation.boundary = parsed.boundary || null;
    }
  }

  return {
    fileName,
    sourceKind,
    htmlInput,
    imageMap,
    parseWarnings,
    mhtPreparation
  };
}