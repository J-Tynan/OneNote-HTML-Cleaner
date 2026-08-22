import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

function parseOutput(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

console.log('running export styles mode unit tests');

{
  const input = '<!doctype html><html><head><title>x</title></head><body><p>Hello</p></body></html>';
  const { output } = await runPipeline(input, { defaultTitle: 'Doc' });
  const doc = parseOutput(output);
  const link = doc.querySelector('link[rel="stylesheet"]');
  const loader = doc.querySelector('script[data-onc-export-styles-loader="v1"]');

  assert(link, 'default export should still inject a stylesheet link');
  assert.equal(link.getAttribute('href'), 'assets/tailwind-output.css', 'default export should keep the current tailwind stylesheet href');
  assert.equal(loader, null, 'default export should not inject the deferred styles loader');
}

{
  const input = '<!doctype html><html><head><title>x</title></head><body><p>Hello</p></body></html>';
  const { output } = await runPipeline(input, {
    defaultTitle: 'Doc',
    ExportStylesMode: 'deferred'
  });
  const doc = parseOutput(output);
  const link = doc.querySelector('link[rel="stylesheet"]');
  const loader = doc.querySelector('script[data-onc-export-styles-loader="v1"]');

  assert.equal(link, null, 'deferred export mode should skip the tailwind stylesheet link');
  assert(loader, 'deferred export mode should inject the enhancement loader');
  assert(loader.textContent.includes('styles.css'), 'deferred export mode should target same-folder styles.css');
  assert(loader.textContent.includes("h.className+=' enhanced'"), 'deferred export mode should still activate optional shared enhancement styling after styles.css loads');
}

{
  const input = '<!doctype html><html><head><title>x</title></head><body><p>Hello</p></body></html>';
  const { output } = await runPipeline(input, {
    defaultTitle: 'Doc',
    ExportStylesMode: 'deferred',
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ConvertedPageThemeToggleEnabled: true
  });
  const doc = parseOutput(output);
  const toolbarStyle = doc.querySelector('#onc-toolbar-style');
  const themeStyle = doc.querySelector('#onc-converted-theme-style');
  const toolbarScript = doc.querySelector('#onc-toolbar-script');
  const themeScript = doc.querySelector('#onc-converted-theme-script');
  const toolbarMetadata = doc.querySelector('#onc-toolbar-metadata');
  const showButton = doc.querySelector('#onc-toolbar-show');
  const toggle = doc.querySelector('#onc-converted-theme-toggle');

  assert(toolbarStyle, 'deferred export mode should inline toolbar CSS when toolbar injection is enabled');
  assert(themeStyle, 'deferred export mode should inline theme CSS when the converted-page theme toggle is enabled');
  assert(toolbarScript, 'deferred export mode should keep toolbar behavior script inline for standalone exports');
  assert(themeScript, 'deferred export mode should keep theme behavior script inline for standalone exports');
  assert(toolbarMetadata, 'deferred export mode should keep toolbar metadata available to the inline enhancement script');
  assert(showButton && !showButton.hasAttribute('hidden'), 'deferred export mode should keep the reveal button visible for standalone exports');
  assert(toggle && !toggle.hasAttribute('hidden'), 'deferred export mode should keep the theme toggle visible for standalone exports');
}

{
  const input = '<!doctype html><html><head><title>x</title></head><body><p>Hello</p></body></html>';
  const first = await runPipeline(input, {
    defaultTitle: 'Doc',
    ExportStylesMode: 'deferred'
  });
  const second = await runPipeline(first.output, {
    defaultTitle: 'Doc',
    ExportStylesMode: 'deferred'
  });
  const doc = parseOutput(second.output);
  const loaders = doc.querySelectorAll('script[data-onc-export-styles-loader="v1"]');

  assert.equal(loaders.length, 1, 'deferred export loader should be idempotent across reruns');
}

console.log('export-styles-mode: PASS');