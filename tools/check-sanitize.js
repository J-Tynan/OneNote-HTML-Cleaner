import { JSDOM } from 'jsdom';
import { normalizeTableAttributes } from '../src/pipeline/sanitize.js';

function apply(html){
 const dom=new JSDOM(html).window.document;
 const logs=normalizeTableAttributes(dom);
 return {html:dom.documentElement.outerHTML,logs};
}

const input = `<html><body><table border="1" cellpadding="2" cellspacing="3"><tr><td>c</td></tr></table></body></html>`;
console.log(apply(input));
