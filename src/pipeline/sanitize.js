// src/pipeline/sanitize.js
// Lightweight sanitization and head cleanup inspired by the PowerShell script.

export function ensureHead(doc, options = {}) {
  const logs = [];
  let head = doc.querySelector('head');
  const html = doc.querySelector('html') || doc.documentElement;
  if (!head) {
    head = doc.createElement('head');
    html.insertBefore(head, html.firstChild);
    logs.push({ step: 'EnsureHead', details: 'Inserted missing <head>' });
  }

  // Ensure the <html> tag has a lang attribute
  const defaultLang = options.defaultLang || 'en';
  if (html && !html.getAttribute('lang')) {
    html.setAttribute('lang', defaultLang);
    logs.push({ step: 'EnsureLang', details: `Added lang="${defaultLang}" to <html>` });
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

  // Title preservation: if missing or empty, create one using defaultTitle
  let titleEl = head.querySelector('title');
  if (!titleEl) {
    titleEl = doc.createElement('title');
    titleEl.textContent = options.defaultTitle || 'Document';
    head.appendChild(titleEl);
    logs.push({ step: 'EnsureTitle', details: 'Added default title' });
  } else if (!titleEl.textContent || !titleEl.textContent.trim()) {
    titleEl.textContent = options.defaultTitle || 'Document';
    logs.push({ step: 'EnsureTitle', details: 'Set title text to default title' });
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

// Ensure the document contains a <main> landmark and a level-1 heading
export function ensureMainHeading(doc, options = {}) {
  const logs = [];
  const body = doc.body || doc.querySelector('body') || doc.documentElement;
  if (!body) return logs;

  let main = body.querySelector('main');
  if (!main) {
    main = doc.createElement('main');
    // move all existing body children into main
    while (body.firstChild) {
      main.appendChild(body.firstChild);
    }
    body.appendChild(main);
    logs.push({ step: 'EnsureMain', details: 'Wrapped body content in <main>' });
  }

  // ensure there's an <h1> inside main
  let h1 = main.querySelector('h1');
  if (!h1) {
    // try to promote first heading anywhere in body
    const firstHeading = body.querySelector('h1,h2,h3,h4,h5,h6');
    if (firstHeading) {
      // if it's not already h1, change tag
      if (firstHeading.tagName.toLowerCase() !== 'h1') {
        const promoted = doc.createElement('h1');
        promoted.textContent = firstHeading.textContent;
        firstHeading.replaceWith(promoted);
        h1 = promoted;
        logs.push({ step: 'PromoteHeading', details: `Promoted ${firstHeading.tagName} to <h1>` });
        // ensure it's inside main
        if (!main.contains(h1)) {
          main.insertBefore(h1, main.firstChild);
        }
      } else {
        // it is h1 but maybe outside main; move it
        h1 = firstHeading;
        if (!main.contains(h1)) {
          h1.remove();
          main.insertBefore(h1, main.firstChild);
          logs.push({ step: 'MoveH1', details: 'Moved existing <h1> into <main>' });
        }
      }
    } else {
      // no headings at all; create one from defaultTitle
      const newH1 = doc.createElement('h1');
      newH1.textContent = options.defaultTitle || 'Document';
      main.insertBefore(newH1, main.firstChild);
      logs.push({ step: 'EnsureH1', details: 'Inserted default <h1> in <main>' });
    }
  }

  return logs;
}

// repair malformed lists by ensuring only <li> children and wrapping other nodes
export function ensureListStructure(doc) {
  const logs = [];
  const lists = Array.from(doc.querySelectorAll('ul,ol'));
  let fixedCount = 0;
  lists.forEach(list => {
    let changed = false;
    const children = Array.from(list.childNodes);
    children.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag !== 'li') {
          const li = doc.createElement('li');
          li.appendChild(node.cloneNode(true));
          list.replaceChild(li, node);
          changed = true;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent.trim();
        if (txt) {
          const li = doc.createElement('li');
          li.textContent = txt;
          list.replaceChild(li, node);
          changed = true;
        } else {
          list.removeChild(node);
          changed = true;
        }
      }
      // other node types (comments) can be removed
      else if (node.nodeType !== Node.ELEMENT_NODE) {
        list.removeChild(node);
        changed = true;
      }
    });
    if (changed) {
      fixedCount++;
      logs.push({ step: 'EnsureListStructure', details: `Fixed children of <${list.tagName.toLowerCase()}>` });
    }
  });
  if (fixedCount) logs.push({ step: 'EnsureListStructureCount', fixedCount });
  return logs;
}

// Remove inline color/background/font-size declarations from <pre> blocks
export function sanitizePreStyles(doc) {
  const logs = [];
  const nodes = Array.from(doc.querySelectorAll('pre, pre *'));
  let touched = 0;

  nodes.forEach(node => {
    const style = node.getAttribute && node.getAttribute('style');
    if (!style) return;
    const decls = String(style).split(';').map(s => s.trim()).filter(Boolean);
    const kept = decls.filter(d => {
      const prop = d.split(':')[0] && d.split(':')[0].trim().toLowerCase();
      if (!prop) return true;
      if (prop === 'color' || prop === 'background' || prop === 'background-color' || prop === 'font-size') return false;
      return true;
    });
    if (kept.length === decls.length) return;
    if (kept.length) node.setAttribute('style', kept.join('; ')); else node.removeAttribute('style');
    touched++;
  });

  if (touched) logs.push({ step: 'SanitizePreStyles', touched });
  return logs;
}

// Remove inline color/background declarations across the document to improve contrast
export function removeInlineColorDeclarations(doc) {
  const logs = [];
  const nodes = Array.from(doc.querySelectorAll('[style]'));
  let touched = 0;

  nodes.forEach(node => {
    const style = node.getAttribute('style') || '';
    if (!/\bcolor\b|background(?:-color)?/i.test(style)) return;
    const decls = String(style).split(';').map(s => s.trim()).filter(Boolean);
    const kept = decls.filter(d => {
      const prop = d.split(':')[0] && d.split(':')[0].trim().toLowerCase();
      if (!prop) return true;
      if (prop === 'color' || prop === 'background' || prop === 'background-color') return false;
      return true;
    });
    if (kept.length === decls.length) return;
    if (kept.length) node.setAttribute('style', kept.join('; ')); else node.removeAttribute('style');
    touched++;
  });

  if (touched) logs.push({ step: 'RemoveInlineColorDeclarations', touched });
  return logs;
}
