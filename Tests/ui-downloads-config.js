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
    conversionProfile: { value: 'generic' },
    toolbarEnabled: { checked: true },
    toolbarEditToggleEnabled: { checked: true },
    toolbarMetadataToggleEnabled: { checked: false },
    downloadZipButton: { disabled: false },
    successfulOutputs: new Map()
  };

  const helpers = mod.createDownloadHelpers(ctx, () => {});
  if (!helpers || typeof helpers.getConversionConfig !== 'function') {
    fail('getConversionConfig not present on helpers');
  }

  const cfg = helpers.getConversionConfig();
  if (cfg.Profile !== 'generic') fail('Expected Profile to be "generic"');
  if (cfg.ToolbarEnabled !== true) fail('Expected ToolbarEnabled true');
  if (cfg.ToolbarEditToggleEnabled !== true) fail('Expected ToolbarEditToggleEnabled true');
  if (cfg.ToolbarMetadataToggleEnabled !== false) fail('Expected ToolbarMetadataToggleEnabled false');

  console.log('ui-downloads-config: OK');
}

main().catch((err) => {
  console.error('ui-downloads-config failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});