// @ts-check
import {
  parseCssNumericValue,
  parseStyleDeclarations
} from '../pipeline/styleUtils.js';

/**
 * @typedef {{ nodeType?: number, textContent?: string | null, childNodes?: ArrayLike<DomNode>, parentElement?: DomElement | null }} DomNode
 * @typedef {DomNode & { tagName: string, children: ArrayLike<DomElement>, getAttribute: (name: string) => string | null, querySelector: (selector: string) => DomElement | null, querySelectorAll: (selector: string) => ArrayLike<DomElement>, closest: (selector: string) => DomElement | null }} DomElement
 * @typedef {{ body?: DomElement | null }} DomDocument
 * @typedef {'left' | 'center' | 'right'} TableAlign
 * @typedef {{ codeAsPlainText?: boolean }} InlineMarkdownOptions
 * @typedef {{ marker: ' ' | 'x', text: string }} TodoState
 * @typedef {{ index: number, positioned: boolean, top: number, left: number }} ReadingOrderHint
 * @typedef {{ cells: string[], aligns: (TableAlign | null)[], hasHeaderCell: boolean }} TableRowModel
 * @typedef {{ type: 'text', text: string }} MarkdownIrTextBlock
 * @typedef {{ type: 'heading', level: number, text: string }} MarkdownIrHeadingBlock
 * @typedef {{ type: 'paragraph', text: string, isMarkdownInline?: boolean }} MarkdownIrParagraphBlock
 * @typedef {{ type: 'blockquote', text: string, isMarkdownInline?: boolean }} MarkdownIrBlockquoteBlock
 * @typedef {{ type: 'codeBlock', code: string }} MarkdownIrCodeBlock
 * @typedef {{ type: 'inlineCode', code: string }} MarkdownIrInlineCodeBlock
 * @typedef {{ type: 'image', alt: string, src: string }} MarkdownIrImageBlock
 * @typedef {{ type: 'table', header: string[], rows: string[][], syntheticHeader?: boolean, sourceColumnCount?: number, aligns?: (TableAlign | null)[] }} MarkdownIrTableBlock
 * @typedef {{ type: 'listItem', children: MarkdownIrBlock[] }} MarkdownIrListItem
 * @typedef {{ type: 'list', ordered: boolean, items: MarkdownIrListItem[] }} MarkdownIrListBlock
 * @typedef {MarkdownIrTextBlock | MarkdownIrHeadingBlock | MarkdownIrParagraphBlock | MarkdownIrBlockquoteBlock | MarkdownIrCodeBlock | MarkdownIrInlineCodeBlock | MarkdownIrImageBlock | MarkdownIrTableBlock | MarkdownIrListBlock} MarkdownIrBlock
 * @typedef {{ type: 'document', blocks: MarkdownIrBlock[] }} MarkdownIrDocument
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeWhitespace(value) {
  return normalizeLineBreaks(value).replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function escapeInlineMarkdown(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/([*_`[\]])/g, '\\$1');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeMarkdownOutput(value) {
  return normalizeLineBreaks(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {DomNode | null | undefined} node
 * @returns {string}
 */
function collectNodeText(node) {
  if (!node) return '';
  return normalizeWhitespace(node.textContent || '');
}

/**
 * @param {DomNode | null | undefined} node
 * @param {InlineMarkdownOptions} [options]
 * @returns {string}
 */
function collectInlineMarkdown(node, options = {}) {
  if (!node) return '';

  if (node.nodeType === 3) {
    const text = normalizeWhitespace(node.textContent || '');
    return text ? escapeInlineMarkdown(text) : '';
  }

  if (node.nodeType !== 1) return '';

  const element = /** @type {DomElement} */ (node);
  const tag = String(element.tagName || '').toLowerCase();
  if (tag === 'br') return '\n';

  if (tag === 'a') {
    const label = normalizeWhitespace(element.textContent || '');
    const href = normalizeWhitespace(element.getAttribute('href') || '');
    if (label && href) {
      return `[${escapeInlineMarkdown(label)}](${href})`;
    }
    return label ? escapeInlineMarkdown(label) : '';
  }

  if (tag === 'code') {
    const linkedChild = element.querySelector(':scope > a[href]');
    if (linkedChild) {
      return collectInlineMarkdown(linkedChild, options);
    }
    const code = normalizeWhitespace(element.textContent || '');
    if (!code) return '';
    if (options.codeAsPlainText === true) {
      return escapeInlineMarkdown(code);
    }
    return `\`${code.replace(/`/g, '\\`')}\``;
  }

  const childParts = Array.from(element.childNodes || [])
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

/**
 * @param {DomNode | null | undefined} node
 * @param {InlineMarkdownOptions} [options]
 * @returns {string}
 */
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

/**
 * @param {DomElement | null | undefined} listNode
 * @param {boolean} [ordered]
 * @returns {string}
 */
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

/**
 * @param {DomElement | null | undefined} cell
 * @returns {string}
 */
function collectTableCellMarkdown(cell) {
  if (!cell) return '';

  const elementChildren = Array.from(cell.children || []);
  if (!elementChildren.length) {
    return collectParagraphMarkdown(cell, { codeAsPlainText: true });
  }

  const parts = /** @type {string[]} */ ([]);
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

/**
 * @param {DomElement | null | undefined} cell
 * @returns {TableAlign | null}
 */
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

/**
 * @param {DomElement | null | undefined} node
 * @returns {boolean}
 */
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

/**
 * @param {DomElement | null | undefined} node
 * @returns {TodoState | null}
 */
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

/**
 * @param {DomElement | null | undefined} node
 * @returns {boolean}
 */
function looksLikeCitationParagraph(node) {
  if (!node || !node.querySelector) return false;
  if (node.querySelector(':scope > cite')) return true;
  return false;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseCssLength(value) {
  return parseCssNumericValue(value);
}

/**
 * @param {DomElement | null | undefined} node
 * @param {number} index
 * @returns {ReadingOrderHint}
 */
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

/**
 * @param {ReadingOrderHint} a
 * @param {ReadingOrderHint} b
 * @returns {number}
 */
function compareReadingOrderHints(a, b) {
  if (a.top !== b.top) return a.top - b.top;
  if (a.left !== b.left) return a.left - b.left;
  return a.index - b.index;
}

/**
 * @param {DomElement} row
 * @returns {TableRowModel}
 */
function tableRowToModel(row) {
  const cells = Array.from(row.children)
    .filter((node) => /^(th|td)$/i.test(node.tagName));

  return {
    cells: cells.map((cell) => collectTableCellMarkdown(cell)),
    aligns: cells.map((cell) => getCellTextAlign(cell)),
    hasHeaderCell: cells.some((cell) => /^th$/i.test(String(cell.tagName || '')))
  };
}

/**
 * @param {DomElement} tableNode
 * @returns {DomElement[]}
 */
function getDirectTableRows(tableNode) {
  return [
    ...Array.from(tableNode.querySelectorAll(':scope > tr')),
    ...Array.from(tableNode.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'))
  ];
}

/**
 * @param {DomElement} tableNode
 * @returns {TableRowModel[]}
 */
function getTableRowModels(tableNode) {
  return getDirectTableRows(tableNode)
    .map(tableRowToModel)
    .filter((row) => row.cells.length > 0);
}

/**
 * @param {DomElement} tableNode
 * @returns {DomElement[]}
 */
function getImmediateNestedTables(tableNode) {
  const candidates = [
    ...Array.from(tableNode.querySelectorAll(':scope > tr > td > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tbody > tr > td > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tr > td > div > table')),
    ...Array.from(tableNode.querySelectorAll(':scope > tbody > tr > td > div > table'))
  ];

  return Array.from(new Set(candidates));
}

/**
 * @param {DomElement} node
 * @returns {MarkdownIrTableBlock | MarkdownIrParagraphBlock}
 */
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
  const aligns = sourceAligns && Array.isArray(sourceAligns.aligns)
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

/**
 * @param {DomElement} item
 * @returns {MarkdownIrBlock[]}
 */
function listItemChildrenToIr(item) {
  const children = /** @type {MarkdownIrBlock[]} */ ([]);

  Array.from(item.childNodes || []).forEach((child) => {
    if (child.nodeType === 3) {
      const text = normalizeWhitespace(child.textContent || '');
      if (text) {
        children.push({ type: 'text', text });
      }
      return;
    }

    if (child.nodeType !== 1) return;
    const childElement = /** @type {DomElement} */ (child);
    const tag = childElement.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      const nestedList = domNodeToIr(childElement);
      if (nestedList) children.push(nestedList);
      return;
    }

    const text = collectNodeText(childElement);
    if (text) {
      children.push({ type: 'text', text });
    }
  });

  return children;
}

/**
 * @param {DomElement} node
 * @returns {MarkdownIrListBlock}
 */
function listToIr(node) {
  const ordered = node.tagName.toLowerCase() === 'ol';
  const items = Array.from(node.children)
    .filter((child) => child.tagName && child.tagName.toLowerCase() === 'li')
    .map((item) => /** @type {MarkdownIrListItem} */ ({
      type: 'listItem',
      children: listItemChildrenToIr(item)
    }));

  return {
    type: 'list',
    ordered,
    items
  };
}

/**
 * @param {DomElement} node
 * @returns {MarkdownIrHeadingBlock}
 */
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

/**
 * @param {DomElement} node
 * @returns {MarkdownIrCodeBlock}
 */
function preToIr(node) {
  const codeNode = node.querySelector('code');
  const code = codeNode ? normalizeLineBreaks(codeNode.textContent || '') : normalizeLineBreaks(node.textContent || '');
  return {
    type: 'codeBlock',
    code: code.trimEnd()
  };
}

/**
 * @param {DomElement} node
 * @returns {MarkdownIrImageBlock}
 */
function imageToIr(node) {
  return {
    type: 'image',
    alt: node.getAttribute('alt') || 'Image',
    src: node.getAttribute('src') || ''
  };
}

/**
 * @param {DomElement | DomNode | null | undefined} node
 * @returns {MarkdownIrBlock | null}
 */
function domNodeToIr(node) {
  if (!node || node.nodeType !== 1) return null;
  const element = /** @type {DomElement} */ (node);
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) return headingToIr(element);
  if (tag === 'blockquote') return { type: 'blockquote', text: collectParagraphMarkdown(element), isMarkdownInline: true };
  if (tag === 'p') {
    const todo = getTodoStateFromParagraph(element);
    if (todo) {
      return {
        type: 'paragraph',
        text: `- [${todo.marker}] ${todo.text}`,
        isMarkdownInline: true
      };
    }

    if (looksLikeCitationParagraph(element)) {
      return { type: 'blockquote', text: collectParagraphMarkdown(element), isMarkdownInline: true };
    }

    if (looksLikePageTitleParagraph(element)) {
      return { type: 'heading', level: 1, text: collectNodeText(element) };
    }

    return { type: 'paragraph', text: collectParagraphMarkdown(element), isMarkdownInline: true };
  }
  if (tag === 'ul' || tag === 'ol') return listToIr(element);
  if (tag === 'pre') return preToIr(element);
  if (tag === 'code') return { type: 'inlineCode', code: collectNodeText(element) };
  if (tag === 'img') return imageToIr(element);
  if (tag === 'table') return tableToIr(element);

  const text = collectNodeText(element);
  if (!text) return null;
  return { type: 'paragraph', text };
}

/**
 * @param {DomDocument | null | undefined} doc
 * @returns {MarkdownIrDocument}
 */
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

  const blocks = /** @type {MarkdownIrBlock[]} */ (entries
    .map((entry) => domNodeToIr(entry.node))
    .filter((block) => block && !(block.type === 'paragraph' && !block.text)));

  return {
    type: 'document',
    blocks
  };
}

/**
 * @param {MarkdownIrListItem[]} items
 * @param {boolean} ordered
 * @param {number} [depth]
 * @returns {string}
 */
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

/**
 * @param {string[]} header
 * @param {string[][]} rows
 * @param {(TableAlign | null | string)[]} [aligns]
 * @returns {string}
 */
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

/**
 * @param {MarkdownIrBlock | null | undefined} block
 * @returns {string}
 */
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

/**
 * @param {MarkdownIrDocument | null | undefined} irDocument
 * @returns {string}
 */
export function renderMarkdownFromIr(irDocument) {
  const blocks = irDocument && Array.isArray(irDocument.blocks) ? irDocument.blocks : [];
  const rendered = blocks.map((block) => renderBlock(block)).filter(Boolean).join('\n\n');
  return normalizeMarkdownOutput(rendered);
}
