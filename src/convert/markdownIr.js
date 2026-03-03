function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function normalizeWhitespace(value) {
  return normalizeLineBreaks(value).replace(/[ \t]+/g, ' ').trim();
}

function escapeInlineMarkdown(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/([*_`[\]])/g, '\\$1');
}

function normalizeMarkdownOutput(value) {
  return normalizeLineBreaks(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectNodeText(node) {
  if (!node) return '';
  return normalizeWhitespace(node.textContent || '');
}

function parseStyleDeclarations(styleText) {
  const declarations = {};
  const source = String(styleText || '');
  for (const chunk of source.split(';')) {
    const separator = chunk.indexOf(':');
    if (separator < 0) continue;
    const key = chunk.slice(0, separator).trim().toLowerCase();
    const value = chunk.slice(separator + 1).trim();
    if (!key) continue;
    declarations[key] = value;
  }
  return declarations;
}

function parseCssLength(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const match = source.match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getReadingOrderHint(node, index) {
  const style = parseStyleDeclarations(node && node.getAttribute ? node.getAttribute('style') : '');
  const position = String(style.position || '').toLowerCase();
  const top = parseCssLength(style.top);
  const left = parseCssLength(style.left);
  const positioned = position === 'absolute' || position === 'fixed' || top !== null || left !== null;

  return {
    index,
    positioned,
    top: top === null ? Number.POSITIVE_INFINITY : top,
    left: left === null ? Number.POSITIVE_INFINITY : left
  };
}

function compareReadingOrderHints(a, b) {
  if (a.top !== b.top) return a.top - b.top;
  if (a.left !== b.left) return a.left - b.left;
  return a.index - b.index;
}

function tableRowToCells(row) {
  return Array.from(row.children)
    .filter((node) => /^(th|td)$/i.test(node.tagName))
    .map((cell) => collectNodeText(cell));
}

function tableToIr(node) {
  const rows = Array.from(node.querySelectorAll('tr'))
    .map(tableRowToCells)
    .filter((cells) => cells.length > 0);

  if (!rows.length) {
    return { type: 'paragraph', text: '' };
  }

  const columnCount = Math.max(...rows.map((cells) => cells.length));
  const normalizedRows = rows.map((cells) => {
    const copy = cells.slice();
    while (copy.length < columnCount) copy.push('');
    return copy;
  });

  return {
    type: 'table',
    header: normalizedRows[0],
    rows: normalizedRows.slice(1)
  };
}

function listItemChildrenToIr(item) {
  const children = [];

  Array.from(item.childNodes).forEach((child) => {
    if (child.nodeType === 3) {
      const text = normalizeWhitespace(child.textContent || '');
      if (text) {
        children.push({ type: 'text', text });
      }
      return;
    }

    if (child.nodeType !== 1) return;
    const tag = child.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      children.push(domNodeToIr(child));
      return;
    }

    const text = collectNodeText(child);
    if (text) {
      children.push({ type: 'text', text });
    }
  });

  return children;
}

function listToIr(node) {
  const ordered = node.tagName.toLowerCase() === 'ol';
  const items = Array.from(node.children)
    .filter((child) => child.tagName && child.tagName.toLowerCase() === 'li')
    .map((item) => ({
      type: 'listItem',
      children: listItemChildrenToIr(item)
    }));

  return {
    type: 'list',
    ordered,
    items
  };
}

function headingToIr(node) {
  const level = Number(node.tagName.toLowerCase().slice(1));
  return {
    type: 'heading',
    level,
    text: collectNodeText(node)
  };
}

function preToIr(node) {
  const codeNode = node.querySelector('code');
  const code = codeNode ? normalizeLineBreaks(codeNode.textContent || '') : normalizeLineBreaks(node.textContent || '');
  return {
    type: 'codeBlock',
    code: code.trimEnd()
  };
}

function imageToIr(node) {
  return {
    type: 'image',
    alt: node.getAttribute('alt') || 'Image',
    src: node.getAttribute('src') || ''
  };
}

function domNodeToIr(node) {
  if (!node || node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) return headingToIr(node);
  if (tag === 'p') return { type: 'paragraph', text: collectNodeText(node) };
  if (tag === 'ul' || tag === 'ol') return listToIr(node);
  if (tag === 'pre') return preToIr(node);
  if (tag === 'code') return { type: 'inlineCode', code: collectNodeText(node) };
  if (tag === 'img') return imageToIr(node);
  if (tag === 'table') return tableToIr(node);

  const text = collectNodeText(node);
  if (!text) return null;
  return { type: 'paragraph', text };
}

export function createMarkdownIrFromDocument(doc) {
  const body = doc && doc.body ? doc.body : null;
  if (!body) {
    return { type: 'document', blocks: [] };
  }

  const entries = Array.from(body.children).map((node, index) => ({
    node,
    hint: getReadingOrderHint(node, index)
  }));

  const positionedCount = entries.filter((entry) => entry.hint.positioned).length;
  if (positionedCount >= 2) {
    entries.sort((left, right) => {
      if (left.hint.positioned && right.hint.positioned) {
        return compareReadingOrderHints(left.hint, right.hint);
      }
      return left.hint.index - right.hint.index;
    });
  }

  const blocks = entries
    .map((entry) => domNodeToIr(entry.node))
    .filter((block) => block && !(block.type === 'paragraph' && !block.text));

  return {
    type: 'document',
    blocks
  };
}

function renderListItems(items, ordered, depth = 0) {
  return items.map((item, index) => {
    const indent = '  '.repeat(depth);
    const marker = ordered ? `${index + 1}.` : '-';
    const lineParts = [];
    const nestedBlocks = [];

    for (const child of item.children || []) {
      if (!child) continue;
      if (child.type === 'text') {
        const text = normalizeWhitespace(child.text || '');
        if (text) lineParts.push(text);
      } else if (child.type === 'list') {
        nestedBlocks.push(renderListItems(child.items || [], child.ordered === true, depth + 1));
      }
    }

    const line = `${indent}${marker} ${escapeInlineMarkdown(lineParts.join(' ').trim())}`.trimEnd();
    return [line, ...nestedBlocks.filter(Boolean)].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');
}

function renderTable(header, rows) {
  if (!Array.isArray(header) || header.length === 0) return '';
  const escapedHeader = header.map((cell) => escapeInlineMarkdown(String(cell || '').replace(/\|/g, '\\|')));
  const divider = Array.from({ length: escapedHeader.length }, () => '---');
  const bodyLines = (rows || []).map((row) => {
    const copy = Array.isArray(row) ? row.slice() : [];
    while (copy.length < escapedHeader.length) copy.push('');
    const escapedCells = copy.map((cell) => escapeInlineMarkdown(String(cell || '').replace(/\|/g, '\\|')));
    return `| ${escapedCells.join(' | ')} |`;
  });

  return [
    `| ${escapedHeader.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...bodyLines
  ].join('\n');
}

function renderBlock(block) {
  if (!block || !block.type) return '';

  if (block.type === 'heading') {
    const level = Number(block.level || 1);
    const safeLevel = Number.isFinite(level) ? Math.max(1, Math.min(6, level)) : 1;
    const text = normalizeWhitespace(block.text || '');
    if (!text) return '';
    return `${'#'.repeat(safeLevel)} ${escapeInlineMarkdown(text)}`;
  }

  if (block.type === 'paragraph') {
    const text = normalizeWhitespace(block.text || '');
    return text ? escapeInlineMarkdown(text) : '';
  }

  if (block.type === 'list') {
    return renderListItems(block.items || [], block.ordered === true, 0);
  }

  if (block.type === 'codeBlock') {
    const code = normalizeLineBreaks(block.code || '').trimEnd();
    return `\`\`\`\n${code}\n\`\`\``;
  }

  if (block.type === 'inlineCode') {
    const code = normalizeWhitespace(block.code || '');
    return code ? `\`${code.replace(/`/g, '\\`')}\`` : '';
  }

  if (block.type === 'image') {
    const alt = escapeInlineMarkdown(block.alt || 'Image');
    const src = String(block.src || '');
    return `![${alt}](${src})`;
  }

  if (block.type === 'table') {
    return renderTable(block.header || [], block.rows || []);
  }

  return '';
}

export function renderMarkdownFromIr(irDocument) {
  const blocks = irDocument && Array.isArray(irDocument.blocks) ? irDocument.blocks : [];
  const rendered = blocks.map((block) => renderBlock(block)).filter(Boolean).join('\n\n');
  return normalizeMarkdownOutput(rendered);
}
