import { normalizeExportConfig } from '../pipeline/config.js';
import { convertSanitizedHtmlToMarkdown } from './markdownCore.js';

export function finalizePipelineOutput({ id, payload = {}, result = {} }) {
  const exportConfig = normalizeExportConfig(payload.config || {});
  const relativePath = payload.relativePath || payload.fileName;
  const logs = result.logs || [];

  if (exportConfig.ExportFormat === 'markdown') {
    const outputMarkdown = convertSanitizedHtmlToMarkdown(result.output || '', {
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
    outputHtml: result.output,
    outputFormat: 'html',
    outputAssets: Array.isArray(result.assets) ? result.assets : [],
    relativePath,
    logs
  };
}