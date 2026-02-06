// src/pipeline/images.js
// Image map helpers and tolerant embedding for MHT -> HTML pipeline.
// Exports:
//  - buildImageMapFromHtml(html, basePath)  // lightweight stub (kept for compatibility)
//  - embedImagesInHtml(doc, map) -> Array of logs

/**
 * buildImageMapFromHtml
 * Minimal stub kept for compatibility with pipeline; real mapping comes from parseMht.
 * Returns an empty map by default.
 */
export function buildImageMapFromHtml(html, basePath = '') {
  // In some flows you may want to scan the HTML for relative image references
  // and attempt to resolve them against basePath using the File System Access API.
  // For now return an empty map; parseMht builds a richer map for MHT inputs.
  return {};
}

/**
 * Generate candidate keys for a given src/href value so we can match
 * against the imageMap keys produced by parseMht (which include many variants).
 */
function candidatesFor(val) {
  if (!val) return [];
  const c = new Set();

  const raw = String(val).trim();
  c.add(raw);

  // Try URL-decoded form
  try { c.add(decodeURIComponent(raw)); } catch {}

  // Strip file: scheme
  c.add(raw.replace(/^file:\/+/, ''));
  // Strip leading slashes
  c.add(raw.replace(/^\/+/, ''));

  // Remove query string and fragment
  try { c.add(raw.split(/[?#]/)[0]); } catch {}

  // Basename (filename only)
  try {
    const parts = raw.split(/[\/\\]/);
    const base = parts[parts.length - 1];
    if (base) {
      c.add(base);
      c.add(base.toLowerCase());
    }
  } catch {}

  // Lowercase variants
  try { c.add(raw.toLowerCase()); } catch {}

  // cid variants
  try {
    const parts = raw.split(/[\/\\]/);
    const base = parts[parts.length - 1];
    if (base && !/^cid:/i.test(raw)) {
      c.add('cid:' + base);
      c.add(base.replace(/^</, '').replace(/>$/, ''));
    }
  } catch {}

  return Array.from(c).filter(Boolean);
}

/**
 * embedImagesInHtml
 * Replaces src/href attributes in the provided Document using the provided map.
 * The map keys may include many variants (full file:// paths, relative paths, basenames, cid: ids).
 *
 * Returns an array of log entries (empty if nothing changed).
 */
export function embedImagesInHtml(doc, map = {}) {
  const logs = [];
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return logs;
  }

  let replacements = 0;
  const unmatchedSamples = [];

  function tryReplaceAttr(node, attr) {
    const val = node.getAttribute(attr);
    if (!val) return false;
    const cands = candidatesFor(val);
    for (const key of cands) {
      if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) {
        node.setAttribute(attr, map[key]);
        return true;
      }
    }
    // record a sample of unmatched values for diagnostics
    if (unmatchedSamples.length < 10) unmatchedSamples.push(val);
    return false;
  }

  // Attributes to consider for embedding
  const attrs = ['src', 'href'];

  attrs.forEach(attr => {
    const nodes = Array.from(doc.querySelectorAll('[' + attr + ']'));
    nodes.forEach(n => {
      try {
        const replaced = tryReplaceAttr(n, attr);
        if (replaced) replacements++;
      } catch (err) {
        // Non-fatal: continue processing other nodes
        console.warn('[images] error processing node for', attr, err);
      }
    });
  });

  if (replacements) logs.push({ step: 'embedImages', replacements });

  // If no replacements were made, provide a small diagnostic sample to help debugging
  if (replacements === 0 && unmatchedSamples.length > 0) {
    console.warn('[images] no image replacements made; sample src/href values:', unmatchedSamples.slice(0, 5));
    logs.push({ step: 'embedImages', replacements: 0, sampleUnmatched: unmatchedSamples.slice(0, 5) });
  }

  return logs;
}
