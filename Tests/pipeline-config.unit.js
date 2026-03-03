import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function main() {
  const configPath = path.resolve(process.cwd(), 'src', 'pipeline', 'config.js');
  const mod = await import(pathToFileURL(configPath).href);

  if (!mod || typeof mod.normalizePipelineConfig !== 'function') {
    fail('normalizePipelineConfig not exported from src/pipeline/config.js');
  }

  const normalizedProfile = mod.normalizePipelineConfig({
    Profile: 'generic',
    ToolbarEnabled: 'true',
    ToolbarEditToggleEnabled: 'false',
    ToolbarMetadataToggleEnabled: 'true',
    ToolbarBundleMode: 'external',
    ExternalizeCssEnabled: 'true',
    ExternalizeCssMode: 'PER-PAGE',
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe',
    NormalizeDirectionLayout: 'false',
    NormalizeTopLevelPageWidths: 'false',
    ExperimentalExportEnabled: 'true',
    ExportFormat: 'MARKDOWN',
    MarkdownFlavor: 'GFM'
  });

  assert(normalizedProfile.Profile === 'onenote', 'Expected Profile to normalize to onenote');
  assert(normalizedProfile.ToolbarEnabled === true, 'Expected ToolbarEnabled true');
  assert(normalizedProfile.ToolbarEditToggleEnabled === false, 'Expected ToolbarEditToggleEnabled false');
  assert(normalizedProfile.ToolbarMetadataToggleEnabled === true, 'Expected ToolbarMetadataToggleEnabled true');
  assert(normalizedProfile.ToolbarBundleMode === 'inline', 'Expected ToolbarBundleMode fallback to inline');
  assert(normalizedProfile.ExternalizeCssEnabled === true, 'Expected ExternalizeCssEnabled true');
  assert(normalizedProfile.ExternalizeCssMode === 'per-page', 'Expected ExternalizeCssMode to normalize to per-page');
  assert(normalizedProfile.OutputCleanupMode === 'safe', 'Expected OutputCleanupMode to normalize to safe');
  assert(normalizedProfile.UnitStrategy === 'normalize-safe', 'Expected UnitStrategy to normalize to normalize-safe');
  assert(normalizedProfile.NormalizeDirectionLayout === false, 'Expected NormalizeDirectionLayout false');
  assert(normalizedProfile.NormalizeTopLevelPageWidths === false, 'Expected NormalizeTopLevelPageWidths false');
  assert(normalizedProfile.ExperimentalExportEnabled === true, 'Expected ExperimentalExportEnabled true');
  assert(normalizedProfile.ExportFormat === 'markdown', 'Expected ExportFormat to normalize to markdown');
  assert(normalizedProfile.MarkdownFlavor === 'gfm', 'Expected MarkdownFlavor to normalize to gfm');

  const normalizedFallback = mod.normalizePipelineConfig({
    Profile: 'unknown-profile',
    externalizeCssEnabled: 'false',
    externalizeCssMode: 'invalid',
    OutputCleanupMode: 'unexpected-mode',
    UnitStrategy: 'invalid-unit-strategy',
    ExperimentalExportEnabled: 'false',
    ExportFormat: 'docx',
    MarkdownFlavor: 'not-a-flavor'
  });

  assert(normalizedFallback.Profile === 'onenote', 'Expected unknown Profile to fallback to onenote');
  assert(normalizedFallback.ExternalizeCssEnabled === false, 'Expected camelCase externalizeCssEnabled false to be respected');
  assert(normalizedFallback.ExternalizeCssMode === 'shared', 'Expected invalid ExternalizeCssMode to fallback to shared');
  assert(normalizedFallback.OutputCleanupMode === 'off', 'Expected invalid OutputCleanupMode to fallback to off');
  assert(normalizedFallback.UnitStrategy === 'preserve', 'Expected invalid UnitStrategy to fallback to preserve');
  assert(normalizedFallback.NormalizeDirectionLayout === true, 'Expected NormalizeDirectionLayout default true from preset');
  assert(normalizedFallback.NormalizeTopLevelPageWidths === true, 'Expected NormalizeTopLevelPageWidths default true from preset');
  assert(normalizedFallback.ExperimentalExportEnabled === false, 'Expected ExperimentalExportEnabled false');
  assert(normalizedFallback.ExportFormat === 'html', 'Expected ExportFormat to fallback to html when experiment disabled');
  assert(normalizedFallback.MarkdownFlavor === 'obsidian', 'Expected invalid MarkdownFlavor to fallback to obsidian');

  console.log('pipeline-config: PASS');
}

main().catch((error) => {
  fail(`pipeline-config failed: ${String(error && error.stack ? error.stack : error)}`);
});
