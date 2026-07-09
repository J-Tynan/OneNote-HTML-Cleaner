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
import { createLogger } from '../logging.js';
const logger = createLogger('images');

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
  try {
    const withoutQuery = raw.split(/[?#]/)[0];
    c.add(withoutQuery);
    const cleanedParts = withoutQuery.split(/[\/\\]/);
    const cleanedBase = cleanedParts[cleanedParts.length - 1];
    if (cleanedBase) {
      c.add(cleanedBase);
      c.add(cleanedBase.toLowerCase());
    }
  } catch {}

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

function shouldTrackUnresolvedResource(node, attr, val) {
  if (!val) return false;

  if (attr === 'src') return true;

  const raw = String(val).trim();
  if (/^(cid:|file:\/\/\/)/i.test(raw)) return true;
  if (/\.(?:png|jpe?g|gif|webp|svg|bmp|ico|tiff?|avif|woff2?|woff|ttf|otf|eot)(?:[?#].*)?$/i.test(raw)) {
    return true;
  }

  const tagName = node && node.tagName ? String(node.tagName).toLowerCase() : '';
  return tagName === 'a';
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
  let unresolved = 0;
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
    if (shouldTrackUnresolvedResource(node, attr, val)) {
      if (unmatchedSamples.length < 10) unmatchedSamples.push(val);
      unresolved += 1;
    }
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
        logger.warn({ msg: 'error processing node for', meta: { attr, error: String(err) } });
      }
    });
  });

  if (replacements) logs.push({ step: 'embedImages', replacements });

  if (unresolved > 0) {
    logs.push({
      step: 'embedImagesUnresolved',
      level: 'warn',
      unresolved,
      samples: unmatchedSamples.slice(0, 5)
    });
  }

  // If no replacements were made, provide a small diagnostic sample to help debugging
  if (replacements === 0 && unmatchedSamples.length > 0) {
    logger.warn({ msg: 'no image replacements made; sample src/href values', meta: { samples: unmatchedSamples.slice(0, 5) } });
  }

  return logs;
}
