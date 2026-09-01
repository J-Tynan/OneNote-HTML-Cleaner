// @ts-check

/**
 * @typedef {{
 *   className?: string,
 *   textContent?: string | null,
 *   getAttribute: (name: string) => string | null,
 *   setAttribute: (name: string, value: string) => void,
 *   querySelector: (selector: string) => DomElement | null,
 *   querySelectorAll: (selector: string) => ArrayLike<DomElement>,
 *   appendChild: (child: DomElement) => void,
 *   remove: () => void
 * }} DomElement
 * @typedef {{
 *   querySelectorAll: (selector: string) => ArrayLike<DomElement>,
 *   createElement: (tagName: string) => DomElement
 * }} DomDocument
 * @typedef {{ gap?: string }} MergeCreatedDateTimeRowOptions
 * @typedef {{ step: 'mergeCreatedDateTimeRow', merged: number, gap: string }} MergeCreatedDateTimeRowLogEntry
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} text
 * @returns {boolean}
 */
function isDateText(text) {
  const value = cleanText(text);
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
function isTimeText(text) {
  const value = cleanText(text);
  if (!value) return false;
  return /^\d{1,2}:\d{2}(?::\d{2})?(\s?[AP]M)?$/i.test(value);
}

/**
 * @param {DomDocument} doc
 * @param {MergeCreatedDateTimeRowOptions} [options={}]
 * @returns {MergeCreatedDateTimeRowLogEntry[]}
 */
export function mergeCreatedDateTimeRow(doc, options = {}) {
  const logs = /** @type {MergeCreatedDateTimeRowLogEntry[]} */ ([]);
  const gap = options.gap || '0.75em';
  const containers = Array.from(doc.querySelectorAll('div'));
  let merged = 0;

  containers.forEach(container => {
    const paragraphs = Array.from(container.querySelectorAll(':scope > p'));
    if (paragraphs.length < 2) return;

    for (let i = 0; i < paragraphs.length - 1; i++) {
      const dateP = paragraphs[i];
      const timeP = paragraphs[i + 1];
      const dateText = cleanText(dateP.textContent);
      const timeText = cleanText(timeP.textContent);
      if (!isDateText(dateText) || !isTimeText(timeText)) continue;

      const existingSpan = dateP.querySelector(':scope > span.created-time');
      if (existingSpan) continue;

      const timeSpan = doc.createElement('span');
      timeSpan.className = 'created-time';
      timeSpan.textContent = timeText;
      const timeStyle = timeP.getAttribute('style');
      if (timeStyle && timeStyle.trim()) {
        timeSpan.setAttribute('style', `${timeStyle}; margin-left: ${gap}`);
      } else {
        timeSpan.setAttribute('style', `margin-left: ${gap}`);
      }

      dateP.textContent = dateText;
      dateP.appendChild(timeSpan);
      timeP.remove();
      merged += 1;
      break;
    }
  });

  if (merged) {
    logs.push({ step: 'mergeCreatedDateTimeRow', merged, gap });
  }

  return logs;
}
