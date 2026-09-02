// @ts-check

import { normalizeExportConfig } from './config.js';

/**
 * @typedef {import('../contracts.js').ExportConfig} ExportConfig
 * @typedef {import('../contracts.js').ExportFormat} ExportFormat
 * @typedef {import('../contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('../contracts.js').ToolbarStyle} ToolbarStyle
 * @typedef {import('../contracts.js').WarningDetail} WarningDetail
 * @typedef {'html' | 'mht' | 'one' | 'onepkg'} NormalizedSourceKind
 * @typedef {{ total?: number, info?: number, warning?: number, error?: number }} WarningSummaryInput
 * @typedef {{ total: number, info: number, warning: number, error: number }} WarningSummary
 * @typedef {{ sourceName: string, sourceKind: NormalizedSourceKind, pageTitle: string, exportFormat: ExportFormat, timestamp: string }} ToolbarMetadata
 * @typedef {{ key: string, label: string, blockTag: string, blockStyles: Record<string, string> }} EditStyleOption
 * @typedef {PipelineConfigInput & {
 *   SourceName?: unknown,
 *   sourceName?: unknown,
 *   fileName?: unknown,
 *   SourceKind?: unknown,
 *   sourceKind?: unknown,
 *   PageTitle?: unknown,
 *   pageTitle?: unknown,
 *   ConversionTimestamp?: unknown,
 *   conversionTimestamp?: unknown,
 *   WarningSummary?: WarningSummaryInput,
 *   exportState?: PipelineConfigInput | null | undefined
 * }} ToolbarInjectorOptions
 */

const TOOLBAR_ROOT_ID = 'onenote-cleaner-toolbar';
const TOOLBAR_VERSION = 'v1';
const TOOLBAR_STYLE_ID = 'onc-toolbar-style';
const TOOLBAR_SCRIPT_ID = 'onc-toolbar-script';
const TOOLBAR_METADATA_ID = 'onc-toolbar-metadata';
const TOOLBAR_SHOW_BUTTON_ID = 'onc-toolbar-show';
const CONVERTED_THEME_ROOT_ID = 'onc-converted-theme-toggle';
const CONVERTED_THEME_STYLE_ID = 'onc-converted-theme-style';
const CONVERTED_THEME_SCRIPT_ID = 'onc-converted-theme-script';
const CONVERTED_THEME_VERSION = 'v1';
/** @type {readonly EditStyleOption[]} */
const EDIT_STYLE_OPTIONS = [
  {
    key: 'page-title',
    label: 'Page Title',
    blockTag: 'p',
    blockStyles: {
      margin: '0',
      fontFamily: '"Calibri Light", Calibri, sans-serif',
      fontSize: '20.0pt',
      color: '#000000',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-1',
    label: 'Heading 1',
    blockTag: 'h1',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '16.0pt',
      color: '#1E4E79',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-2',
    label: 'Heading 2',
    blockTag: 'h2',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '14.0pt',
      color: '#2E75B5',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-3',
    label: 'Heading 3',
    blockTag: 'h3',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '12.0pt',
      color: '#5B9BD5',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-4',
    label: 'Heading 4',
    blockTag: 'h4',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '12.0pt',
      color: '#5B9BD5',
      fontStyle: 'italic',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-5',
    label: 'Heading 5',
    blockTag: 'h5',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11.0pt',
      color: '#2E75B5',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'heading-6',
    label: 'Heading 6',
    blockTag: 'h6',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11.0pt',
      color: '#2E75B5',
      fontStyle: 'italic',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'citation',
    label: 'Citation',
    blockTag: 'p',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '9.0pt',
      color: '#595959',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'quote',
    label: 'Quote',
    blockTag: 'blockquote',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11.0pt',
      color: '#595959',
      fontStyle: 'italic',
      fontWeight: 'normal',
      textIndent: '0'
    }
  },
  {
    key: 'code',
    label: 'Code',
    blockTag: 'pre',
    blockStyles: {
      margin: '0',
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11.0pt',
      color: '#111827',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0',
      whiteSpace: 'pre-wrap',
      backgroundColor: '#f3f4f6',
      padding: '.35rem .5rem',
      borderRadius: '.25rem'
    }
  },
  {
    key: 'normal',
    label: 'Normal',
    blockTag: 'p',
    blockStyles: {
      margin: '0',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11.0pt',
      color: '#000000',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textIndent: '0'
    }
  }
];

/**
 * @param {unknown} [value='']
 * @returns {string}
 */
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch] || ch));
}

/**
 * @param {unknown} [value='']
 * @returns {NormalizedSourceKind}
 */
function normalizeSourceKind(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mht' || normalized === 'mhtml') return 'mht';
  if (normalized === 'one' || normalized === 'onepkg') return normalized;
  return 'html';
}

/**
 * @param {WarningSummaryInput} [summary={}]
 * @returns {WarningSummary}
 */
function normalizeWarningSummary(summary = {}) {
  const info = Number(summary.info || 0);
  const warning = Number(summary.warning || 0);
  const error = Number(summary.error || 0);
  const total = Number(summary.total || (info + warning + error));
  return { total, info, warning, error };
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {ExportConfig}
 */
function resolveExportState(options = {}) {
  const candidate = options && options.exportState && typeof options.exportState === 'object'
    ? options.exportState
    : options;
  return normalizeExportConfig(candidate);
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @param {ExportConfig} [exportState=resolveExportState(options)]
 * @returns {ToolbarMetadata}
 */
function buildMetadata(options = {}, exportState = resolveExportState(options)) {
  return {
    sourceName: String(options.SourceName || options.sourceName || options.fileName || 'Unknown source'),
    sourceKind: normalizeSourceKind(options.SourceKind || options.sourceKind || 'html'),
    pageTitle: String(options.PageTitle || options.pageTitle || ''),
    exportFormat: exportState.ExportFormat,
    timestamp: String(options.ConversionTimestamp || options.conversionTimestamp || new Date().toISOString())
  };
}

/**
 * @param {unknown} [html='']
 * @returns {boolean}
 */
function hasToolbarRoot(html = '') {
  const source = String(html || '');
  const hasId = new RegExp(`id=["']${TOOLBAR_ROOT_ID}["']`, 'i').test(source);
  const hasMarker = /data-onc-toolbar=["']v1["']/i.test(source);
  return hasId && hasMarker;
}

/**
 * @param {unknown} [html='']
 * @returns {boolean}
 */
function hasConvertedThemeToggleRoot(html = '') {
  const source = String(html || '');
  const hasId = new RegExp(`id=["']${CONVERTED_THEME_ROOT_ID}["']`, 'i').test(source);
  const hasMarker = /data-onc-converted-theme-toggle=["']v1["']/i.test(source);
  return hasId && hasMarker;
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {ToolbarStyle}
 */
function resolveToolbarStyle(options = {}) {
  const normalized = String(options.ToolbarStyle || '').trim().toLowerCase();
  if (normalized === 'classic' || normalized === 'office-97' || normalized === 'office') return 'office';
  if (normalized === 'ribbon') return 'ribbon';
  return 'compact';
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {boolean}
 */
function usesDeferredExportStyles(options = {}) {
  return String(options.ExportStylesMode || '').trim().toLowerCase() === 'deferred';
}

/**
 * @param {unknown} [source='']
 * @returns {string}
 */
function minifyInlineCss(source = '') {
  return String(source || '')
    .trim()
    .replace(/;}/g, '}');
}

/**
 * @param {unknown} [source='']
 * @returns {string}
 */
function minifyInlineScript(source = '') {
  return String(source || '')
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');
}

function buildBaseStyleCss() {
  return '#onenote-cleaner-toolbar{position:sticky;top:0;z-index:9999;background:var(--onc-toolbar-bg,#fff);color:var(--onc-toolbar-fg,#1f2a37);border-bottom:1px solid var(--onc-toolbar-border,#d7dce2);padding:var(--onc-toolbar-padding,.45rem .65rem);font:var(--onc-toolbar-font,13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif);}' +
    '#onenote-cleaner-toolbar .onc-toolbar-row{display:flex;flex-wrap:wrap;gap:var(--onc-toolbar-gap,.4rem);align-items:center;}' +
    '#onenote-cleaner-toolbar .onc-edit-tools{margin-top:.35rem;}' +
    '#onenote-cleaner-toolbar [data-onc-role="edit-tools"][hidden]{display:none !important;}' +
    '#onenote-cleaner-toolbar .onc-title{font-weight:600;margin-right:.25rem;}' +
    '#onenote-cleaner-toolbar .onc-btn,#onc-toolbar-show{border:1px solid var(--onc-toolbar-btn-border,#b7c0cc);background:var(--onc-toolbar-btn-bg,#fff);color:inherit;border-radius:var(--onc-toolbar-radius,.35rem);padding:var(--onc-toolbar-btn-padding,.24rem .48rem);cursor:pointer;font:inherit;box-shadow:var(--onc-toolbar-btn-shadow,none);}' +
    '#onenote-cleaner-toolbar .onc-select{min-width:var(--onc-toolbar-select-width,9rem);max-width:100%;}' +
    '#onenote-cleaner-toolbar .onc-color-input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none;}' +
    '#onenote-cleaner-toolbar .onc-btn[aria-pressed="true"]{background:var(--onc-toolbar-active-bg,#eef5ff);border-color:var(--onc-toolbar-active-border,#7ea5e0);}' +
    '#onenote-cleaner-toolbar .onc-btn[data-onc-active="true"]{background:var(--onc-toolbar-active-bg,#eef5ff);border-color:var(--onc-toolbar-active-border,#7ea5e0);}' +
    '#onenote-cleaner-toolbar .onc-btn:focus-visible,#onc-toolbar-show:focus-visible{outline:2px solid #7ea5e0;outline-offset:2px;}' +
    '#onenote-cleaner-toolbar .onc-muted{font-size:12px;color:#4b5563;}' +
    '#onenote-cleaner-toolbar .onc-panel{margin-top:.5rem;border:1px solid var(--onc-toolbar-panel-border,#d7dce2);border-radius:var(--onc-toolbar-radius,.35rem);padding:.5rem;background:var(--onc-toolbar-panel-bg,#f8fafc);}' +
    '#onenote-cleaner-toolbar .onc-panel dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem .5rem;margin:0;}' +
    '#onenote-cleaner-toolbar .onc-panel dt{font-weight:600;}' +
    '#onenote-cleaner-toolbar .onc-panel dd{margin:0;word-break:break-word;}' +
    '#onc-toolbar-show{position:fixed;right:3.35rem;top:var(--onc-floating-top,.75rem);bottom:auto;z-index:10000;font-size:11px;padding:var(--onc-toolbar-show-padding,.18rem .42rem);}' +
    '@media (max-width: 640px){#onenote-cleaner-toolbar{padding:var(--onc-toolbar-mobile-padding,.375rem .5rem);font:var(--onc-toolbar-mobile-font,12px/1.25 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif);}#onenote-cleaner-toolbar .onc-toolbar-row{gap:var(--onc-toolbar-mobile-gap,.3rem);}#onenote-cleaner-toolbar .onc-btn,#onc-toolbar-show{padding:var(--onc-toolbar-mobile-btn-padding,.18rem .34rem);}#onenote-cleaner-toolbar .onc-select{min-width:7.25rem;}}' +
    'html[data-onc-converted-theme="black"] #onenote-cleaner-toolbar{background:var(--onc-converted-bg,#000);color:var(--onc-converted-fg,#d6d6cf);border-bottom-color:rgba(148,163,184,.35);}' +
    'html[data-onc-converted-theme="black"] #onenote-cleaner-toolbar .onc-btn,html[data-onc-converted-theme="black"] #onc-toolbar-show{background:rgba(15,23,42,.38);color:var(--onc-converted-fg,#d6d6cf);border-color:rgba(148,163,184,.45);box-shadow:none;}' +
    'html[data-onc-converted-theme="black"] #onenote-cleaner-toolbar .onc-btn[aria-pressed="true"]{background:rgba(59,130,246,.22);border-color:rgba(125,177,255,.7);}' +
    'html[data-onc-converted-theme="black"] #onenote-cleaner-toolbar .onc-panel{background:rgba(15,23,42,.32);border-color:rgba(148,163,184,.35);}' +
    'html[data-onc-converted-theme="black"] #onenote-cleaner-toolbar .onc-muted{color:#cbd5e1;}' +
    '[data-onc-editing="true"] [data-onc-editable="1"]{outline:1px dashed #7ea5e0;outline-offset:2px;}';
}

/**
 * @param {ToolbarStyle} toolbarStyle
 * @returns {string}
 */
function buildToolbarSkinCss(toolbarStyle) {
  if (toolbarStyle === 'office') {
    return '#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"]{--onc-toolbar-bg:#d4d0c8;--onc-toolbar-fg:#1f1f1f;--onc-toolbar-border:#808080;--onc-toolbar-padding:.35rem .5rem;--onc-toolbar-mobile-padding:.35rem .5rem;--onc-toolbar-gap:.3rem;--onc-toolbar-mobile-gap:.3rem;--onc-toolbar-btn-bg:#ece9d8;--onc-toolbar-btn-border:#7a7a70;--onc-toolbar-radius:.15rem;--onc-toolbar-btn-padding:.18rem .4rem;--onc-toolbar-btn-shadow:inset 1px 1px 0 rgba(255,255,255,.75);--onc-toolbar-panel-bg:#ece9d8;--onc-toolbar-panel-border:#808080;--onc-toolbar-show-padding:.14rem .32rem;--onc-toolbar-mobile-btn-padding:.14rem .28rem;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"] .onc-title{font-size:11px;letter-spacing:.02em;text-transform:uppercase;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"] .onc-btn[aria-pressed="true"],#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"] .onc-btn[data-onc-active="true"]{background:#d6def4;border-color:#51607a;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"] .onc-btn:hover,#onenote-cleaner-toolbar[data-onc-toolbar-preset="office"] #onc-toolbar-show:hover{filter:brightness(.98);}';
  }

  if (toolbarStyle === 'ribbon') {
    return '#onenote-cleaner-toolbar[data-onc-toolbar-preset="ribbon"]{--onc-toolbar-bg:linear-gradient(180deg,#f7fbff,#e6eef8);--onc-toolbar-fg:#12324a;--onc-toolbar-border:#b8cce0;--onc-toolbar-padding:.5rem .75rem;--onc-toolbar-mobile-padding:.4rem .55rem;--onc-toolbar-gap:.45rem;--onc-toolbar-mobile-gap:.32rem;--onc-toolbar-btn-bg:#ffffff;--onc-toolbar-btn-border:#aac0d6;--onc-toolbar-radius:.5rem;--onc-toolbar-btn-padding:.24rem .55rem;--onc-toolbar-btn-shadow:0 1px 0 rgba(255,255,255,.9), inset 0 1px 0 rgba(255,255,255,.7);--onc-toolbar-panel-bg:#ffffff;--onc-toolbar-panel-border:#c8d7e6;--onc-toolbar-show-padding:.18rem .42rem;--onc-toolbar-mobile-btn-padding:.18rem .34rem;--onc-toolbar-select-width:9.5rem;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="ribbon"] .onc-title{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#36526b;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="ribbon"] .onc-btn[aria-pressed="true"],#onenote-cleaner-toolbar[data-onc-toolbar-preset="ribbon"] .onc-btn[data-onc-active="true"]{background:#dcecff;border-color:#7aa6d1;}' +
      '#onenote-cleaner-toolbar[data-onc-toolbar-preset="ribbon"] .onc-panel{box-shadow:0 1px 2px rgba(15,23,42,.06);}';
  }

  return '#onenote-cleaner-toolbar[data-onc-toolbar-preset="compact"]{--onc-toolbar-bg:#fff;--onc-toolbar-fg:#1f2a37;--onc-toolbar-border:#d7dce2;--onc-toolbar-padding:.3rem .45rem;--onc-toolbar-mobile-padding:.24rem .36rem;--onc-toolbar-gap:.25rem;--onc-toolbar-mobile-gap:.2rem;--onc-toolbar-font:12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;--onc-toolbar-mobile-font:11px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;--onc-toolbar-btn-bg:#fff;--onc-toolbar-btn-border:#b7c0cc;--onc-toolbar-radius:.3rem;--onc-toolbar-btn-padding:.16rem .34rem;--onc-toolbar-panel-bg:#f8fafc;--onc-toolbar-panel-border:#d7dce2;--onc-toolbar-show-padding:.12rem .28rem;--onc-toolbar-mobile-btn-padding:.12rem .24rem;--onc-toolbar-select-width:8rem;}';
}

/**
 * @param {ToolbarStyle} [toolbarStyle='compact']
 * @returns {string}
 */
function buildStyleTag(toolbarStyle = 'compact') {
  const css = `${buildBaseStyleCss()}${buildToolbarSkinCss(toolbarStyle)}`;
  return `<style id="${TOOLBAR_STYLE_ID}" data-onc-toolbar-style="${TOOLBAR_VERSION}" data-onc-toolbar-preset="${toolbarStyle}">` +
    css +
    '</style>';
}

function buildScriptTag() {
  const serializedEditStyles = JSON.stringify(
    EDIT_STYLE_OPTIONS.map((style) => [style.key, style.blockTag, style.blockStyles])
  ).replace(/</g, '\\u003c');
  const script = `(function(){
  function init(){
  const root = document.getElementById('${TOOLBAR_ROOT_ID}');
  if (!root) return false;
  if (root.dataset.oncInitialized === '1') return true;
  root.dataset.oncInitialized = '1';
  const html = document.documentElement;

  const showButton = document.getElementById('${TOOLBAR_SHOW_BUTTON_ID}');
  const metadataPanel = root.querySelector('[data-onc-role="metadata-panel"]');
  const editTools = root.querySelector('[data-onc-role="edit-tools"]');
  const editToggle = root.querySelector('[data-onc-action="edit-toggle"]');
  const metadataToggle = root.querySelector('[data-onc-action="metadata-toggle"]');
  const hideButton = root.querySelector('[data-onc-action="hide-toolbar"]');
  const saveButton = root.querySelector('[data-onc-action="save"]');
  const styleSelect = root.querySelector('[data-onc-role="style-select"]');
  const colorInput = root.querySelector('[data-onc-role="color-input"]');
  const metadataScript = document.getElementById('${TOOLBAR_METADATA_ID}');
  const canEdit = root.dataset.oncEditEnabled === 'true';
  const canMetadata = root.dataset.oncMetadataEnabled === 'true';
  const editCommandButtons = Array.from(root.querySelectorAll('button[data-onc-edit-command]'));
  const editStyles = ${serializedEditStyles};
  let lastCommandHint = '';

  if (!canEdit && editToggle) editToggle.hidden = true;
  if (!canMetadata && metadataToggle) metadataToggle.hidden = true;
  if (!canMetadata && metadataPanel) metadataPanel.hidden = true;

  let metadata = null;
  try {
    metadata = metadataScript ? JSON.parse(metadataScript.textContent || '{}') : null;
  } catch (_err) {
    metadata = null;
  }

  function hasSemanticsMarker(node){
    if (!node || !node.closest) return false;
    const semanticHit = node.closest('[data-onc-table-layout],[data-onc-col-role]');
    if (semanticHit) return true;
    return false;
  }

  function editableTargets(){
    const targets = Array.from(document.querySelectorAll('p, li, td'));
    return targets.filter((node) => {
      if (!node || !node.tagName) return false;
      if (node.closest('#${TOOLBAR_ROOT_ID}')) return false;
      if (hasSemanticsMarker(node)) return false;
      return true;
    });
  }

  function syncFloatingControls(){
    if (!root.hidden) {
      const rect = root.getBoundingClientRect();
      const nextTop = Math.max(12, Math.ceil(rect.bottom + 8));
      html.classList.add('onc-toolbar-present');
      html.style.setProperty('--onc-floating-top', nextTop + 'px');
    } else {
      html.classList.remove('onc-toolbar-present');
      html.style.setProperty('--onc-floating-top', '.75rem');
    }
    try {
      window.dispatchEvent(new CustomEvent('onc:toolbar-layout-changed', { detail: { visible: !root.hidden } }));
    } catch (_err) {}
  }

  function setToolbarVisible(visible){
    root.hidden = !visible;
    if (showButton) showButton.hidden = visible;
    syncFloatingControls();
  }

  function formatTimestamp(value){
    const input = String(value || '').trim();
    if (!input) return '';
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return input;
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
    } catch (_err) {
      return parsed.toLocaleString();
    }
  }

  function getSuggestedFileName(){
    const sourceName = metadata && metadata.sourceName ? String(metadata.sourceName) : '';
    const title = String(document.title || 'converted-page');
    const raw = sourceName || title;
    const withoutExtension = raw.replace(/\\.[^.\\s]{1,8}$/i, '');
    const normalized = withoutExtension
      .normalize('NFKC')
      .replace(/[\\u0000-\\u001F\\u007F]+/g, ' ')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
    return (normalized || 'converted-page') + '.html';
  }

  function serializeCurrentHtml(){
    return '<!doctype html>\\n' + document.documentElement.outerHTML;
  }

  function downloadHtml(content, fileName){
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveDocument(){
    const content = serializeCurrentHtml();
    const fileName = getSuggestedFileName();
    const pickerAvailable = typeof window.showSaveFilePicker === 'function';

    if (pickerAvailable) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'HTML file',
            accept: { 'text/html': ['.html', '.htm'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (_err) {
        return;
      }
      return;
    }

    downloadHtml(content, fileName);
  }

  function setEditMode(enabled){
    const targets = editableTargets();
    targets.forEach((node) => {
      if (enabled) {
        node.setAttribute('contenteditable', 'true');
        node.setAttribute('spellcheck', 'true');
        node.setAttribute('data-onc-editable', '1');
      } else if (node.getAttribute('data-onc-editable') === '1') {
        node.removeAttribute('contenteditable');
        node.removeAttribute('spellcheck');
        node.removeAttribute('data-onc-editable');
      }
    });
    root.dataset.oncEditing = enabled ? 'true' : 'false';
    if (editTools) editTools.hidden = !enabled;
    if (styleSelect) styleSelect.disabled = !enabled;
    if (editToggle) {
      editToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      editToggle.textContent = enabled ? 'Disable edit' : 'Enable edit';
      editToggle.title = enabled ? 'Disable edit' : 'Enable edit';
    }
    document.body.setAttribute('data-onc-editing', enabled ? 'true' : 'false');
  }

  function setEditButtonActive(command, active){
    const target = editCommandButtons.find((btn) => String(btn.getAttribute('data-onc-edit-command') || '') === String(command || ''));
    if (!target) return;
    target.setAttribute('data-onc-active', active ? 'true' : 'false');
    target.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function getEditStyleDefinition(key){
    const normalized = String(key || '').trim().toLowerCase();
    const match = editStyles.find((style) => Array.isArray(style) && String(style[0] || '').toLowerCase() === normalized);
    if (!match) return null;
    return {
      key: match[0],
      blockTag: match[1],
      blockStyles: match[2] || {}
    };
  }

  function getSelectionAnchorElement(){
    const selection = window.getSelection ? window.getSelection() : null;
    const anchorNode = selection && selection.anchorNode ? selection.anchorNode : null;
    if (anchorNode && anchorNode.nodeType === Node.ELEMENT_NODE) return anchorNode;
    if (anchorNode && anchorNode.parentElement) return anchorNode.parentElement;
    const active = document.activeElement;
    if (active && active.closest && !active.closest('#${TOOLBAR_ROOT_ID}')) return active;
    return null;
  }

  function getCurrentBlockElement(){
    const anchor = getSelectionAnchorElement();
    if (!anchor || !anchor.closest) return null;
    return anchor.closest('p, li, td, h1, h2, h3, h4, h5, h6, blockquote, pre');
  }

  function clearBlockStyleState(block){
    if (!block || !block.style) return;
    block.removeAttribute('data-onc-style-key');
    [
      'margin',
      'fontFamily',
      'fontSize',
      'color',
      'fontStyle',
      'fontWeight',
      'textIndent',
      'whiteSpace',
      'backgroundColor',
      'padding',
      'borderRadius'
    ].forEach((property) => {
      block.style[property] = '';
    });
  }

  function applyBlockStyleDefinition(block, style){
    if (!block || !style) return;
    clearBlockStyleState(block);
    block.setAttribute('data-onc-style-key', String(style.key || 'normal'));
    const blockStyles = style.blockStyles || {};
    Object.keys(blockStyles).forEach((property) => {
      if (blockStyles[property] == null) return;
      block.style[property] = String(blockStyles[property]);
    });
  }

  function getCurrentStyleKey(){
    const block = getCurrentBlockElement();
    const explicitKey = block ? String(block.getAttribute('data-onc-style-key') || '').trim().toLowerCase() : '';
    if (explicitKey) return explicitKey;
    try {
      const value = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      if (value === 'h1' || value === '<h1>') return 'heading-1';
      if (value === 'h2' || value === '<h2>') return 'heading-2';
      if (value === 'h3' || value === '<h3>') return 'heading-3';
      if (value === 'h4' || value === '<h4>') return 'heading-4';
      if (value === 'h5' || value === '<h5>') return 'heading-5';
      if (value === 'h6' || value === '<h6>') return 'heading-6';
      if (value === 'blockquote' || value === '<blockquote>') return 'quote';
      if (value === 'pre' || value === '<pre>') return 'code';
    } catch (_err) {}
    return 'normal';
  }

  function syncStyleSelect(){
    if (!styleSelect) return;
    const current = getCurrentStyleKey();
    styleSelect.value = current || 'normal';
  }

  function syncEditCommandState(){
    if (root.dataset.oncEditing !== 'true') {
      editCommandButtons.forEach((btn) => {
        btn.setAttribute('data-onc-active', 'false');
        btn.setAttribute('aria-pressed', 'false');
      });
      syncStyleSelect();
      return;
    }

    const statefulMap = {
      bold: 'bold',
      italic: 'italic',
      bullet: 'insertUnorderedList',
      number: 'insertOrderedList',
      sub: 'subscript',
      super: 'superscript',
      link: 'createLink'
    };

    editCommandButtons.forEach((btn) => {
      const command = String(btn.getAttribute('data-onc-edit-command') || '');
      let active = false;
      if (statefulMap[command]) {
        try {
          active = document.queryCommandState(statefulMap[command]) === true;
        } catch (_err) {
          active = false;
        }
      } else if (command === 'color' || command === 'size' || command === 'undo') {
        active = lastCommandHint === command;
      }

      btn.setAttribute('data-onc-active', active ? 'true' : 'false');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    syncStyleSelect();
  }

  function escapeHtmlFragment(value){
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function runEditCommand(command, value){
    try {
      return document.execCommand(command, false, value);
    } catch (_err) {
      return false;
    }
  }

  function applyEditCommand(action){
    if (root.dataset.oncEditing !== 'true') return;
    if (!document || typeof document.execCommand !== 'function') return;
    const cmd = String(action || '').toLowerCase();
    const selectedStyle = getEditStyleDefinition(cmd);
    if (selectedStyle) {
      runEditCommand('formatBlock', String(selectedStyle.blockTag || 'p'));
      const block = getCurrentBlockElement();
      if (block) {
        applyBlockStyleDefinition(block, selectedStyle);
      }
      lastCommandHint = selectedStyle.key === 'normal' ? '' : selectedStyle.key;
      syncEditCommandState();
      return;
    }
    if (cmd === 'bold') {
      runEditCommand('bold', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'italic') {
      runEditCommand('italic', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'bullet') {
      runEditCommand('insertUnorderedList', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'number') {
      runEditCommand('insertOrderedList', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'color') {
      if (colorInput) {
        colorInput.click();
      }
      return;
    }
    if (cmd === 'size') {
      const size = window.prompt('Enter font size (1-7)', '3');
      if (!size) return;
      const numeric = Number.parseInt(size, 10);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 7) return;
      runEditCommand('fontSize', String(numeric));
      lastCommandHint = 'size';
      setEditButtonActive('size', true);
      syncEditCommandState();
      return;
    }
    if (cmd === 'sub') {
      runEditCommand('subscript', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'super') {
      runEditCommand('superscript', null);
      syncEditCommandState();
      return;
    }
    if (cmd === 'link') {
      const href = window.prompt('Enter URL', 'https://');
      if (!href) return;
      const selectedText = String(window.getSelection ? (window.getSelection().toString() || '') : '').trim();
      const displayText = window.prompt('Enter display text', selectedText || href);
      if (!displayText) return;
      const safeHref = escapeHtmlFragment(href.trim());
      const safeText = escapeHtmlFragment(displayText.trim());
      runEditCommand('insertHTML', '<a href="' + safeHref + '">' + safeText + '</a>');
      syncEditCommandState();
      return;
    }
    if (cmd === 'undo') {
      runEditCommand('undo', null);
      lastCommandHint = 'undo';
      setEditButtonActive('undo', true);
      syncEditCommandState();
      return;
    }

    lastCommandHint = cmd;
    setEditButtonActive(cmd, true);
    syncEditCommandState();
  }

  if (styleSelect) {
    styleSelect.addEventListener('change', () => {
      if (root.dataset.oncEditing !== 'true') return;
      applyEditCommand(styleSelect.value || 'normal');
    });
  }

  if (colorInput) {
    const applyPickedColor = () => {
      if (root.dataset.oncEditing !== 'true') return;
      const color = String(colorInput.value || '').trim();
      if (!color) return;
      runEditCommand('foreColor', color);
      lastCommandHint = 'color';
      setEditButtonActive('color', true);
      syncEditCommandState();
    };
    colorInput.addEventListener('input', applyPickedColor);
    colorInput.addEventListener('change', applyPickedColor);
  }

  if (editToggle) {
    editToggle.addEventListener('click', () => {
      if (!canEdit) return;
      const enabled = editToggle.getAttribute('aria-pressed') !== 'true';
      setEditMode(enabled);
    });
  }

  if (metadataToggle && metadataPanel) {
    metadataToggle.addEventListener('click', () => {
      if (!canMetadata) return;
      const nextHidden = !metadataPanel.hidden;
      metadataPanel.hidden = nextHidden;
      metadataToggle.setAttribute('aria-pressed', nextHidden ? 'false' : 'true');
      requestAnimationFrame(syncFloatingControls);
      if (!nextHidden) {
        const firstValue = metadataPanel.querySelector('dd');
        if (firstValue && firstValue.focus) {
          firstValue.setAttribute('tabindex', '-1');
          firstValue.focus();
        }
      }
    });
  }

  if (hideButton && showButton) {
    hideButton.addEventListener('click', () => {
      if (canEdit) setEditMode(false);
      setToolbarVisible(false);
      showButton.focus();
    });
    showButton.addEventListener('click', () => {
      setToolbarVisible(true);
      if (canEdit) setEditMode(true);
      root.focus();
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      void saveDocument();
    });
  }

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || !target.closest) return;
    const button = target.closest('[data-onc-edit-command]');
    if (!button) return;
    applyEditCommand(button.getAttribute('data-onc-edit-command'));
  });

  document.addEventListener('selectionchange', () => {
    if (root.dataset.oncEditing === 'true') {
      syncEditCommandState();
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => syncFloatingControls());
    observer.observe(root);
  }
  window.addEventListener('resize', syncFloatingControls, { passive: true });

  if (!metadata || !metadataPanel) return true;
  const sourceName = metadataPanel.querySelector('[data-onc-field="source-name"]');
  const sourceKind = metadataPanel.querySelector('[data-onc-field="source-kind"]');
  const pageTitle = metadataPanel.querySelector('[data-onc-field="page-title"]');
  const exportFormat = metadataPanel.querySelector('[data-onc-field="export-format"]');
  const timestamp = metadataPanel.querySelector('[data-onc-field="timestamp"]');
  if (sourceName) sourceName.textContent = metadata.sourceName || 'Unknown source';
  if (sourceKind) sourceKind.textContent = metadata.sourceKind || 'html';
  if (pageTitle) pageTitle.textContent = metadata.pageTitle || document.title || 'Untitled page';
  if (exportFormat) exportFormat.textContent = metadata.exportFormat || 'html';
  if (timestamp) timestamp.textContent = formatTimestamp(metadata.timestamp || '');
  setToolbarVisible(false);
  syncEditCommandState();
  syncFloatingControls();
  return true;
  }

  if (!init()) {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();`;

  return `<script id="${TOOLBAR_SCRIPT_ID}" data-onc-toolbar-script="${TOOLBAR_VERSION}">${minifyInlineScript(script)}</script>`;
}

/**
 * @param {ToolbarMetadata} metadata
 * @returns {string}
 */
function buildMetadataTag(metadata) {
  const json = JSON.stringify(metadata).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${TOOLBAR_METADATA_ID}">${json}</script>`;
}

/**
 * @param {ToolbarMetadata} metadata
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {string}
 */
function buildToolbarMarkup(metadata, options = {}) {
  const toolbarEnabled = options.ToolbarEnabled === true;
  const editEnabled = toolbarEnabled || options.ToolbarEditToggleEnabled === true;
  const metadataEnabled = toolbarEnabled || options.ToolbarMetadataToggleEnabled === true;
  const toolbarStyle = resolveToolbarStyle(options);
  const styleOptionsMarkup = EDIT_STYLE_OPTIONS
    .map((style) => `<option value="${escapeHtml(style.key)}">${escapeHtml(style.label)}</option>`)
    .join('');

  return [
    `<div id="${TOOLBAR_ROOT_ID}" data-onc-toolbar="${TOOLBAR_VERSION}" data-onc-toolbar-preset="${toolbarStyle}" data-onc-edit-enabled="${editEnabled}" data-onc-metadata-enabled="${metadataEnabled}" tabindex="-1" aria-label="OneNote Cleaner toolbar" hidden>`,
    '<div class="onc-toolbar-row">',
    '<span class="onc-title">Tools</span>',
    `<button type="button" class="onc-btn" data-onc-action="edit-toggle" aria-pressed="false" title="Enable edit"${editEnabled ? '' : ' hidden'}>Enable edit</button>`,
    `<button type="button" class="onc-btn" data-onc-action="metadata-toggle" aria-pressed="false" title="Show metadata"${metadataEnabled ? '' : ' hidden'}>Show metadata</button>`,
    '<button type="button" class="onc-btn" data-onc-action="save" title="Save current page">Save</button>',
    '<button type="button" class="onc-btn" data-onc-action="hide-toolbar" title="Hide toolbar">Hide</button>',
    '</div>',
    '<div class="onc-toolbar-row onc-edit-tools" data-onc-role="edit-tools" hidden>',
    '<button type="button" class="onc-btn" data-onc-edit-command="undo" data-onc-active="false" aria-pressed="false" title="Undo">Undo</button>',
    `<select class="onc-btn onc-select" data-onc-role="style-select" title="Styles" aria-label="Styles" disabled>${styleOptionsMarkup}</select>`,
    '<button type="button" class="onc-btn" data-onc-edit-command="bold" data-onc-active="false" aria-pressed="false" title="Bold">B</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="italic" data-onc-active="false" aria-pressed="false" title="Italic">I</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="color" data-onc-active="false" aria-pressed="false" title="Text color">Color</button>',
    '<input type="color" class="onc-color-input" data-onc-role="color-input" value="#2563eb" aria-label="Pick text color">',
    '<button type="button" class="onc-btn" data-onc-edit-command="size" data-onc-active="false" aria-pressed="false" title="Text size">Size</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="sub" data-onc-active="false" aria-pressed="false" title="Subscript">Sub</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="super" data-onc-active="false" aria-pressed="false" title="Superscript">Super</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="bullet" data-onc-active="false" aria-pressed="false" title="Bullet list">Bullet List</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="number" data-onc-active="false" aria-pressed="false" title="Numbered list">Numbered List</button>',
    '<button type="button" class="onc-btn" data-onc-edit-command="link" data-onc-active="false" aria-pressed="false" title="Insert link">Link</button>',
    '</div>',
    `<aside class="onc-panel" data-onc-role="metadata-panel"${metadataEnabled ? ' hidden' : ' hidden'}>`,
    '<dl>',
    `<dt>Source</dt><dd data-onc-field="source-name">${escapeHtml(metadata.sourceName)}</dd>`,
    `<dt>Kind</dt><dd data-onc-field="source-kind">${escapeHtml(metadata.sourceKind)}</dd>`,
    `<dt>Page title</dt><dd data-onc-field="page-title">${escapeHtml(metadata.pageTitle)}</dd>`,
    `<dt>Format</dt><dd data-onc-field="export-format">${escapeHtml(metadata.exportFormat)}</dd>`,
    `<dt>Timestamp</dt><dd data-onc-field="timestamp">${escapeHtml(metadata.timestamp)}</dd>`,
    '</dl>',
    '</aside>',
    '</div>',
    `<button type="button" id="${TOOLBAR_SHOW_BUTTON_ID}" aria-label="Show toolbar" title="Show toolbar">Toolbar</button>`
  ].join('');
}

/**
 * @param {string} html
 * @param {string} insert
 * @returns {string}
 */
function injectIntoHead(html, insert) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${insert}</head>`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${insert}</head>`);
  }

  return `<!doctype html><html lang="en"><head>${insert}</head><body>${html}</body></html>`;
}

/**
 * @param {string} html
 * @param {string} insert
 * @returns {string}
 */
function injectIntoBody(html, insert) {
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}${insert}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<body>${insert}`) + (/<\/body>/i.test(html) ? '' : '</body>');
  }

  return `<!doctype html><html lang="en"><head></head><body>${insert}${html}</body></html>`;
}

/**
 * @param {unknown} html
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {string}
 */
export function injectOutputToolbar(html, options = {}) {
  const input = String(html || '');
  if (!input) return input;
  const exportState = resolveExportState(options);
  const toolbarStyle = resolveToolbarStyle(options);

  const toolbarEnabled = options.ToolbarEnabled === true;
  const toolbarBundleMode = String(options.ToolbarBundleMode || 'inline').toLowerCase();
  if (!toolbarEnabled || toolbarBundleMode !== 'inline') {
    return input;
  }

  if (hasToolbarRoot(input)) {
    return input;
  }

  const metadata = buildMetadata(options, exportState);
  const headInsert = `${buildStyleTag(toolbarStyle)}${buildMetadataTag(metadata)}${buildScriptTag()}`;
  const bodyInsert = buildToolbarMarkup(metadata, { ...options, ToolbarStyle: toolbarStyle });

  const withHead = injectIntoHead(input, headInsert);
  return injectIntoBody(withHead, bodyInsert);
}

/**
 * @param {Array<Pick<WarningDetail, 'severity'> | null | undefined>} [items=[]]
 * @returns {WarningSummary}
 */
export function summarizeWarningsBySeverity(items = []) {
  const summary = { total: 0, info: 0, warning: 0, error: 0 };
  for (const item of items || []) {
    const severity = String(item && item.severity ? item.severity : 'info').toLowerCase();
    if (severity === 'error') summary.error += 1;
    else if (severity === 'warning' || severity === 'warn') summary.warning += 1;
    else summary.info += 1;
    summary.total += 1;
  }
  return summary;
}

function buildConvertedThemeStyleTag() {
  const css = minifyInlineCss(
    `#${CONVERTED_THEME_ROOT_ID}{position:fixed;right:1rem;top:var(--onc-floating-top,.75rem);z-index:10000;border:0;background:transparent;color:#0f172a;border-radius:0;width:auto;height:auto;display:block;cursor:pointer;padding:0;line-height:1;font:400 1.5rem/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-shadow:none;}` +
    `#${CONVERTED_THEME_ROOT_ID}:focus-visible{outline:2px solid #7ea5e0;outline-offset:2px;}` +
    `html[data-onc-converted-theme="black"]{--onc-converted-bg:#000000;--onc-converted-fg:#d6d6cf;}` +
    `html[data-onc-converted-theme="black"] body{background:var(--onc-converted-bg);color:var(--onc-converted-fg);}` +
    `html[data-onc-converted-theme="black"] main{background:var(--onc-converted-bg);color:var(--onc-converted-fg);}` +
    `html[data-onc-converted-theme="black"] body [style*="color: #000"],html[data-onc-converted-theme="black"] body [style*="color:#000"],html[data-onc-converted-theme="black"] body [style*="color: black"],html[data-onc-converted-theme="black"] body [style*="color:black"],html[data-onc-converted-theme="black"] body [style*="color: rgb(0, 0, 0)"],html[data-onc-converted-theme="black"] body [style*="color:rgb(0,0,0)"]{color:var(--onc-converted-fg) !important;}` +
    `html[data-onc-converted-theme="black"] body [style*="background: white"],html[data-onc-converted-theme="black"] body [style*="background:white"],html[data-onc-converted-theme="black"] body [style*="background-color: white"],html[data-onc-converted-theme="black"] body [style*="background-color:white"],html[data-onc-converted-theme="black"] body [style*="background: #fff"],html[data-onc-converted-theme="black"] body [style*="background:#fff"],html[data-onc-converted-theme="black"] body [style*="background-color: #fff"],html[data-onc-converted-theme="black"] body [style*="background-color:#fff"],html[data-onc-converted-theme="black"] body [style*="background: rgb(255, 255, 255)"],html[data-onc-converted-theme="black"] body [style*="background:rgb(255,255,255)"]{background:transparent !important;}`
  );
  return `<style id="${CONVERTED_THEME_STYLE_ID}" data-onc-converted-theme-style="${CONVERTED_THEME_VERSION}">` +
    css +
    '</style>';
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {string}
 */
function buildConvertedThemeScriptTag(options = {}) {
  const script = `(function(){
  function init(){
    const root = document.getElementById('${CONVERTED_THEME_ROOT_ID}');
    if (!root) return false;
    if (root.dataset.oncInitialized === '1') return true;
    root.dataset.oncInitialized = '1';

    const html = document.documentElement;
    if (document.getElementById('${TOOLBAR_ROOT_ID}')) {
      html.classList.add('onc-toolbar-present');
    }

    const storageKey = 'onc:converted-theme:' + location.pathname;

    function applyTheme(nextTheme){
      const theme = nextTheme === 'black' ? 'black' : 'light';
      html.setAttribute('data-onc-converted-theme', theme);
      root.setAttribute('aria-pressed', theme === 'black' ? 'true' : 'false');
      root.setAttribute('aria-label', theme === 'black' ? 'Switch converted page to light theme' : 'Switch converted page to black theme');
      root.textContent = theme === 'black' ? '🌑' : '🔆';
    }

    let saved = 'light';
    try {
      saved = localStorage.getItem(storageKey) || 'light';
    } catch (_err) {}

    applyTheme(saved);

    root.addEventListener('click', function(){
      const current = html.getAttribute('data-onc-converted-theme') === 'black' ? 'black' : 'light';
      const next = current === 'black' ? 'light' : 'black';
      applyTheme(next);
      try { localStorage.setItem(storageKey, next); } catch (_err) {}
    });

    return true;
  }

  if (!init()) {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();`;

  return `<script id="${CONVERTED_THEME_SCRIPT_ID}" data-onc-converted-theme-script="${CONVERTED_THEME_VERSION}">${minifyInlineScript(script)}</script>`;
}

/**
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {string}
 */
function buildConvertedThemeToggleMarkup(options = {}) {
  return `<button type="button" id="${CONVERTED_THEME_ROOT_ID}" data-onc-converted-theme-toggle="${CONVERTED_THEME_VERSION}" aria-pressed="false" aria-label="Switch converted page to black theme" title="Toggle converted page theme">🔆</button>`;
}

/**
 * @param {unknown} html
 * @param {ToolbarInjectorOptions} [options={}]
 * @returns {string}
 */
export function injectConvertedPageThemeToggle(html, options = {}) {
  const input = String(html || '');
  if (!input) return input;
  const exportState = resolveExportState(options);

  if (options.ConvertedPageThemeToggleEnabled !== true) {
    return input;
  }

  if (exportState.ExportFormat !== 'html') {
    return input;
  }

  if (hasConvertedThemeToggleRoot(input)) {
    return input;
  }

  const headInsert = `${buildConvertedThemeStyleTag()}${buildConvertedThemeScriptTag(options)}`;
  const withHead = injectIntoHead(input, headInsert);
  return injectIntoBody(withHead, buildConvertedThemeToggleMarkup(options));
}
