// src/pipeline/mht.js
// Minimal MHT/MHTML parser and image map builder for the PWA pipeline.
// Exports:
//   parseMht(rawText) -> { html: string|null, parts: Array, boundary: string|null, imageMap: Object }
//   decodeQuotedPrintable(text) -> string

function safeSlice(s, n = 200) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function decodeQuotedPrintable(text) {
  if (typeof text !== 'string') return text;
  // Remove soft line breaks
  const cleaned = text.replace(/=\r?\n/g, '');
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(cleaned.charCodeAt(i) & 0xff);
  }

  const u8 = new Uint8Array(bytes);
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(u8);
    } catch {
      // fall through to manual decode
    }
  }

  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function normalizeBase64(b64) {
  if (!b64) return null;
  let s = b64.replace(/\s+/g, '');
  const pad = s.length % 4;
  if (pad !== 0) s += '='.repeat(4 - pad);
  return s;
}

function buildDataUriFromBase64(contentType, b64) {
  if (!b64) return null;
  return `data:${contentType};base64,${b64}`;
}

function parseHeaders(headerBlock) {
  const headers = {};
  const lines = headerBlock.split(/\r?\n/);
  let current = null;
  for (let line of lines) {
    if (/^\s/.test(line) && current) {
      // continuation header line
      headers[current] += ' ' + line.trim();
      continue;
    }
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const name = m[1].trim().toLowerCase();
      const value = m[2].trim();
      headers[name] = value;
      current = name;
    }
  }
  return headers;
}

function addImageKeys(map, p, dataUri) {
  if (!dataUri) return;
  const keys = new Set();

  const loc = (p.ContentLocation || '').trim();
  if (loc) {
    keys.add(loc); // original
    // strip file:/// or file://
    keys.add(loc.replace(/^file:\/+/, ''));
    // strip leading slashes
    keys.add(loc.replace(/^\/+/, ''));
    // URL-decode
    try { keys.add(decodeURIComponent(loc)); } catch {}
    // basename
    try { keys.add((loc.split(/[\/\\]/).pop() || '').trim()); } catch {}
    // also add lower-cased variants
    try { keys.add(loc.toLowerCase()); } catch {}
    try { keys.add((loc.split(/[\/\\]/).pop() || '').trim().toLowerCase()); } catch {}
  }

  // content-id / cid
  if (p.headers && p.headers['content-id']) {
    const cid = p.headers['content-id'].replace(/[<>]/g, '').trim();
    if (cid) {
      keys.add(cid);
      keys.add('cid:' + cid);
    }
  }

  // filename from Content-Disposition
  if (p.headers && p.headers['content-disposition']) {
    const m = p.headers['content-disposition'].match(/filename\s*=\s*["']?([^"';]+)["']?/i);
    if (m && m[1]) {
      keys.add(m[1]);
      keys.add(m[1].toLowerCase());
    }
  }

  // Also try to extract a filename from headers like Content-Location with query params removed
  if (loc) {
    try {
      const q = loc.split('?')[0];
      keys.add(q);
      keys.add(q.split(/[\/\\]/).pop());
    } catch {}
  }

  // Finally add the dataUri under all keys
  for (const k of Array.from(keys)) {
    if (!k) continue;
    map[k] = dataUri;
  }
}

export function parseMht(rawText) {
  try {
    console.log('[mht] parseMht: raw length', rawText ? rawText.length : 0);
    if (!rawText || typeof rawText !== 'string') {
      console.warn('[mht] parseMht: empty or non-string input');
      return { html: null, parts: [], boundary: null, imageMap: {} };
    }

    // Find boundary (look in headers near top)
    const boundaryMatch = rawText.match(/boundary="?([^"\r\n;]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1] : null;
    console.log('[mht] detected boundary:', boundary);

    // Determine separator and split parts
    const sep = boundary ? `--${boundary}` : null;
    const rawParts = sep ? rawText.split(sep) : rawText.split(/\r?\n--[^\r\n]+\r?\n/);
    console.log('[mht] raw parts count (including preamble/epilogue):', rawParts.length);

    const parts = [];
    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i].trim();
      if (!part) continue;
      // Split headers/body at first blank line
      const splitIndex = part.search(/\r?\n\r?\n/);
      let headerBlock = '';
      let body = '';
      if (splitIndex >= 0) {
        headerBlock = part.slice(0, splitIndex);
        body = part.slice(splitIndex).replace(/^\r?\n/, '');
      } else {
        // no headers, treat whole as body
        body = part;
      }
      const headers = parseHeaders(headerBlock);
      const contentType = headers['content-type'] || '';
      const contentLocation = headers['content-location'] || headers['content-location:'] || '';
      const cte = headers['content-transfer-encoding'] || '';
      parts.push({
        index: parts.length,
        headers,
        ContentType: contentType,
        ContentLocation: contentLocation,
        ContentTransferEncoding: cte,
        BodyRaw: body
      });
    }

    console.log('[mht] parsed parts count (non-empty):', parts.length);
    parts.forEach((p, idx) => {
      console.log(`[mht] part ${idx}: type=${p.ContentType} loc=${safeSlice(p.ContentLocation, 80)} cte=${p.ContentTransferEncoding} bodyLen=${p.BodyRaw.length}`);
    });

    // Find HTML part (prefer text/html)
    const htmlPart = parts.find(p => /text\/html/i.test(p.ContentType)) || parts.find(p => /application\/xhtml\+xml/i.test(p.ContentType));
    if (!htmlPart) {
      console.warn('[mht] no text/html part found');
    }

    let html = htmlPart ? htmlPart.BodyRaw : null;

    // If html part exists and is encoded, decode it
    if (htmlPart) {
      const cte = (htmlPart.ContentTransferEncoding || '').toLowerCase();
      if (/quoted-printable/i.test(cte)) {
        console.log('[mht] decoding quoted-printable for HTML part');
        html = decodeQuotedPrintable(html);
      } else if (/base64/i.test(cte)) {
        // base64 HTML is rare; decode to string
        try {
          const b64 = normalizeBase64(html);
          const decoded = atob(b64);
          html = decoded;
          console.log('[mht] decoded base64 HTML part length', html.length);
        } catch (err) {
          console.warn('[mht] base64 decode failed for HTML part', err);
        }
      } else {
        // Some MHTs include headers in the body; strip leading MIME headers if present
        if (/^content-type:/i.test(html.trim())) {
          const idx = html.search(/\r?\n\r?\n/);
          if (idx >= 0) {
            html = html.slice(idx).replace(/^\r?\n/, '');
            console.log('[mht] stripped embedded headers from HTML part');
          }
        }
      }
    }

    // Build image map from parts (images, fonts, octet-stream)
    const imageMap = {};
    for (const p of parts) {
      if (/^(image|font|application\/octet-stream)/i.test(p.ContentType || '')) {
        let dataUri = null;
        const cte = (p.ContentTransferEncoding || '').toLowerCase();
        if (/base64/i.test(cte)) {
          const b64 = normalizeBase64(p.BodyRaw);
          dataUri = buildDataUriFromBase64((p.ContentType || 'application/octet-stream').split(';')[0].trim(), b64);
        } else if (/quoted-printable/i.test(cte)) {
          // decode quoted printable then base64-encode the result for data URI
          const decoded = decodeQuotedPrintable(p.BodyRaw);
          try {
            const b64 = btoa(unescape(encodeURIComponent(decoded)));
            dataUri = buildDataUriFromBase64((p.ContentType || 'application/octet-stream').split(';')[0].trim(), b64);
          } catch (err) {
            console.warn('[mht] failed to base64-encode decoded quoted-printable image', err);
          }
        } else {
          // Try to guess: if body looks like base64, use it
          const maybe = p.BodyRaw.replace(/\s+/g, '');
          if (/^[A-Za-z0-9+/=]+$/.test(maybe) && maybe.length > 100) {
            dataUri = buildDataUriFromBase64((p.ContentType || 'application/octet-stream').split(';')[0].trim(), normalizeBase64(maybe));
          } else {
            // fallback: treat raw bytes as text and base64-encode
            try {
              const b64 = btoa(unescape(encodeURIComponent(p.BodyRaw)));
              dataUri = buildDataUriFromBase64((p.ContentType || 'application/octet-stream').split(';')[0].trim(), b64);
            } catch {
              dataUri = null;
            }
          }
        }

        if (dataUri) {
          addImageKeys(imageMap, p, dataUri);
        }
      }
    }

    console.log('[mht] built imageMap entries:', Object.keys(imageMap).length);
    if (html) {
      console.log('[mht] html preview:', safeSlice(html.replace(/\r?\n/g, '\\n'), 1000));
    }

    return { html, parts, boundary, imageMap };
  } catch (err) {
    console.error('[mht] parseMht unexpected error', err);
    return { html: null, parts: [], boundary: null, imageMap: {} };
  }
}
