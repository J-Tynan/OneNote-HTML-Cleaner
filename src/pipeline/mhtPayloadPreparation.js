import { detectSourceKind } from '../importers/sourceKind.js';

export function preparePipelineInputFromPayload({
  payload = {},
  parseMht,
  enableCharsetLogging
} = {}) {
  const fileName = payload.fileName || payload.relativePath || '';
  const detectedSourceKind = detectSourceKind(fileName, payload.mimetype);
  const sourceKind = payload.sourceKind === 'mht'
    ? 'mht'
    : (payload.sourceKind || (detectedSourceKind === 'mht' ? 'mht' : 'html'));

  let htmlInput = payload.html || '';
  let imageMap = (payload.config && payload.config.imageMap) || {};
  let parseWarnings = [];

  const mhtPreparation = {
    attempted: sourceKind === 'mht',
    parseAvailable: typeof parseMht === 'function',
    parsed: false,
    partsCount: 0,
    boundary: null
  };

  if (mhtPreparation.attempted && mhtPreparation.parseAvailable) {
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