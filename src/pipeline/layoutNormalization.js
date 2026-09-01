// @ts-check

import {
  parseStyleDeclarationEntries,
  serializeStyleDeclarationEntries
} from './styleUtils.js';
import { looksLikeOneNoteTitleCandidate } from './sanitize.js';

/**
 * @typedef {{ prop: string, value: string }} StyleDeclarationEntry
 * @typedef {Map<string, string>} StyleMap
 * @typedef {{ name?: string | null, value?: string | null }} DomAttribute
 * @typedef {{ nodeType?: number, textContent?: string | null }} DomChildNode
 * @typedef {{
 *   tagName?: string | null,
 *   textContent?: string | null,
 *   attributes?: ArrayLike<DomAttribute>,
 *   children?: ArrayLike<DomElement>,
 *   childNodes?: ArrayLike<DomChildNode>,
 *   classList?: { add: (className: string) => void },
 *   getAttribute: (name: string) => string | null,
 *   setAttribute: (name: string, value: string) => void,
 *   removeAttribute: (name: string) => void,
 *   querySelector: (selector: string) => DomElement | null,
 *   querySelectorAll: (selector: string) => ArrayLike<DomElement>,
 *   closest: (selector: string) => DomElement | null,
 *   cloneNode: (deep?: boolean) => DomElement,
 *   remove: () => void,
 *   replaceWith: (...nodes: DomElement[]) => void
 * }} DomElement
 * @typedef {{ querySelector: (selector: string) => DomElement | null }} DomDocument
 * @typedef {{ unwrapRedundantWrappers?: boolean, normalizeTopLevelPageWidths?: boolean, standardizeHeaderDatePositions?: boolean }} DirectionLayoutNormalizationOptions
 * @typedef {{ changed: boolean, style: string }} NormalizedStyleResult
 * @typedef {{ changed: number, inset: string }} InsetAlignmentResult
 * @typedef {{ removed: number, style: string }} WidthStripResult
 * @typedef {{ [prop: string]: string }} StyleDefaultsMap
 * @typedef {{
 *   step: 'NormalizeDirectionLayoutContainers',
 *   wrappersUnwrapped: number,
 *   widthsNormalized: number,
 *   rootMarginsStandardized: number,
 *   firstContentBlockMarginsStandardized: number,
 *   handwritingContentMarginsStandardized: number,
 *   positionsStandardized: number,
 *   iconParagraphsAligned: number,
 *   placeholderReferencesRemoved: number
 * }} DirectionLayoutNormalizationLogEntry
 * @typedef {{
 *   step: 'EnforceHeaderDateTimeStyles',
 *   titleStyled: number,
 *   dateStyled: number,
 *   timeStyled: number
 * }} HeaderDateTimeStyleLogEntry
 */

/**
 * @param {DomElement | null | undefined} el
 * @param {string | null | undefined} className
 * @returns {void}
 */
function addClass(el, className) {
  if (!el || !className) return;
  if (typeof el.classList !== 'undefined') {
    el.classList.add(className);
    return;
  }

  const classes = new Set(String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  classes.add(className);
  el.setAttribute('class', Array.from(classes).join(' '));
}

/**
 * @param {unknown} styleText
 * @returns {StyleDeclarationEntry[]}
 */
function parseInlineStyle(styleText) {
  return parseStyleDeclarationEntries(styleText);
}

/**
 * @param {StyleDeclarationEntry[]} entries
 * @returns {string}
 */
function serializeInlineStyle(entries) {
  return serializeStyleDeclarationEntries(entries);
}

/**
 * @param {DomElement} el
 * @returns {boolean}
 */
function hasSignificantTextNodeChildren(el) {
  return Array.from(el.childNodes || []).some((node) => node.nodeType === 3 && String(node.textContent || '').trim().length > 0);
}

/**
 * @param {unknown} styleText
 * @returns {boolean}
 */
function isDirectionLtrOnlyStyle(styleText) {
  const entries = parseInlineStyle(styleText);
  if (!entries.length) return false;
  return entries.every(({ prop, value }) => prop === 'direction' && /^ltr$/i.test(String(value || '').trim()));
}

/**
 * @param {DomElement} el
 * @returns {boolean}
 */
function hasUnsafeWrapperAttributes(el) {
  return Array.from(el.attributes || []).some((attr) => {
    const name = String(attr.name || '').toLowerCase();
    if (name === 'style') return false;
    if (name === 'class') return String(attr.value || '').trim().length > 0;
    return true;
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isAbsoluteWidthValue(value) {
  return /^([0-9]*\.?[0-9]+)\s*(in|pt|px|pc|cm|mm)$/i.test(String(value || '').trim());
}

/**
 * @param {unknown} styleText
 * @returns {WidthStripResult}
 */
function stripAbsoluteWidthDeclaration(styleText) {
  const entries = parseInlineStyle(styleText);
  let removed = 0;
  const filtered = entries.filter(({ prop, value }) => {
    if (prop !== 'width') return true;
    if (!isAbsoluteWidthValue(value)) return true;
    removed += 1;
    return false;
  });
  return {
    removed,
    style: serializeInlineStyle(filtered)
  };
}

/**
 * @param {unknown} styleText
 * @returns {StyleMap}
 */
function styleEntriesToMap(styleText) {
  const map = /** @type {StyleMap} */ (new Map());
  parseInlineStyle(styleText).forEach(({ prop, value }) => {
    map.set(prop, value);
  });
  return map;
}

/**
 * @param {StyleMap} styleMap
 * @returns {string}
 */
function styleMapToString(styleMap) {
  return serializeInlineStyle(Array.from(styleMap.entries()).map(([prop, value]) => ({ prop, value })));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isZeroLengthValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return /^0(?:[a-z%]+)?$/.test(normalized);
}

/**
 * @param {StyleMap} styleMap
 * @returns {string}
 */
function extractPaddingLeftValue(styleMap) {
  const explicit = String(styleMap.get('padding-left') || '').trim();
  if (explicit) return explicit;

  const shorthand = String(styleMap.get('padding') || '').trim();
  if (!shorthand) return '';
  const values = shorthand.split(/\s+/).filter(Boolean);
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return values[1];
  if (values.length === 3) return values[1];
  return values[3];
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function cleanInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {DomElement | null | undefined} block
 * @returns {string}
 */
function getDominantTableContentInset(block) {
  if (!block || !block.querySelectorAll) return '';
  const cells = Array.from(block.querySelectorAll('table td, table th'));
  for (const cell of cells) {
    const hasReadableText = cleanInlineText(cell.textContent).length > 0;
    if (!hasReadableText) continue;
    const styleMap = styleEntriesToMap(cell.getAttribute('style') || '');
    const inset = extractPaddingLeftValue(styleMap);
    if (!inset || isZeroLengthValue(inset)) continue;
    return inset;
  }
  return '';
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function getNumericDimension(value) {
  const parsed = parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const MIN_CONTENT_MARGIN_LEFT_IN = 0.125;
const HANDWRITING_CONTENT_MARGIN_LEFT_IN = 0.075;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseCssLengthToInches(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/^([+-]?[0-9]*\.?[0-9]+)\s*(in|pt|px|pc|cm|mm)$/i);
  if (!match) return null;
  const magnitude = Number.parseFloat(match[1]);
  if (!Number.isFinite(magnitude)) return null;
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'in':
      return magnitude;
    case 'pt':
      return magnitude / 72;
    case 'px':
      return magnitude / 96;
    case 'pc':
      return magnitude / 6;
    case 'cm':
      return magnitude / 2.54;
    case 'mm':
      return magnitude / 25.4;
    default:
      return null;
  }
}

/**
 * @param {number} value
 * @returns {string}
 */
function toInchesCssValue(value) {
  const rounded = Number(value.toFixed(4));
  return `${rounded}in`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function loosenContentBaselineLeftMargin(value) {
  const original = String(value || '').trim();
  if (!original) return original;
  const inches = parseCssLengthToInches(original);
  if (inches === null) return original;
  if (inches >= MIN_CONTENT_MARGIN_LEFT_IN) return original;
  return toInchesCssValue(MIN_CONTENT_MARGIN_LEFT_IN);
}

/**
 * @param {DomElement | null | undefined} img
 * @returns {boolean}
 */
function isLikelyInlineIconImage(img) {
  if (!img || !img.getAttribute) return false;
  const width = getNumericDimension(img.getAttribute('width'));
  const height = getNumericDimension(img.getAttribute('height'));
  if (width !== null && width > 32) return false;
  if (height !== null && height > 32) return false;
  return true;
}

/**
 * @param {DomElement | null | undefined} img
 * @returns {boolean}
 */
function isLargeContentImage(img) {
  if (!img || !img.getAttribute) return false;
  const width = getNumericDimension(img.getAttribute('width'));
  const height = getNumericDimension(img.getAttribute('height'));
  if (width !== null && width >= 128) return true;
  if (height !== null && height >= 128) return true;
  return false;
}

/**
 * @param {DomElement | null | undefined} block
 * @returns {boolean}
 */
function isImageDominantContentBlock(block) {
  if (!block || !block.querySelectorAll) return false;
  const images = Array.from(block.querySelectorAll('img'));
  if (!images.length) return false;
  const hasLargeImage = images.some((img) => isLargeContentImage(img));
  if (!hasLargeImage) return false;

  const cloned = block.cloneNode(true);
  Array.from(cloned.querySelectorAll('img')).forEach((img) => img.remove());
  const text = cleanInlineText(cloned.textContent || '');
  return text.length === 0;
}

/**
 * @param {DomElement | null | undefined} block
 * @returns {boolean}
 */
function hasRasterHandwritingImage(block) {
  if (!block || !block.querySelector) return false;
  return !!block.querySelector('img[data-handwriting="raster"]');
}

/**
 * @param {DomElement | null | undefined} paragraph
 * @returns {boolean}
 */
function isStandaloneIconParagraph(paragraph) {
  if (!paragraph || !paragraph.tagName || paragraph.tagName.toLowerCase() !== 'p') return false;
  const directChildren = Array.from(paragraph.children || []);
  if (!directChildren.length) return false;
  if (!directChildren.every((child) => child.tagName && child.tagName.toLowerCase() === 'img')) return false;

  const directImages = directChildren;
  if (!directImages.length) return false;
  if (!directImages.every((img) => isLikelyInlineIconImage(img))) return false;

  const text = cleanInlineText(paragraph.textContent);
  return text.length === 0;
}

/**
 * @param {DomElement} block
 * @returns {InsetAlignmentResult}
 */
function alignStandaloneIconParagraphsToContentInset(block) {
  const inset = getDominantTableContentInset(block);
  if (!inset) {
    return {
      changed: 0,
      inset: ''
    };
  }

  let changed = 0;
  const directParagraphs = Array.from(block.querySelectorAll(':scope > p'));
  for (const paragraph of directParagraphs) {
    if (!isStandaloneIconParagraph(paragraph)) continue;
    const styleMap = styleEntriesToMap(paragraph.getAttribute('style') || '');
    const existingMarginLeft = String(styleMap.get('margin-left') || '').trim();
    if (existingMarginLeft && !isZeroLengthValue(existingMarginLeft)) continue;
    styleMap.set('margin-left', inset);
    const nextStyle = styleMapToString(styleMap);
    if (nextStyle) {
      paragraph.setAttribute('style', nextStyle);
    } else {
      paragraph.removeAttribute('style');
    }
    changed += 1;
  }

  return {
    changed,
    inset
  };
}

/**
 * @param {unknown} styleText
 * @param {string} [baselineMarginLeft='']
 * @returns {NormalizedStyleResult}
 */
function normalizeTitleBlockPositionStyle(styleText, baselineMarginLeft = '') {
  const styleMap = styleEntriesToMap(styleText);
  const before = styleMapToString(styleMap);

  const width = styleMap.get('width');
  if (width && isAbsoluteWidthValue(width)) {
    styleMap.delete('width');
  }

  styleMap.set('margin-left', '0');

  const after = styleMapToString(styleMap);
  return {
    changed: after !== before,
    style: after
  };
}

/**
 * @param {unknown} styleText
 * @param {string} [baselineMarginLeft='']
 * @returns {NormalizedStyleResult}
 */
function normalizeDateBlockPositionStyle(styleText, baselineMarginLeft = '') {
  const styleMap = styleEntriesToMap(styleText);
  const before = styleMapToString(styleMap);

  const width = styleMap.get('width');
  if (width && isAbsoluteWidthValue(width)) {
    styleMap.delete('width');
  }

  styleMap.delete('margin-top');
  styleMap.set('margin-left', '0');

  const after = styleMapToString(styleMap);
  return {
    changed: after !== before,
    style: after
  };
}

/**
 * @param {unknown} styleText
 * @param {string} [baselineMarginLeft='']
 * @returns {NormalizedStyleResult}
 */
function normalizeContentBlockLeftBaselineStyle(styleText, baselineMarginLeft = '') {
  const styleMap = styleEntriesToMap(styleText);
  const before = styleMapToString(styleMap);
  styleMap.set('margin-left', '0');
  const after = styleMapToString(styleMap);
  return {
    changed: after !== before,
    style: after
  };
}

/**
 * @param {unknown} styleText
 * @param {string} [baselineMarginLeft='']
 * @returns {NormalizedStyleResult}
 */
function normalizeContentBlockToExactBaselineStyle(styleText, baselineMarginLeft = '') {
  if (!baselineMarginLeft) {
    return {
      changed: false,
      style: String(styleText || '')
    };
  }
  const styleMap = styleEntriesToMap(styleText);
  const before = styleMapToString(styleMap);
  styleMap.set('margin-left', baselineMarginLeft);
  const after = styleMapToString(styleMap);
  return {
    changed: after !== before,
    style: after
  };
}

/**
 * @param {unknown} styleText
 * @returns {NormalizedStyleResult}
 */
function normalizeRootDocumentMarginStyle(styleText) {
  const styleMap = styleEntriesToMap(styleText);
  const before = styleMapToString(styleMap);
  styleMap.set('margin-top', '2rem');
  styleMap.set('margin-left', '2rem');

  const after = styleMapToString(styleMap);
  return {
    changed: after !== before,
    style: after
  };
}

/**
 * @param {DomElement | null | undefined} el
 * @param {StyleDefaultsMap} [declarations={}]
 * @returns {boolean}
 */
function setStyleDefaults(el, declarations = {}) {
  if (!el || !el.getAttribute) return false;
  const styleMap = styleEntriesToMap(el.getAttribute('style') || '');
  const before = styleMapToString(styleMap);

  Object.entries(declarations).forEach(([prop, value]) => {
    styleMap.set(prop, value);
  });

  const after = styleMapToString(styleMap);
  if (after === before) return false;
  if (after) {
    el.setAttribute('style', after);
  } else {
    el.removeAttribute('style');
  }
  return true;
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
function isLikelyDateText(text) {
  const value = cleanInlineText(text);
  if (!value) return false;
  const monthDate = /^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/i;
  const monthDateWithWeekday = /^(?:[A-Za-z]{3,},\s+)?[A-Za-z]{3,}\s+\d{1,2},\s+\d{4}$/i;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const slashDate = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;
  return monthDate.test(value) || monthDateWithWeekday.test(value) || isoDate.test(value) || slashDate.test(value);
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
function isLikelyTimeText(text) {
  const value = cleanInlineText(text);
  if (!value) return false;
  return /^\d{1,2}:\d{2}(?::\d{2})?(\s?[AP]M)?$/i.test(value);
}

/**
 * @param {DomElement | null | undefined} el
 * @returns {boolean}
 */
function looksLikeDateTimeContainer(el) {
  if (!el || !el.querySelectorAll) return false;
  if (el.querySelector(':scope > p > span.created-time')) return true;
  const paragraphs = Array.from(el.querySelectorAll(':scope > p'));
  if (paragraphs.length < 2) return false;
  const dateText = cleanInlineText(paragraphs[0].textContent);
  const timeText = cleanInlineText(paragraphs[1].textContent);
  return isLikelyDateText(dateText) && isLikelyTimeText(timeText);
}

/**
 * @param {DomElement | null | undefined} el
 * @returns {boolean}
 */
function looksLikeTitleContainer(el) {
  if (!el || !el.querySelectorAll) return false;
  if (el.querySelector(':scope > h1')) return true;
  const directChildren = Array.from(el.children || []);
  return directChildren.some((child) => looksLikeOneNoteTitleCandidate(child));
}

/**
 * @param {DomElement | null | undefined} el
 * @returns {boolean}
 */
function isOneNoteFloatingFileReferencePlaceholder(el) {
  if (!el || !el.tagName || String(el.tagName).toLowerCase() !== 'div') return false;
  if (el.querySelector && el.querySelector('img,svg,canvas,picture,video,audio,iframe,object,embed,table,ul,ol,pre,code')) {
    return false;
  }

  const text = cleanInlineText(el.textContent || '');
  if (!/^<<[^<>]{1,200}>>$/.test(text)) return false;

  const styleMap = styleEntriesToMap(el.getAttribute('style') || '');
  const direction = String(styleMap.get('direction') || '').trim().toLowerCase();
  if (direction !== 'ltr') return false;

  const marginTop = parseCssLengthToInches(styleMap.get('margin-top') || '');
  if (marginTop === null || marginTop < 1) return false;

  return true;
}

/**
 * @param {DomDocument} doc
 * @param {DirectionLayoutNormalizationOptions} [options={}]
 * @returns {DirectionLayoutNormalizationLogEntry[]}
 */
export function normalizeDirectionLayoutContainers(doc, options = {}) {
  const logs = /** @type {DirectionLayoutNormalizationLogEntry[]} */ ([]);
  const main = doc.querySelector('main');
  if (!main) return logs;

  const unwrapRedundantWrappers = options.unwrapRedundantWrappers !== false;
  const normalizeTopLevelPageWidths = options.normalizeTopLevelPageWidths !== false;
  const standardizeHeaderDatePositions = options.standardizeHeaderDatePositions !== false;

  let wrappersUnwrapped = 0;
  if (unwrapRedundantWrappers) {
    let changed = true;
    while (changed) {
      changed = false;
      const wrappers = Array.from(main.querySelectorAll('div[style]'));
      for (const wrapper of wrappers) {
        if (wrapper.closest('table,thead,tbody,tfoot,tr,td,th,li')) continue;
        if (!isDirectionLtrOnlyStyle(wrapper.getAttribute('style'))) continue;
        if (hasUnsafeWrapperAttributes(wrapper)) continue;
        if (hasSignificantTextNodeChildren(wrapper)) continue;

        const elementChildren = Array.from(wrapper.children || []);
        if (elementChildren.length !== 1) continue;

        const child = elementChildren[0];
        if (!child || !child.tagName || child.tagName.toLowerCase() !== 'div') continue;

        wrapper.replaceWith(child);
        wrappersUnwrapped += 1;
        changed = true;
        break;
      }
    }
  }

  const topLevelDivs = Array.from(main.children || []).filter((el) => el.tagName && el.tagName.toLowerCase() === 'div');
  const rootLayout = topLevelDivs[0] || null;

  let widthsNormalized = 0;
  if (normalizeTopLevelPageWidths) {
    for (const div of topLevelDivs) {
      if (div.closest('table,thead,tbody,tfoot,tr,td,th,li')) continue;
      const styleText = String(div.getAttribute('style') || '');
      if (!styleText) continue;
      const entries = parseInlineStyle(styleText);
      const hasDirectionLtr = entries.some(({ prop, value }) => prop === 'direction' && /^ltr$/i.test(String(value || '').trim()));
      if (!hasDirectionLtr) continue;

      const next = stripAbsoluteWidthDeclaration(styleText);
      if (!next.removed) continue;

      if (next.style) {
        div.setAttribute('style', next.style);
      } else {
        div.removeAttribute('style');
      }
      widthsNormalized += 1;
    }
  }

  let rootMarginsStandardized = 0;
  if (standardizeHeaderDatePositions && rootLayout) {
    const rootStyleText = String(rootLayout.getAttribute('style') || '');
    if (rootStyleText) {
      const rootEntries = parseInlineStyle(rootStyleText);
      const rootHasDirectionLtr = rootEntries.some(({ prop, value }) => prop === 'direction' && /^ltr$/i.test(String(value || '').trim()));
      if (rootHasDirectionLtr) {
        const nextRootStyle = normalizeRootDocumentMarginStyle(rootStyleText);
        if (nextRootStyle.changed) {
          if (nextRootStyle.style) {
            rootLayout.setAttribute('style', nextRootStyle.style);
          } else {
            rootLayout.removeAttribute('style');
          }
          rootMarginsStandardized += 1;
        }
      }
    }
  }

  let positionsStandardized = 0;
  let firstContentBlockMarginsStandardized = 0;
  let handwritingContentMarginsStandardized = 0;
  let iconParagraphsAligned = 0;
  let placeholderReferencesRemoved = 0;
  if (standardizeHeaderDatePositions && rootLayout) {
    let sectionBlocks = Array.from(rootLayout.children || []).filter((el) => el.tagName && el.tagName.toLowerCase() === 'div');

    sectionBlocks.forEach((block) => {
      if (isOneNoteFloatingFileReferencePlaceholder(block)) {
        block.remove();
        placeholderReferencesRemoved += 1;
      }
    });
    if (placeholderReferencesRemoved > 0) {
      sectionBlocks = Array.from(rootLayout.children || []).filter((el) => el.tagName && el.tagName.toLowerCase() === 'div');
    }

    let titleBlock = null;
    let dateBlock = null;
    let firstContentBlock = null;

    for (const block of sectionBlocks) {
      if (block.closest('table,thead,tbody,tfoot,tr,td,th,li')) continue;

      const styleText = String(block.getAttribute('style') || '');
      if (!styleText) continue;
      const entries = parseInlineStyle(styleText);
      const hasDirectionLtr = entries.some(({ prop, value }) => prop === 'direction' && /^ltr$/i.test(String(value || '').trim()));
      if (!hasDirectionLtr) continue;

      const isTitleBlock = looksLikeTitleContainer(block);
      const isDateBlock = looksLikeDateTimeContainer(block);
      if (isTitleBlock && !titleBlock) {
        titleBlock = block;
        continue;
      }
      if (isDateBlock && !dateBlock) {
        dateBlock = block;
        continue;
      }
      if (!isTitleBlock && !isDateBlock && !firstContentBlock) {
        firstContentBlock = block;
      }
    }

    /** @param {DomElement | null | undefined} block */
    const readMarginLeft = (block) => {
      if (!block) return '';
      const styleMap = styleEntriesToMap(block.getAttribute('style') || '');
      return String(styleMap.get('margin-left') || '').trim();
    };
    const rootMarginLeft = readMarginLeft(rootLayout);
    const baselineMarginLeft = readMarginLeft(titleBlock) || readMarginLeft(dateBlock) || rootMarginLeft;
    const contentBaselineMarginLeft = loosenContentBaselineLeftMargin(baselineMarginLeft);
    const hasRasterHandwritingContent = sectionBlocks.some((block) => hasRasterHandwritingImage(block));
    const handwritingMarginBaseline = toInchesCssValue(HANDWRITING_CONTENT_MARGIN_LEFT_IN);

    for (const block of sectionBlocks) {
      if (block.closest('table,thead,tbody,tfoot,tr,td,th,li')) continue;

      const styleText = String(block.getAttribute('style') || '');
      if (!styleText) continue;
      const entries = parseInlineStyle(styleText);
      const hasDirectionLtr = entries.some(({ prop, value }) => prop === 'direction' && /^ltr$/i.test(String(value || '').trim()));
      if (!hasDirectionLtr) continue;

      if (block === firstContentBlock) {
        const contentMarginBaselineForBlock = isImageDominantContentBlock(block)
          ? toInchesCssValue(
            hasRasterHandwritingImage(block)
              ? HANDWRITING_CONTENT_MARGIN_LEFT_IN
              : MIN_CONTENT_MARGIN_LEFT_IN
          )
          : contentBaselineMarginLeft;
        const nextContentStyle = normalizeContentBlockLeftBaselineStyle(styleText, contentMarginBaselineForBlock);
        if (nextContentStyle.changed) {
          if (nextContentStyle.style) {
            block.setAttribute('style', nextContentStyle.style);
          } else {
            block.removeAttribute('style');
          }
          firstContentBlockMarginsStandardized += 1;
        }
      }

      const isTitleBlock = block === titleBlock;
      const isDateBlock = block === dateBlock;

      if (!isTitleBlock && !isDateBlock && block !== firstContentBlock && hasRasterHandwritingContent) {
        const nextHandwritingMargin = normalizeContentBlockToExactBaselineStyle(styleText, handwritingMarginBaseline);
        if (nextHandwritingMargin.changed) {
          if (nextHandwritingMargin.style) {
            block.setAttribute('style', nextHandwritingMargin.style);
          } else {
            block.removeAttribute('style');
          }
          handwritingContentMarginsStandardized += 1;
        }
      }

      if (!isTitleBlock && !isDateBlock) continue;

      let next;
      if (isTitleBlock) {
        next = normalizeTitleBlockPositionStyle(styleText, baselineMarginLeft);
      } else if (isDateBlock) {
        next = normalizeDateBlockPositionStyle(styleText, baselineMarginLeft);
      }

      if (!next || !next.changed) continue;

      if (next.style) {
        block.setAttribute('style', next.style);
      } else {
        block.removeAttribute('style');
      }
      positionsStandardized += 1;
    }

    if (firstContentBlock) {
      const iconAlignment = alignStandaloneIconParagraphsToContentInset(firstContentBlock);
      iconParagraphsAligned = iconAlignment.changed;
    }
  }

  if (wrappersUnwrapped || widthsNormalized || rootMarginsStandardized || firstContentBlockMarginsStandardized || positionsStandardized || iconParagraphsAligned || placeholderReferencesRemoved) {
    logs.push({
      step: 'NormalizeDirectionLayoutContainers',
      wrappersUnwrapped,
      widthsNormalized,
      rootMarginsStandardized,
      firstContentBlockMarginsStandardized,
      handwritingContentMarginsStandardized,
      positionsStandardized,
      iconParagraphsAligned,
      placeholderReferencesRemoved
    });
  }

  return logs;
}

/**
 * @param {DomDocument} doc
 * @returns {HeaderDateTimeStyleLogEntry[]}
 */
export function enforceHeaderDateTimeStyles(doc) {
  const logs = /** @type {HeaderDateTimeStyleLogEntry[]} */ ([]);
  const main = doc.querySelector('main');
  if (!main) return logs;

  let titleStyled = 0;
  let dateStyled = 0;
  let timeStyled = 0;

  const title = main.querySelector('h1');
  if (title) {
    const existingTitleStyle = styleEntriesToMap(title.getAttribute('style') || '');
    const titleFontFamily = String(existingTitleStyle.get('font-family') || '').trim() || 'Calibri Light, Calibri, Arial, sans-serif';
    const titleChanged = setStyleDefaults(title, {
      'font-family': titleFontFamily,
      'font-size': '20pt',
      'font-weight': '400',
      'margin': '0',
      'display': 'inline-block',
      'padding-right': '1in',
      'padding-bottom': '0.08em',
      'border-bottom': '1px solid #b7b7b7'
    });
    addClass(title, 'converted-page-title');
    if (titleChanged) titleStyled += 1;
  }

  const dateContainer = Array.from(main.querySelectorAll('div')).find((el) => looksLikeDateTimeContainer(el));
  if (dateContainer) {
    const paragraphs = Array.from(dateContainer.querySelectorAll(':scope > p'));
    if (paragraphs.length) {
      const dateParagraph = paragraphs[0];
      const dateChanged = setStyleDefaults(dateParagraph, {
        'font-family': 'Calibri, Arial, sans-serif',
        'font-size': '10pt',
        color: '#666666',
        margin: '0'
      });
      addClass(dateParagraph, 'converted-page-date');
      if (dateChanged) dateStyled += 1;

      const createdTime = dateParagraph.querySelector(':scope > span.created-time');
      if (createdTime) {
        const timeChanged = setStyleDefaults(createdTime, {
          'font-family': 'Calibri, Arial, sans-serif',
          'font-size': '10pt',
          color: '#666666'
        });
        addClass(createdTime, 'converted-page-time');
        if (timeChanged) timeStyled += 1;
      } else if (paragraphs[1]) {
        const timeParagraph = paragraphs[1];
        const timeParagraphChanged = setStyleDefaults(timeParagraph, {
          'font-family': 'Calibri, Arial, sans-serif',
          'font-size': '10pt',
          color: '#666666',
          margin: '0'
        });
        addClass(timeParagraph, 'converted-page-time');
        if (timeParagraphChanged) timeStyled += 1;
      }
    }
  }

  if (titleStyled || dateStyled || timeStyled) {
    logs.push({
      step: 'EnforceHeaderDateTimeStyles',
      titleStyled,
      dateStyled,
      timeStyled
    });
  }

  return logs;
}