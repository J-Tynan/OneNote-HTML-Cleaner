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

  const normalizedGeneric = mod.normalizePipelineConfig({
    Profile: 'generic',
    ToolbarEnabled: 'true',
    ToolbarEditToggleEnabled: 'false',
    ToolbarMetadataToggleEnabled: 'true',
    ToolbarBundleMode: 'external',
    ExternalizeCssEnabled: 'true',
    ExternalizeCssMode: 'PER-PAGE',
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe'
  });

  assert(normalizedGeneric.Profile === 'generic', 'Expected Profile to normalize to generic');
  assert(normalizedGeneric.ToolbarEnabled === true, 'Expected ToolbarEnabled true');
  assert(normalizedGeneric.ToolbarEditToggleEnabled === false, 'Expected ToolbarEditToggleEnabled false');
  assert(normalizedGeneric.ToolbarMetadataToggleEnabled === true, 'Expected ToolbarMetadataToggleEnabled true');
  assert(normalizedGeneric.ToolbarBundleMode === 'inline', 'Expected ToolbarBundleMode fallback to inline');
  assert(normalizedGeneric.ExternalizeCssEnabled === true, 'Expected ExternalizeCssEnabled true');
  assert(normalizedGeneric.ExternalizeCssMode === 'per-page', 'Expected ExternalizeCssMode to normalize to per-page');
  assert(normalizedGeneric.OutputCleanupMode === 'safe', 'Expected OutputCleanupMode to normalize to safe');
  assert(normalizedGeneric.UnitStrategy === 'normalize-safe', 'Expected UnitStrategy to normalize to normalize-safe');

  const normalizedFallback = mod.normalizePipelineConfig({
    Profile: 'unknown-profile',
    externalizeCssEnabled: 'false',
    externalizeCssMode: 'invalid',
    OutputCleanupMode: 'unexpected-mode',
    UnitStrategy: 'invalid-unit-strategy'
  });

  assert(normalizedFallback.Profile === 'cornell', 'Expected unknown Profile to fallback to cornell');
  assert(normalizedFallback.ExternalizeCssEnabled === false, 'Expected camelCase externalizeCssEnabled false to be respected');
  assert(normalizedFallback.ExternalizeCssMode === 'shared', 'Expected invalid ExternalizeCssMode to fallback to shared');
  assert(normalizedFallback.OutputCleanupMode === 'off', 'Expected invalid OutputCleanupMode to fallback to off');
  assert(normalizedFallback.UnitStrategy === 'preserve', 'Expected invalid UnitStrategy to fallback to preserve');

  console.log('pipeline-config: PASS');
}

main().catch((error) => {
  fail(`pipeline-config failed: ${String(error && error.stack ? error.stack : error)}`);
});
