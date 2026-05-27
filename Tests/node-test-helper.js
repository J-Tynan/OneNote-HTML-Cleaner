import { JSDOM } from 'jsdom';

export function ensureDomParserGlobals() {
  if (typeof global.DOMParser !== 'undefined' || typeof DOMParser !== 'undefined') {
    return;
  }

  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

export async function disableTestLogging() {
  const { setEnabled } = await import('../src/logging.js');
  setEnabled(false);
}

export async function setupNodeTestEnvironment(options = {}) {
  const { disableLogging = true } = options;
  ensureDomParserGlobals();
  if (disableLogging) {
    await disableTestLogging();
  }
}

export function normalizeHtmlForDiff(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function firstDiffIndex(left, right) {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }
  return -1;
}