import assert from 'assert';
import { JSDOM } from 'jsdom';

// This mirrors the check performed by the native smoke test (see
// Tests/smoke-native.js).  We keep the logic local here so that the unit
// test can exercise it without importing the entire smoke script.
function detectFauxList(html) {
  const { window: { document } } = new JSDOM(html);
  for (const el of document.querySelectorAll('p,div,td,th')) {
    if (el.closest('li,pre,code')) continue; // ignore real lists/code
    if (el.querySelector('pre,code')) continue; // skip containers with code
    const text = el.textContent.trim();
    if (/^([-*•\u2022\u00B7]|\d+[.)])\s+(?!\[[ xX]\])/.test(text)) {
      return text.split('\n')[0].trim();
    }
  }
  return null;
}

console.log('running list-fidelity unit tests');

function check(html, shouldFail) {
  const result = detectFauxList(html);
  if (shouldFail) {
    assert(result, `expected failure but got none for HTML: ${html}`);
  } else {
    assert(!result, `unexpected detection of faux list: ${result} for HTML: ${html}`);
  }
}

// cases that should trigger a failure
check('<p>- item</p>', true);
check('<div>• bullet</div>', true);
check('<table><tr><td>1. first</td></tr></table>', true); // table cell should be checked
check('<p>3) nested</p>', true);
check('<p>* foo</p>', true);

// allowed cases
check('<p>- [x] done</p>', false);
check('<p>- [ ] undone</p>', false);
check('<p>normal paragraph</p>', false);
check('<ul><li>- item</li></ul>', false);
check('<pre>- item</pre>', false);
check('<p><code>- item</code></p>', false);

console.log('list-fidelity: PASS');
