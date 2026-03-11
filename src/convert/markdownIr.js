import {
  parseCssNumericValue,
  parseStyleDeclarations
} from '../pipeline/styleUtils.js';

function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function normalizeWhitespace(value) {
  return normalizeLineBreaks(value).replace(/\s+/g, ' ').trim();
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

function collectInlineMarkdown(node, options = {}) {
  if (!node) return '';

  if (node.nodeType === 3) {
    const text = normalizeWhitespace(node.textContent || '');
    return text ? escapeInlineMarkdown(text) : '';
  }

  if (node.nodeType !== 1) return '';

  const tag = String(node.tagName || '').toLowerCase();
  if (tag === 'br') return '\n';

  if (tag === 'a') {
    const label = normalizeWhitespace(node.textContent || '');
    const href = normalizeWhitespace(node.getAttribute('href') || '');
    if (label && href) {
      return `[${escapeInlineMarkdown(label)}](${href})`;
    }
    return label ? escapeInlineMarkdown(label) : '';
  }

  if (tag === 'code') {
    const linkedChild = node.querySelector && node.querySelector(':scope > a[href]');
    if (linkedChild) {
      return collectInlineMarkdown(linkedChild, options);
    }
    const code = normalizeWhitespace(node.textContent || '');
    if (!code) return '';
    if (options.codeAsPlainText === true) {
      return escapeInlineMarkdown(code);
    }
    return `\`${code.replace(/`/g, '\\`')}\``;
  }

  const childParts = Array.from(node.childNodes || [])
    .map((child) => collectInlineMarkdown(child, options))
    .filter(Boolean);
  const content = childParts.join(' ').replace(/[ \t]{2,}/g, ' ').trim();
  if (!content) return '';

  if (tag === 'strong' || tag === 'b') return `**${content}**`;
  if (tag === 'em' || tag === 'i') return `*${content}*`;

  // Ignore OneNote tag icons so task conversion can be driven by text heuristics.
  if (tag === 'img') return '';

  return content;
}

function collectParagraphMarkdown(node, options = {}) {
  if (!node) return '';

  const parts = Array.from(node.childNodes || [])
    .map((child) => collectInlineMarkdown(child, options))
    .filter(Boolean);

  return parts
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function collectListItemsAsInlineMarkdown(listNode, ordered = false) {
  if (!listNode || !listNode.children) return '';
  const items = Array.from(listNode.children)
    .filter((child) => String(child.tagName || '').toLowerCase() === 'li')
    .map((item, index) => {
      const text = collectParagraphMarkdown(item, { codeAsPlainText: true });
      if (!text) return '';
      if (ordered) return `${index + 1}. ${text}`;
      return `- ${text}`;
    })
    .filter(Boolean);
  return items.join(' <br> ');
}

function collectTableCellMarkdown(cell) {
  if (!cell) return '';

  const elementChildren = Array.from(cell.children || []);
  if (!elementChildren.length) {
    return collectParagraphMarkdown(cell, { codeAsPlainText: true });
  }

  const parts = [];
  elementChildren.forEach((child) => {
    const tag = String(child.tagName || '').toLowerCase();
    if (tag === 'ul') {
      const rendered = collectListItemsAsInlineMarkdown(child, false);
      if (rendered) parts.push(rendered);
      return;
    }
    if (tag === 'ol') {
      const rendered = collectListItemsAsInlineMarkdown(child, true);
      if (rendered) parts.push(rendered);
      return;
    }

    const rendered = collectParagraphMarkdown(child, { codeAsPlainText: true });
    if (rendered) parts.push(rendered);
  });

  return parts.join(' <br> ').replace(/[ \t]{2,}/g, ' ').trim();
}

function getCellTextAlign(cell) {
  const style = parseStyleDeclarations(cell && cell.getAttribute ? cell.getAttribute('style') : '');
  let align = String(style['text-align'] || '').trim().toLowerCase();
  if (!align && cell && cell.querySelector) {
    const child = cell.querySelector(':scope > p, :scope > div, :scope > span');
    if (child) {
      const childStyle = parseStyleDeclarations(child.getAttribute ? child.getAttribute('style') : '');
      align = String(childStyle['text-align'] || '').trim().toLowerCase();
    }
  }
  if (align === 'left' || align === 'center' || align === 'right') return align;
  return null;
}

function looksLikePageTitleParagraph(node) {
  if (!node || !node.tagName) return false;
  const tag = String(node.tagName || '').toLowerCase();
  if (tag !== 'p' && tag !== 'div') return false;
  if (node.querySelector && node.querySelector('img,a,table,ul,ol,pre,code')) return false;

  const cls = String(node.getAttribute('class') || '');
  if (/\bconverted-page-title\b/i.test(cls)) return true;

  const style = parseStyleDeclarations(node.getAttribute ? node.getAttribute('style') : '');
  const fontSize = parseCssLength(style['font-size']);
  return fontSize !== null && fontSize >= 18;
}

function getTodoStateFromParagraph(node) {
  if (!node || !node.querySelector) return null;
  const todoIcon = node.querySelector('img[alt="To Do"]');
  if (!todoIcon) return null;

  const text = normalizeWhitespace(node.textContent || '');
  if (!text) return null;

  if (/\bunchecked\b/i.test(text)) return { marker: ' ', text };
  if (/\bchecked\b/i.test(text)) return { marker: 'x', text };
  return { marker: ' ', text };
}

function looksLikeCitationParagraph(node) {
  if (!node || !node.querySelector) return false;
  if (node.querySelector(':scope > cite')) return true;
  return false;
}

function parseCssLength(value) {
  return parseCssNumericValue(value);
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

function tableRowToModel(row) {
  const cells = Array.from(row.children)
    .filter((node) => /^(th|td)$/i.test(node.tagName));

  return {
    cells: cells.map((cell) => collectTableCellMarkdown(cell)),
    aligns: cells.map((cell) => getCellTextAlign(cell)),
    hasHeaderCell: cells.some((cell) => /^th$/i.test(String(cell.tagName || '')))
  };
}

function getDirectTableRows(tableNode) {
  return [
    ...Array.from(tableNode.querySelectorAll(':scope > tr')),
    ...Array.from(tableNode.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'))
  ];
}

function getTableRowModels(tableNode) {
  return getDirectTableRows(tableNode)
    .map(tableRowToModel)
    .filter((row) => row.cells.length > 0);
}

function getImmediateNestedTables(tableNode) {
  const candidates = [
    ...Array.from(tableNode.querySelectorAll(':scope > tr > td > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tbody > tr > td > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tr > td > div > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tbody > tr > td > div > table'))
  ];

  return Array.from(new Set(candidates));
}

function tableToIr(node) {
  let rowModels = getTableRowModels(node);
  let unwrappedFromWrapperTable = false;

  const wrapperLike = rowModels.length > 0 && rowModels.every((row) => row.cells.length === 1);
  if (wrapperLike) {
    const nestedTables = getImmediateNestedTables(node);
    const nestedRowModels = nestedTables.flatMap((tableNode) => getTableRowModels(tableNode));
    const hasUsefulNestedRows = nestedRowModels.some((row) => row.cells.length > 1 || row.hasHeaderCell === true);
    if (hasUsefulNestedRows) {
      rowModels = nestedRowModels;
      unwrappedFromWrapperTable = true;
    }
  }

  if (!rowModels.length) {
    return { type: 'paragraph', text: '' };
  }

  const columnCount = Math.max(...rowModels.map((row) => row.cells.length));
  const normalizedRows = rowModels.map((row) => {
    const copy = row.cells.slice();
    while (copy.length < columnCount) copy.push('');
    return copy;
  });

  const effectiveColumns = normalizedRows.reduce((max, row) => {
    const lastNonEmpty = row.reduce((last, cell, index) => {
      return normalizeWhitespace(cell || '') ? index : last;
    }, -1);
    return Math.max(max, lastNonEmpty + 1);
  }, 0);

  const trimmedColumnCount = effectiveColumns > 0 ? effectiveColumns : columnCount;
  const compactRows = normalizedRows
    .map((row) => row.slice(0, trimmedColumnCount))
    .filter((row) => row.some((cell) => normalizeWhitespace(cell || '')));

  if (!compactRows.length) {
    return { type: 'paragraph', text: '' };
  }

  const firstIsHeader = rowModels[0].hasHeaderCell === true;
  const firstRowLooksHeaderLike = compactRows.length > 1
    && trimmedColumnCount > 1
    && !unwrappedFromWrapperTable
    && compactRows[0].every((cell) => normalizeWhitespace(cell || '') !== '');
  const useFirstRowAsHeader = firstIsHeader || firstRowLooksHeaderLike;
  const header = firstIsHeader
    ? compactRows[0]
    : useFirstRowAsHeader
      ? compactRows[0]
    : Array.from({ length: trimmedColumnCount }, (_, index) => `Column ${index + 1}`);
  const bodyRows = useFirstRowAsHeader ? compactRows.slice(1) : compactRows;
  const sourceAligns = rowModels.find((row) => Array.isArray(row.aligns) && row.aligns.some(Boolean));
  const aligns = Array.isArray(sourceAligns && sourceAligns.aligns)
    ? sourceAligns.aligns.slice(0, trimmedColumnCount)
    : [];
  if (aligns.some((value) => value === 'center' || value === 'right')) {
    for (let i = 0; i < trimmedColumnCount; i += 1) {
      if (!aligns[i]) aligns[i] = 'left';
    }
  }
  const sourceColumnCount = columnCount;

  return {
    type: 'table',
    header,
    rows: bodyRows,
    syntheticHeader: !firstIsHeader,
    sourceColumnCount,
    aligns
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
  const baseLevel = Number(node.tagName.toLowerCase().slice(1));
  let level = baseLevel;
  const style = parseStyleDeclarations(node.getAttribute ? node.getAttribute('style') : '');
  const fontSize = parseCssLength(style['font-size']);

  if (baseLevel === 2 && fontSize !== null && fontSize <= 14.5) {
    level = 3;
  } else if (baseLevel >= 3 && fontSize !== null && fontSize <= 12.5) {
    level = Math.min(6, baseLevel + 1);
  }

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
  if (tag === 'blockquote') return { type: 'blockquote', text: collectParagraphMarkdown(node), isMarkdownInline: true };
  if (tag === 'p') {
    const todo = getTodoStateFromParagraph(node);
    if (todo) {
      return {
        type: 'paragraph',
        text: `- [${todo.marker}] ${todo.text}`,
        isMarkdownInline: true
      };
    }

    if (looksLikeCitationParagraph(node)) {
      return { type: 'blockquote', text: collectParagraphMarkdown(node), isMarkdownInline: true };
    }

    if (looksLikePageTitleParagraph(node)) {
      return { type: 'heading', level: 1, text: collectNodeText(node) };
    }

    return { type: 'paragraph', text: collectParagraphMarkdown(node), isMarkdownInline: true };
  }
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

  const semanticSelector = 'h1,h2,h3,h4,h5,h6,p,blockquote,ul,ol,pre,img,table';
  const semanticNodes = Array.from(body.querySelectorAll(semanticSelector)).filter((node) => {
    if (!node || !node.tagName) return false;
    const tag = String(node.tagName).toLowerCase();
    if (tag === 'img') {
      const parentTag = String((node.parentElement && node.parentElement.tagName) || '').toLowerCase();
      if (parentTag === 'p' || parentTag === 'li' || parentTag === 'blockquote') {
        return false;
      }
    }
    const parentBlockingAncestor = node.parentElement
      ? node.parentElement.closest('table,ul,ol,pre,code')
      : null;

    if (!parentBlockingAncestor) return true;

    const ancestorTag = String(parentBlockingAncestor.tagName || '').toLowerCase();
    if ((tag === 'ul' || tag === 'ol') && (ancestorTag === 'ul' || ancestorTag === 'ol')) {
      return true;
    }

    return false;
  });

  const entries = semanticNodes.map((node, index) => ({
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

    const lineText = lineParts.join(' ').trim();
    const taskMatch = lineText.match(/^\[(x|X|\s)\]\s+([\s\S]+)$/);
    let renderedText = escapeInlineMarkdown(lineText);
    if (taskMatch) {
      const checkedMarker = String(taskMatch[1] || '').toLowerCase() === 'x' ? 'x' : ' ';
      const taskBody = normalizeWhitespace(taskMatch[2] || '');
      renderedText = `[${checkedMarker}] ${escapeInlineMarkdown(taskBody)}`;
    }

    const line = `${indent}${marker} ${renderedText}`.trimEnd();
    return [line, ...nestedBlocks.filter(Boolean)].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');
}

function renderTable(header, rows, aligns = []) {
  if (!Array.isArray(header) || header.length === 0) return '';
  const escapedHeader = header.map((cell) => String(cell || '').replace(/\|/g, '\\|').trim());
  const divider = Array.from({ length: escapedHeader.length }, (_, index) => {
    const align = String((aligns && aligns[index]) || '').toLowerCase();
    if (align === 'left') return ':---';
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    return '---';
  });
  const bodyLines = (rows || []).map((row) => {
    const copy = Array.isArray(row) ? row.slice() : [];
    while (copy.length < escapedHeader.length) copy.push('');
    const escapedCells = copy.map((cell) => String(cell || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' <br> ').trim());
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
    if (!text) return '';
    return block.isMarkdownInline === true ? text : escapeInlineMarkdown(text);
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
    return renderTable(block.header || [], block.rows || [], block.aligns || []);
  }

  if (block.type === 'blockquote') {
    const text = normalizeWhitespace(block.text || '');
    return text ? `> ${text}` : '';
  }

  return '';
}

export function renderMarkdownFromIr(irDocument) {
  const blocks = irDocument && Array.isArray(irDocument.blocks) ? irDocument.blocks : [];
  const rendered = blocks.map((block) => renderBlock(block)).filter(Boolean).join('\n\n');
  return normalizeMarkdownOutput(rendered);
}
