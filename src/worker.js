// src/worker.js
import { runPipeline } from './pipeline/pipeline.js';
import { parseMht } from './pipeline/mht.js';
import { detectSourceKind } from './importers/sourceKind.js';
import { importOneSection } from './importers/one.js';
import { importOnePackage } from './importers/onepkg.js';

self.onmessage = async (e) => {
  const payload = e.data;
  const id = payload.id || crypto.randomUUID();
  const fileName = payload.fileName || payload.relativePath || 'unknown';
  const sourceKind = payload.sourceKind || detectSourceKind(fileName, payload.mimetype);

  console.log(`[worker] received job id=${id} file=${fileName}`);

  try {
    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      self.postMessage({ id, status: 'progress', step: 'inspect-native', percent: 10 });
      const bytes = payload.bytes;
      let nativeResult;

      if (sourceKind === 'one') {
        nativeResult = importOneSection(bytes, { fileName });
      } else {
        nativeResult = importOnePackage(bytes, { fileName });
      }

      self.postMessage({
        id,
        status: 'done',
        resultType: 'native',
        nativeResult,
        relativePath: payload.relativePath || payload.fileName,
        logs: []
      });
      return;
    }

    const hasDOMParser = (typeof DOMParser !== 'undefined');
    console.log(`[worker] DOMParser available: ${hasDOMParser}`);

    if (!hasDOMParser) {
      self.postMessage({ id, status: 'unsupported', reason: 'DOMParser not available in worker' });
      return;
    }

    let htmlInput = payload.html || '';
    let imageMap = (payload.config && payload.config.imageMap) || {};

    // If filename indicates MHT/MHTML, attempt to parse it here in the worker
    if (sourceKind === 'mht') {
      console.log('[worker] detected MHT input, attempting parseMht in worker');
      const parsed = parseMht(htmlInput);
      if (parsed && parsed.html) {
        htmlInput = parsed.html;
        imageMap = Object.assign({}, imageMap, parsed.imageMap || {});
        console.log(`[worker] parseMht: html length=${htmlInput.length} parts=${parsed.parts.length} boundary=${parsed.boundary}`);
      } else {
        console.warn('[worker] parseMht did not return HTML; continuing with original payload.html');
      }
    }

    self.postMessage({ id, status: 'progress', step: 'start', percent: 0 });
    const result = await runPipeline(htmlInput, Object.assign({}, payload.config || {}, { imageMap }));
    console.log(`[worker] job ${id} done, output length=${String((result.output || '').length)}`);
    self.postMessage({
      id,
      status: 'done',
      outputHtml: result.output,
      relativePath: payload.relativePath || payload.fileName,
      logs: result.logs || []
    });
  } catch (err) {
    console.error(`[worker] job ${id} error:`, err);
    self.postMessage({ id, status: 'error', error: String(err) });
  }
};
