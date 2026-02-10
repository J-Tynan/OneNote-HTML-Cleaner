import { runPipeline } from '../src/pipeline/pipeline.js';

const resultsEl = document.getElementById('results');
const runButton = document.getElementById('run');

runButton.addEventListener('click', async () => {
  resultsEl.textContent = 'Running...';
  try {
    const cases = await loadCases();
    const results = [];
    for (const testCase of cases) {
      const result = await runCase(testCase);
      results.push(result);
    }
    renderResults(results);
  } catch (err) {
    resultsEl.textContent = String(err);
  }
});

async function loadCases() {
  const res = await fetch('./cases.json');
  if (!res.ok) {
    throw new Error('Failed to load cases.json');
  }
  return res.json();
}

async function loadText(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error('Failed to load ' + path);
  }
  return res.text();
}

async function runCase(testCase) {
  const rawInput = await loadText(testCase.input);
  const rawExpected = await loadText(testCase.expected);
  const input = stripLivePreviewScripts(rawInput);
  const expected = stripLivePreviewScripts(rawExpected);
  const { output, logs } = await runPipeline(input, testCase.config || {});
  const sanitizedOutput = stripLivePreviewScripts(output);
  const pass = sanitizedOutput === expected;
  const diff = pass ? '' : describeDiff(sanitizedOutput, expected);
  return {
    name: testCase.name,
    pass,
    diff,
    logs
  };
}

function describeDiff(actual, expected) {
  const index = firstDiffIndex(actual, expected);
  if (index === -1) return 'No diff found.';
  const contextStart = Math.max(0, index - 40);
  const contextEnd = Math.min(actual.length, index + 40);
  return 'Diff at index ' + index + '\n' +
    'Actual:   ' + actual.slice(contextStart, contextEnd) + '\n' +
    'Expected: ' + expected.slice(contextStart, contextEnd);
}

function firstDiffIndex(a, b) {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

function stripLivePreviewScripts(html) {
  if (!html) return html;
  const re1 = /<script[^>]*___vscode_livepreview_injected_script[^>]*>\s*<\/script>/gi;
  const re2 = /<script[^>]*___vscode_livepreview_injected_script[^>]*\/?>/gi;
  return String(html).replace(re1, '').replace(re2, '');
}

function renderResults(results) {
  resultsEl.innerHTML = '';
  const summary = document.createElement('div');
  const passed = results.filter(r => r.pass).length;
  summary.textContent = passed + ' / ' + results.length + ' passing';
  resultsEl.appendChild(summary);

  results.forEach(result => {
    const block = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = result.name + ' - ' + (result.pass ? 'PASS' : 'FAIL');
    title.className = result.pass ? 'pass' : 'fail';
    block.appendChild(title);

    if (!result.pass) {
      const pre = document.createElement('pre');
      pre.textContent = result.diff;
      block.appendChild(pre);
    }

    if (result.logs && result.logs.length) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(result.logs, null, 2);
      block.appendChild(pre);
    }

    resultsEl.appendChild(block);
  });
}
