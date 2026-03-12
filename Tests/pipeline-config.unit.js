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
  if (typeof mod.normalizeExportConfig !== 'function') {
    fail('normalizeExportConfig not exported from src/pipeline/config.js');
  }
  if (typeof mod.normalizeExportFormat !== 'function') {
    fail('normalizeExportFormat not exported from src/pipeline/config.js');
  }
  if (typeof mod.normalizeMarkdownFlavor !== 'function') {
    fail('normalizeMarkdownFlavor not exported from src/pipeline/config.js');
  }
  if (typeof mod.buildOutputDecorationConfig !== 'function') {
    fail('buildOutputDecorationConfig not exported from src/pipeline/config.js');
  }

  const normalizedProfile = mod.normalizePipelineConfig({
    Profile: 'onenote',
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
    MarkdownFlavor: 'GFM',
    ConvertedPageThemeToggleEnabled: 'true',
    ConvertedPageThemeToggleOledBlack: 'true'
  });

  assert(normalizedProfile.Profile === 'onenote', 'Expected Profile to normalize to onenote');
  assert(normalizedProfile.ToolbarEnabled === true, 'Expected ToolbarEnabled true');
  assert(normalizedProfile.ToolbarEditToggleEnabled === true, 'Expected ToolbarEditToggleEnabled true when toolbar is enabled');
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
  assert(normalizedProfile.ConvertedPageThemeToggleEnabled === true, 'Expected ConvertedPageThemeToggleEnabled true');
  assert(normalizedProfile.ConvertedPageThemeToggleOledBlack === true, 'Expected ConvertedPageThemeToggleOledBlack true');

  const normalizedFallback = mod.normalizePipelineConfig({
    Profile: 'unknown-profile',
    ExternalizeCssEnabled: 'false',
    ExternalizeCssMode: 'invalid',
    OutputCleanupMode: 'unexpected-mode',
    UnitStrategy: 'invalid-unit-strategy',
    ExperimentalExportEnabled: 'false',
    // Unsupported or deferred formats should never escape the config boundary.
    ExportFormat: 'docx',
    MarkdownFlavor: 'not-a-flavor',
    ConvertedPageThemeToggleEnabled: 'false',
    ConvertedPageThemeToggleOledBlack: 'true'
  });

  assert(normalizedFallback.Profile === 'onenote', 'Expected Profile to remain fixed to onenote');
  assert(normalizedFallback.ExternalizeCssEnabled === false, 'Expected ExternalizeCssEnabled false');
  assert(normalizedFallback.ExternalizeCssMode === 'shared', 'Expected invalid ExternalizeCssMode to fallback to shared');
  assert(normalizedFallback.OutputCleanupMode === 'off', 'Expected invalid OutputCleanupMode to fallback to off');
  assert(normalizedFallback.UnitStrategy === 'preserve', 'Expected invalid UnitStrategy to fallback to preserve');
  assert(normalizedFallback.NormalizeDirectionLayout === true, 'Expected NormalizeDirectionLayout default true from preset');
  assert(normalizedFallback.NormalizeTopLevelPageWidths === true, 'Expected NormalizeTopLevelPageWidths default true from preset');
  assert(normalizedFallback.ExperimentalExportEnabled === false, 'Expected ExperimentalExportEnabled false');
  assert(normalizedFallback.ExportFormat === 'html', 'Expected ExportFormat to fallback to html when experiment disabled');
  assert(normalizedFallback.MarkdownFlavor === 'obsidian', 'Expected invalid MarkdownFlavor to fallback to obsidian');
  assert(normalizedFallback.ConvertedPageThemeToggleEnabled === false, 'Expected ConvertedPageThemeToggleEnabled false');
  assert(normalizedFallback.ConvertedPageThemeToggleOledBlack === false, 'Expected ConvertedPageThemeToggleOledBlack false when toggle disabled');

  const normalizedExport = mod.normalizeExportConfig({
    ExperimentalExportEnabled: 'true',
    // Even with experimental export enabled, deferred formats stay quarantined.
    ExportFormat: 'DOCX',
    MarkdownFlavor: 'CommonMark'
  });

  assert(normalizedExport.ExperimentalExportEnabled === true, 'Expected normalizeExportConfig ExperimentalExportEnabled true');
  assert(normalizedExport.ExportFormat === 'html', 'Expected normalizeExportConfig ExportFormat to fall back to html for unsupported formats');
  assert(normalizedExport.MarkdownFlavor === 'commonmark', 'Expected normalizeExportConfig MarkdownFlavor to normalize to commonmark');

  const outputDecorationConfig = mod.buildOutputDecorationConfig({
    ToolbarEnabled: 'true',
    ToolbarEditToggleEnabled: 'false',
    ToolbarMetadataToggleEnabled: 'false',
    ExperimentalExportEnabled: 'true',
    ExportFormat: 'markdown',
    MarkdownFlavor: 'GFM',
    ConvertedPageThemeToggleEnabled: 'true',
    ConvertedPageThemeToggleOledBlack: 'true'
  });

  assert(outputDecorationConfig.ToolbarEnabled === true, 'Expected buildOutputDecorationConfig ToolbarEnabled true');
  assert(outputDecorationConfig.ToolbarEditToggleEnabled === true, 'Expected buildOutputDecorationConfig ToolbarEditToggleEnabled true when toolbar enabled');
  assert(outputDecorationConfig.ToolbarMetadataToggleEnabled === true, 'Expected buildOutputDecorationConfig ToolbarMetadataToggleEnabled true when toolbar enabled');
  assert(outputDecorationConfig.ExportFormat === 'markdown', 'Expected buildOutputDecorationConfig ExportFormat markdown');
  assert(outputDecorationConfig.MarkdownFlavor === 'gfm', 'Expected buildOutputDecorationConfig MarkdownFlavor gfm');
  assert(outputDecorationConfig.ConvertedPageThemeToggleEnabled === false, 'Expected buildOutputDecorationConfig to disable theme toggle for non-HTML exports');
  assert(outputDecorationConfig.ConvertedPageThemeToggleOledBlack === false, 'Expected buildOutputDecorationConfig to disable OLED black for non-HTML exports');

  console.log('pipeline-config: PASS');
}

main().catch((error) => {
  fail(`pipeline-config failed: ${String(error && error.stack ? error.stack : error)}`);
});
