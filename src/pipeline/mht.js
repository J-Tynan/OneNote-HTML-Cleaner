// src/pipeline/mht.js
// Minimal MHT/MHTML parser and image map builder for the PWA pipeline.
// Exports:
//   parseMht(rawText, options={}) -> { html: string|null, parts: Array, boundary: string|null, imageMap: Object,
//       controlCharDiagnostics?, controlCharSanitized?,
//       parts[].BodyRawStart?, parts[].BodyDecodedMapping? }
//   options.EnableMapping - when truthy, each part will include BodyDecodedMapping and
//       diagnostics.samples will gain rawTextOffset values.  Falls back to default when
//       unspecified.
//
//   decodeQuotedPrintable(text[, {withMapping:true}]) -> string | {text,mapping}

function safeSlice(s, n = 200) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// decodeQuotedPrintable(text, opts={})
//   opts.charset - "utf-8" (default) or "windows-1252"/"cp1252"
//   opts.withMapping - when true returns {text,mapping} instead of string
export function decodeQuotedPrintable(text, opts = {}) {
  if (typeof text !== 'string') return text;
  const charset = (opts.charset || 'utf-8').toLowerCase();
  const wantMap = opts.withMapping || false;

  const byteList = [];
  const inputIndexForByte = wantMap ? [] : null;

  // iterate original text so we can correlate bytes with source indices
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // soft line break ="=\r?\n"; skip these bytes entirely
    if (ch === '=' && i + 1 < text.length && text[i+1] === '\r' && text[i+2] === '\n') {
      i += 2;
      continue;
    }
    if (ch === '=' && i + 2 < text.length) {
      const hex = text.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        byteList.push(parseInt(hex, 16));
        if (wantMap) inputIndexForByte.push(i);
        i += 2;
        continue;
      }
    }
    byteList.push(text.charCodeAt(i) & 0xff);
    if (wantMap) inputIndexForByte.push(i);
  }

  const u8 = new Uint8Array(byteList);
  let decoded;

  // helper for CP1252 single-byte decode
  function cp1252Decode(bytes) {
    const cpMap = {
      0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E,
      0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6,
      0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
      0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
      0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
      0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
      0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178
    };
    let out = '';
    for (let b of bytes) {
      let code = b;
      if (b >= 0x80 && b <= 0x9f) {
        code = cpMap[b] || b;
      }
      out += String.fromCharCode(code);
    }
    return out;
  }

  // decoding with or without mapping
  if (wantMap) {
    const mapping = [];
    let out = '';
    if (charset === 'utf-8' && typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      for (let bi = 0; bi < u8.length; bi++) {
        const ch = decoder.decode(u8.subarray(bi, bi + 1), { stream: true });
        if (ch) {
          for (let j = 0; j < ch.length; j++) {
            mapping[out.length + j] = inputIndexForByte[bi];
          }
          out += ch;
        }
      }
      const tail = decoder.decode();
      if (tail) {
        for (let j = 0; j < tail.length; j++) {
          mapping[out.length + j] = inputIndexForByte[u8.length - 1];
        }
        out += tail;
      }
    } else if (charset === 'windows-1252' || charset === 'cp1252') {
      // single-byte decode
      for (let bi = 0; bi < u8.length; bi++) {
        out += cp1252Decode([u8[bi]]);
        mapping[out.length - 1] = inputIndexForByte[bi];
      }
    } else {
      // unknown charset: fall back to utf-8 streaming
      if (typeof TextDecoder !== 'undefined') {
        const decoder = new TextDecoder(charset, { fatal: false });
        for (let bi = 0; bi < u8.length; bi++) {
          const ch = decoder.decode(u8.subarray(bi, bi + 1), { stream: true });
          if (ch) {
            for (let j = 0; j < ch.length; j++) {
              mapping[out.length + j] = inputIndexForByte[bi];
            }
            out += ch;
          }
        }
        const tail = decoder.decode();
        if (tail) {
          for (let j = 0; j < tail.length; j++) {
            mapping[out.length + j] = inputIndexForByte[u8.length - 1];
          }
          out += tail;
        }
      } else {
        for (let bi = 0; bi < u8.length; bi++) {
          out += String.fromCharCode(u8[bi]);
          mapping[out.length - 1] = inputIndexForByte[bi];
        }
      }
    }
    decoded = out;
    return { text: decoded, mapping };
  } else {
    if (charset === 'windows-1252' || charset === 'cp1252') {
      decoded = cp1252Decode(u8);
    } else if (typeof TextDecoder !== 'undefined') {
      try {
        decoded = new TextDecoder(charset || 'utf-8', { fatal: false }).decode(u8);
      } catch {
        // fall through
      }
    }

    if (decoded === undefined) {
      let out = '';
      for (let i = 0; i < byteList.length; i++) {
        out += String.fromCharCode(byteList[i]);
      }
      decoded = out;
    }
  }

  if (!wantMap) {
    return decoded;
  }

  // unreachable
  return decoded;
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

export function parseMht(rawText, options = {}) {
  try {
    // Ensure we operate on a byte-wise string.  Many callers read files
    // with UTF-8, which turns 0xE2 0x80 0x94 into the single em‑dash
    // character.  Subsequent code treated each JS character as a byte via
    // `charCodeAt & 0xff`, producing control codes when non‑ASCII was
    // present.  Convert any UTF‑8 text back into a Latin1-style byte string
    // so that every character code corresponds to the original byte value.
    function toLatin1(s) {
      if (typeof s !== 'string') return s;
      // fast path: if every codepoint is <256 we can keep it as-is
      for (let i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) > 0xff) {
          // re-encode as bytes
          if (typeof TextEncoder !== 'undefined') {
            const u8 = new TextEncoder().encode(s);
            let out = '';
            for (let b of u8) out += String.fromCharCode(b);
            return out;
          }
          // fallback: for environments without TextEncoder, just mask
          let out = '';
          for (let j = 0; j < s.length; j++) out += String.fromCharCode(s.charCodeAt(j) & 0xff);
          return out;
        }
      }
      return s;
    }

    rawText = toLatin1(rawText);

    logger.info({ msg: 'parseMht: raw length', meta: { length: rawText ? rawText.length : 0, opts: options && options.EnableControlSanitization ? 'sanitize' : options && options.EnableMapping ? 'map' : '' } });
    if (!rawText || typeof rawText !== 'string') {
      logger.warn({ msg: 'parseMht: empty or non-string input' });
      return { html: null, parts: [], boundary: null, imageMap: {} };
    }

    // Find boundary (look in headers near top)
    const boundaryMatch = rawText.match(/boundary="?([^"\r\n;]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1] : null;
    logger.info({ msg: 'detected boundary', meta: { boundary } });

    // Determine separator and split parts
    const sep = boundary ? `--${boundary}` : null;
    const rawParts = sep ? rawText.split(sep) : rawText.split(/\r?\n--[^\r\n]+\r?\n/);
    logger.info({ msg: 'raw parts count (including preamble/epilogue)', meta: { count: rawParts.length } });

    const parts = [];
    // keep cursor so we can compute absolute offsets within rawText
    let cursor = 0;
    for (let i = 0; i < rawParts.length; i++) {
      const rawPart = rawParts[i];
      const trimmed = rawPart.trim();
      if (!trimmed) {
        cursor += rawPart.length;
        continue;
      }
      // compute part start offset in rawText, searching from previous cursor to avoid duplicates
      const partStart = rawText.indexOf(rawPart, cursor);
      cursor = partStart + rawPart.length;
      const trimOffset = rawPart.indexOf(trimmed);

      // Split headers/body at first blank line in the trimmed text
      const splitIndex = trimmed.search(/\r?\n\r?\n/);
      let headerBlock = '';
      let body = '';
      if (splitIndex >= 0) {
        headerBlock = trimmed.slice(0, splitIndex);
        body = trimmed.slice(splitIndex).replace(/^\r?\n/, '');
      } else {
        // no headers, treat whole as body
        body = trimmed;
      }
      const headers = parseHeaders(headerBlock);
      const contentType = headers['content-type'] || '';
      const contentLocation = headers['content-location'] || headers['content-location:'] || '';
      const cte = headers['content-transfer-encoding'] || '';
      // compute body start offset in rawText chars
      const bodyRel = trimmed.indexOf(body);
      const bodyStart = partStart + trimOffset + bodyRel;
      parts.push({
        index: parts.length,
        headers,
        ContentType: contentType,
        ContentLocation: contentLocation,
        ContentTransferEncoding: cte,
        BodyRaw: body,
        BodyRawStart: bodyStart
      });
    }

    logger.info({ msg: 'parsed parts count (non-empty)', meta: { count: parts.length } });
    parts.forEach((p, idx) => {
      logger.info({ msg: `part ${idx}`, meta: { type: p.ContentType, loc: safeSlice(p.ContentLocation, 80), cte: p.ContentTransferEncoding, bodyLen: p.BodyRaw.length } });
    });

    // Find HTML part (prefer text/html)
    const htmlPart = parts.find(p => /text\/html/i.test(p.ContentType)) || parts.find(p => /application\/xhtml\+xml/i.test(p.ContentType));
    if (!htmlPart) {
      logger.warn({ msg: 'no text/html part found' });
    }

    let html = htmlPart ? htmlPart.BodyRaw : null;

    // If html part exists and is encoded, decode it
    if (htmlPart) {
      const cte = (htmlPart.ContentTransferEncoding || '').toLowerCase();
      const wantsMap = options && options.EnableMapping;
      // parse charset from header
      const declaredCharsetMatch = (htmlPart.ContentType || '').match(/charset\s*=\s*"?([^";]+)/i);
      const declaredCharset = declaredCharsetMatch ? declaredCharsetMatch[1].toLowerCase() : 'utf-8';
      htmlPart.DeclaredCharset = declaredCharset;

      // helper to run decode with charset and optionally mapping
      function runDecode(text, charset) {
        if (/quoted-printable/i.test(cte)) {
          return decodeQuotedPrintable(text, { withMapping: wantsMap, charset });
        } else if (/base64/i.test(cte)) {
          try {
            const b64 = normalizeBase64(text);
            let bytes;
            if (typeof atob !== 'undefined') {
              const bin = atob(b64);
              bytes = new Uint8Array(bin.split('').map(ch => ch.charCodeAt(0)));
            } else if (typeof Buffer !== 'undefined') {
              bytes = Buffer.from(b64, 'base64');
            }
            if (bytes) {
              if (wantMap) {
                // rudimentary mapping: each output char maps to start of body
                return { text: new TextDecoder(charset, { fatal:false }).decode(bytes), mapping: Array.from({ length: bytes.length }, () => 0) };
              } else {
                if (typeof TextDecoder !== 'undefined') {
                  try { return new TextDecoder(charset, { fatal:false }).decode(bytes); } catch {}
                }
                // fallback to binary->string
                if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('binary');
                return String.fromCharCode.apply(null, bytes);
              }
            }
          } catch {
            logger.warn({ msg: 'base64 decode failed for HTML part' });
          }
          return text;
        } else {
          // no decoding, return raw
          if (wantMap) return { text, mapping: Array.from({length: text.length}, (_,i)=>i) };
          return text;
        }
      }

      // initial decode
      let decodedResult = runDecode(html, declaredCharset);
      if (wantsMap) {
        html = decodedResult.text;
        htmlPart.BodyDecodedMapping = decodedResult.mapping;
      } else {
        html = decodedResult;
      }

      // detection & maybe fallback
      let origDiag = detectControlChars(html);
      let sawReplacement = html.indexOf('\uFFFD') !== -1;
      // ensure fields exist with defaults
      htmlPart.CharsetFallbackApplied = false;
      htmlPart.CharsetUsed = declaredCharset || 'utf-8';
      if (options && options.EnableCharsetFallback) {
        const needFallback = sawReplacement || origDiag.count > 0 || /[\u0080-\u009F]/.test(html);
        if (needFallback && declaredCharset !== 'windows-1252') {
          // try cp1252
          const fallbackResult = runDecode(htmlPart.BodyRaw, 'windows-1252');
          const fbHtml = wantsMap ? fallbackResult.text : fallbackResult;
          const fbDiag = detectControlChars(fbHtml);
          const fbHasReplacement = fbHtml.indexOf('\uFFFD') !== -1;
          // choose fallback if it removes replacement or reduces control count
          if ((!fbHasReplacement && sawReplacement) || fbDiag.count < origDiag.count) {
            html = fbHtml;
            if (wantsMap) htmlPart.BodyDecodedMapping = fallbackResult.mapping;
            htmlPart.CharsetUsed = 'windows-1252';
            htmlPart.CharsetFallbackApplied = true;
            origDiag = fbDiag;
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
            logger.warn({ msg: 'failed to base64-encode decoded quoted-printable image', meta: { error: String(err) } });
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

    logger.info({ msg: 'built imageMap entries', meta: { count: Object.keys(imageMap).length } });
    // detect C0 control characters in decoded HTML (except tab/lf/cr)
    function detectControlChars(s) {
      const res = { count: 0, samples: [] };
      if (typeof s !== 'string' || s.length === 0) return res;
      const re = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
      let m;
      while ((m = re.exec(s)) !== null) {
        res.count++;
        if (res.samples.length < 5) {
          res.samples.push({
            index: m.index,
            codepoint: 'U+' + m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
          });
        }
        if (res.count >= 20) break; // enough samples
      }
      return res;
    }

    // remove control characters by default replacement (space)
    function sanitizeControlChars(s) {
      if (typeof s !== 'string' || s.length === 0) return s;
      return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    }

    let controlCharDiagnostics = null;
    let controlCharSanitized = false;
    if (html) {
      controlCharDiagnostics = detectControlChars(html);
      if (controlCharDiagnostics.count > 0) {
        // attach raw offsets if mapping is available
        if (options && options.EnableMapping && htmlPart && htmlPart.BodyDecodedMapping && typeof htmlPart.BodyRawStart === 'number') {
          controlCharDiagnostics.samples = controlCharDiagnostics.samples.map(s => {
            const rawOff = htmlPart.BodyRawStart + (htmlPart.BodyDecodedMapping[s.index] || s.index);
            return { ...s, rawTextOffset: rawOff };
          });
        }
        logger.warn({ msg: `control chars detected in HTML part${htmlPart ? ' index=' + htmlPart.index : ''}`, meta: { count: controlCharDiagnostics.count, samples: controlCharDiagnostics.samples.map(s => s.codepoint) } });
      }
      // optional sanitization flag
      if (options && options.EnableControlSanitization) {
        const before = html;
        html = sanitizeControlChars(html);
        controlCharSanitized = true;
        if (before !== html) {
          logger.info({ msg: 'control chars removed by sanitization' });
        }
      }
      logger.info({ msg: 'html preview', meta: { preview: safeSlice(html.replace(/\r?\n/g, '\\n'), 1000) } });
    }

    // top-level summary fields for charset fallback
    const charsetFallback = parts.some(p => p.CharsetFallbackApplied === true);
    const charsetUsed = parts.find(p => p.CharsetUsed)?.CharsetUsed || null;
    return { html, parts, boundary, imageMap, controlCharDiagnostics, controlCharSanitized, charsetFallback, charsetUsed };
  } catch (err) {
    logger.error({ msg: 'parseMht unexpected error', meta: { error: String(err) } });
    return { html: null, parts: [], boundary: null, imageMap: {} };
  }
}
