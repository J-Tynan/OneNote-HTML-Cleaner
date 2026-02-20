import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function countMatches(input, re) {
  const matches = String(input || '').match(re);
  return Array.isArray(matches) ? matches.length : 0;
}

async function main() {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injectorUrl = pathToFileURL(injectorPath).href;
  const mod = await import(injectorUrl);

  if (!mod || typeof mod.injectOutputToolbar !== 'function') {
    fail('Could not import injectOutputToolbar from src/pipeline/toolbarInjector.js');
  }

  const baseHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sample</title></head><body><main><h1>Hello</h1><p>Body</p></main></body></html>';

  const injected = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Sample.mht',
    SourceKind: 'mht',
    Profile: 'cornell',
    WarningSummary: { total: 2, info: 1, warning: 1, error: 0 }
  });

  if (!/id="onenote-cleaner-toolbar"/i.test(injected)) {
    fail('Expected toolbar root to be injected once');
  }
  if (!/data-onc-action="edit-toggle"/i.test(injected)) {
    fail('Expected edit toggle control in injected toolbar');
  }
  if (!/data-onc-action="metadata-toggle"/i.test(injected)) {
    fail('Expected metadata toggle control in injected toolbar');
  }
  if (!/data-onc-action="hide-toolbar"/i.test(injected)) {
    fail('Expected hide control in injected toolbar');
  }

  const injectedAgain = mod.injectOutputToolbar(injected, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline'
  });

  const rootCount = countMatches(injectedAgain, /id="onenote-cleaner-toolbar"/gi);
  const styleCount = countMatches(injectedAgain, /id="onc-toolbar-style"/gi);
  const scriptCount = countMatches(injectedAgain, /id="onc-toolbar-script"/gi);

  if (rootCount !== 1 || styleCount !== 1 || scriptCount !== 1) {
    fail(`Expected idempotent injection (root/style/script exactly once), got root=${rootCount}, style=${styleCount}, script=${scriptCount}`);
  }

  const disabled = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: false,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline'
  });

  if (disabled !== baseHtml) {
    fail('Expected disabled toolbar config to keep output unchanged');
  }

  console.log('toolbar-injector: OK');
}

main().catch((error) => {
  fail(`toolbar-injector failed: ${String(error && error.stack ? error.stack : error)}`);
});
