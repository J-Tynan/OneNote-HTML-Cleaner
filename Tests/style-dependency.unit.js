import assert from 'node:assert';
import { analyzeHtml } from './check-forbidden-artifacts.js';

console.log('running style-dependency unit tests');

function hasType(result, type) {
  return result.violations.some((entry) => entry.type === type);
}

{
  const html = '<html><body><p class="MsoNormal">hello</p></body></html>';
  const result = analyzeHtml('mso-class.html', html);
  assert(!result.ok, 'Mso class token should fail dependency check');
  assert(hasType(result, 'office-class-token'), 'Expected office-class-token violation');
}

{
  const html = '<html><body><p style="tab-stops:list 36.0pt;color:#333">hello</p></body></html>';
  const result = analyzeHtml('tab-stops.html', html);
  assert(!result.ok, 'Office tab-stops declaration should fail dependency check');
  assert(hasType(result, 'office-style-declaration'), 'Expected office-style-declaration violation');
}

{
  const html = '<html><body><!--[if gte mso 9]><p>x</p><![endif]--></body></html>';
  const result = analyzeHtml('mso-comment.html', html);
  assert(!result.ok, 'MSO conditional comments should fail dependency check');
  assert(hasType(result, 'office-conditional-comment'), 'Expected office-conditional-comment violation');
}

{
  const html = '<html><body><p class="notes" style="color:#333;font-size:16px">hello</p></body></html>';
  const result = analyzeHtml('authored-style.html', html);
  assert(result.ok, 'Authored non-office styles/classes should pass dependency check');
}

console.log('style-dependency: PASS');