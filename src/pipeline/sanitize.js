// src/pipeline/sanitize.js
// Lightweight sanitization and head cleanup inspired by the PowerShell script.

export function ensureHead(doc, options = {}) {
  const logs = [];
  let head = doc.querySelector('head');
  if (!head) {
    head = doc.createElement('head');
    const html = doc.querySelector('html') || doc.documentElement;
    html.insertBefore(head, html.firstChild);
    logs.push({ step: 'EnsureHead', details: 'Inserted missing <head>' });
  }

  // Ensure charset
  if (!head.querySelector('meta[charset]')) {
    const m = doc.createElement('meta');
    m.setAttribute('charset', 'utf-8');
    head.prepend(m);
    logs.push({ step: 'EnsureCharset', details: 'Added meta charset' });
  }

  // Ensure viewport
  if (!head.querySelector('meta[name="viewport"]')) {
    const m = doc.createElement('meta');
    m.setAttribute('name', 'viewport');
    m.setAttribute('content', 'width=device-width, initial-scale=1.0');
    head.appendChild(m);
    logs.push({ step: 'EnsureViewport', details: 'Added viewport meta' });
  }

  // Title preservation: if missing, create a minimal title
  if (!head.querySelector('title')) {
    const title = doc.createElement('title');
    title.textContent = options.defaultTitle || 'Document';
    head.appendChild(title);
    logs.push({ step: 'EnsureTitle', details: 'Added default title' });
  }

  return logs;
}

export function removeOneNoteMeta(doc) {
  const logs = [];
  // Remove meta tags or comments that look like OneNote/Word cruft
  const metas = Array.from(doc.querySelectorAll('meta')).filter(m =>
    /one|mso|generator/i.test(m.getAttribute('name') || '') ||
    /mso|word|onenote/i.test(m.getAttribute('content') || '')
  );
  metas.forEach(m => m.remove());
  if (metas.length) logs.push({ step: 'RemoveOneNoteMeta', removed: metas.length });
  return logs;
}

export function sanitizeImageAttributes(doc) {
  const logs = [];
  const imgs = Array.from(doc.querySelectorAll('img'));
  let cleaned = 0;
  imgs.forEach(img => {
    // Quote numeric width/height by ensuring attributes are strings
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');
    if (w !== null && w.trim() === '') { img.removeAttribute('width'); cleaned++; }
    if (h !== null && h.trim() === '') { img.removeAttribute('height'); cleaned++; }
    // Remove MSO inline styles that break responsiveness
    const style = img.getAttribute('style') || '';
    if (/mso-/i.test(style)) {
      const newStyle = style.split(';').filter(s => !/mso-/i.test(s)).join(';');
      img.setAttribute('style', newStyle);
      cleaned++;
    }
  });
  if (cleaned) logs.push({ step: 'SanitizeImages', cleaned });
  return logs;
}

export function removeNbsp(doc) {
  const logs = [];
  if (!doc || typeof doc.createTreeWalker !== 'function') {
    return logs;
  }

  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let updated = 0;

  while (node) {
    const value = node.nodeValue;
    if (value && value.indexOf('\u00a0') !== -1) {
      node.nodeValue = value.replace(/\u00a0/g, ' ');
      updated++;
    }
    node = walker.nextNode();
  }

  if (updated) logs.push({ step: 'RemoveNbsp', updated });
  return logs;
}

export function injectCssLink(doc, cssHref) {
  const head = doc.querySelector('head') || doc.documentElement;
  const link = doc.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', cssHref);
  head.appendChild(link);
  return [{ step: 'InjectCss', details: cssHref }];
}
