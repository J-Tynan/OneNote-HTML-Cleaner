import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const modPath = path.resolve(process.cwd(), 'src', 'ui-downloads.js');
  const mod = await import(pathToFileURL(modPath).href);
  if (!mod || typeof mod.createDownloadHelpers !== 'function') {
    fail('createDownloadHelpers not exported from src/ui-downloads.js');
  }

  const ctx = {
    toolbarEnabled: { checked: true },
    toolbarEditToggleEnabled: { checked: true },
    toolbarMetadataToggleEnabled: { checked: false },
    externalizeCssEnabled: { checked: true },
    externalizeCssMode: { value: 'per-page' },
    experimentalExportEnabled: { checked: true },
    exportFormat: { value: 'markdown' },
    markdownFlavor: { value: 'gfm' },
    downloadZipButton: { disabled: false },
    successfulOutputs: new Map()
  };

  const helpers = mod.createDownloadHelpers(ctx, () => {});
  if (!helpers || typeof helpers.getConversionConfig !== 'function') {
    fail('getConversionConfig not present on helpers');
  }

  const cfg = helpers.getConversionConfig();
  if (cfg.Profile !== 'onenote') fail('Expected Profile to be "onenote"');
  if (cfg.ToolbarEnabled !== true) fail('Expected ToolbarEnabled true');
  if (cfg.ToolbarEditToggleEnabled !== true) fail('Expected ToolbarEditToggleEnabled true');
  if (cfg.ToolbarMetadataToggleEnabled !== false) fail('Expected ToolbarMetadataToggleEnabled false');
  if (cfg.ExternalizeCssEnabled !== true) fail('Expected ExternalizeCssEnabled true');
  if (cfg.ExternalizeCssMode !== 'per-page') fail('Expected ExternalizeCssMode to be "per-page"');
  if (cfg.ExperimentalExportEnabled !== true) fail('Expected ExperimentalExportEnabled true');
  if (cfg.ExportFormat !== 'markdown') fail('Expected ExportFormat to be "markdown" when experimental is enabled');
  if (cfg.MarkdownFlavor !== 'gfm') fail('Expected MarkdownFlavor to be "gfm"');

  ctx.experimentalExportEnabled.checked = false;
  const cfgFallback = helpers.getConversionConfig();
  if (cfgFallback.ExportFormat !== 'html') fail('Expected ExportFormat fallback to "html" when experimental is disabled');

  console.log('ui-downloads-config: OK');
}

main().catch((err) => {
  console.error('ui-downloads-config failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});