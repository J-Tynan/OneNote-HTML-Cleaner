import assert from 'assert';
import { setupNodeTestEnvironment } from './node-test-helper.js';

const { runPipeline } = await import('../src/pipeline/pipeline.js');

await setupNodeTestEnvironment();

console.log('running inline-style-threshold-warning unit tests');

{
  const html = '<!doctype html><html><head><title>Ok</title></head><body><main><h1>Ok</h1><p style="color:red">x</p></main></body></html>';
  const result = await runPipeline(html, {
    InlineStyleWarningEnabled: true,
    InlineStyleWarningMaxNodes: 1000,
    InlineStyleWarningMaxChars: 100000
  });
  const warning = (result.logs || []).find((entry) => entry && entry.step === 'InlineStyleThresholdWarning');
  assert(!warning, 'expected no warning when inline-style volume is under threshold');
}

{
  const html = '<!doctype html><html><head><title>Warn Nodes</title></head><body><main><h1>Warn Nodes</h1><p style="color:red">a</p><p style="color:blue">b</p><p style="color:green">c</p></main></body></html>';
  const result = await runPipeline(html, {
    InlineStyleWarningEnabled: true,
    InlineStyleWarningMaxNodes: 2,
    InlineStyleWarningMaxChars: 1000
  });
  const warning = (result.logs || []).find((entry) => entry && entry.step === 'InlineStyleThresholdWarning');
  assert(warning, 'expected node-threshold warning for excessive inline styles');
  assert((warning.level || '').toLowerCase() === 'warn', 'expected warn level for inline-style threshold warning');
  assert(warning.meta && warning.meta.exceedsNodeThreshold === true, 'expected exceedsNodeThreshold flag to be true');
}

{
  const longStyle = 'font-family:Calibri; font-size:12px; color:#333; margin-top:2px; margin-bottom:2px; padding-left:4px;';
  const html = `<!doctype html><html><head><title>Warn Chars</title></head><body><main><h1>Warn Chars</h1><p style="${longStyle}">a</p></main></body></html>`;
  const result = await runPipeline(html, {
    InlineStyleWarningEnabled: true,
    InlineStyleWarningMaxNodes: 100,
    InlineStyleWarningMaxChars: 10
  });
  const warning = (result.logs || []).find((entry) => entry && entry.step === 'InlineStyleThresholdWarning');
  assert(warning, 'expected char-threshold warning for excessive inline-style text size');
  assert(warning.meta && warning.meta.exceedsCharThreshold === true, 'expected exceedsCharThreshold flag to be true');
}

console.log('inline-style-threshold-warning: PASS');
