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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function normalizeSourceKind(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mht' || normalized === 'mhtml') return 'mht';
  if (normalized === 'one' || normalized === 'onepkg') return normalized;
  return 'html';
}

function normalizeWarningSummary(summary = {}) {
  const info = Number(summary.info || 0);
  const warning = Number(summary.warning || 0);
  const error = Number(summary.error || 0);
  const total = Number(summary.total || (info + warning + error));
  return { total, info, warning, error };
}

function buildMetadata(options = {}) {
  return {
    sourceName: String(options.SourceName || options.sourceName || options.fileName || 'Unknown source'),
    sourceKind: normalizeSourceKind(options.SourceKind || options.sourceKind || 'html'),
    pageTitle: String(options.PageTitle || options.pageTitle || ''),
    exportFormat: normalizeExportFormat(options.ExportFormat || options.exportFormat || 'html'),
    timestamp: String(options.ConversionTimestamp || options.conversionTimestamp || new Date().toISOString())
  };
}

function hasToolbarRoot(html = '') {
  const hasId = new RegExp(`id=["']${TOOLBAR_ROOT_ID}["']`, 'i').test(html);
  const hasMarker = /data-onc-toolbar=["']v1["']/i.test(html);
  return hasId && hasMarker;
}

function hasConvertedThemeToggleRoot(html = '') {
  const hasId = new RegExp(`id=["']${CONVERTED_THEME_ROOT_ID}["']`, 'i').test(html);
  const hasMarker = /data-onc-converted-theme-toggle=["']v1["']/i.test(html);
  return hasId && hasMarker;
}

function normalizeExportFormat(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'markdown' || normalized === 'docx') return normalized;
  return 'html';
}

function isHtmlExportEnabled(options = {}) {
  const experimentalEnabled = options.ExperimentalExportEnabled === true;
  const format = normalizeExportFormat(options.ExportFormat || 'html');
  return !experimentalEnabled || format === 'html';
}

function buildStyleTag() {
  return `<style id="${TOOLBAR_STYLE_ID}" data-onc-toolbar-style="${TOOLBAR_VERSION}">` +
    '#onenote-cleaner-toolbar{position:sticky;top:0;z-index:9999;background:#fff;border-bottom:1px solid #d7dce2;padding:.5rem .75rem;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}' +
    '#onenote-cleaner-toolbar .onc-toolbar-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;}' +
    '#onenote-cleaner-toolbar .onc-edit-tools{margin-top:.35rem;}' +
    '#onenote-cleaner-toolbar [data-onc-role="edit-tools"][hidden]{display:none !important;}' +
    '#onenote-cleaner-toolbar .onc-title{font-weight:600;margin-right:.25rem;}' +
    '#onenote-cleaner-toolbar .onc-btn,#onc-toolbar-show{border:1px solid #b7c0cc;background:#fff;color:#1f2a37;border-radius:.35rem;padding:.3rem .55rem;cursor:pointer;font:inherit;}' +
    '#onenote-cleaner-toolbar .onc-select{min-width:9.5rem;}' +
    '#onenote-cleaner-toolbar .onc-color-input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none;}' +
    '#onenote-cleaner-toolbar .onc-btn[aria-pressed="true"]{background:#eef5ff;border-color:#7ea5e0;}' +
    '#onenote-cleaner-toolbar .onc-btn[data-onc-active="true"]{background:#eef5ff;border-color:#7ea5e0;}' +
    '#onenote-cleaner-toolbar .onc-btn:focus-visible,#onc-toolbar-show:focus-visible{outline:2px solid #7ea5e0;outline-offset:2px;}' +
    '#onenote-cleaner-toolbar .onc-muted{font-size:12px;color:#4b5563;}' +
    '#onenote-cleaner-toolbar .onc-panel{margin-top:.5rem;border:1px solid #d7dce2;border-radius:.35rem;padding:.5rem;background:#f8fafc;}' +
    '#onenote-cleaner-toolbar .onc-panel dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem .5rem;margin:0;}' +
    '#onenote-cleaner-toolbar .onc-panel dt{font-weight:600;}' +
    '#onenote-cleaner-toolbar .onc-panel dd{margin:0;word-break:break-word;}' +
    '#onc-toolbar-show{position:fixed;right:3.35rem;top:var(--onc-floating-top,.75rem);bottom:auto;z-index:10000;font-size:12px;padding:.2rem .45rem;}' +
    'html[data-onc-converted-theme="dark"] #onenote-cleaner-toolbar{background:var(--onc-converted-bg,#1f1f1f);color:var(--onc-converted-fg,#e6e6e6);border-bottom-color:rgba(148,163,184,.35);}' +
    'html[data-onc-converted-theme="dark"] #onenote-cleaner-toolbar .onc-btn,html[data-onc-converted-theme="dark"] #onc-toolbar-show{background:rgba(15,23,42,.38);color:var(--onc-converted-fg,#e6e6e6);border-color:rgba(148,163,184,.45);}' +
    'html[data-onc-converted-theme="dark"] #onenote-cleaner-toolbar .onc-btn[aria-pressed="true"]{background:rgba(59,130,246,.22);border-color:rgba(125,177,255,.7);}' +
    'html[data-onc-converted-theme="dark"] #onenote-cleaner-toolbar .onc-panel{background:rgba(15,23,42,.32);border-color:rgba(148,163,184,.35);}' +
    'html[data-onc-converted-theme="dark"] #onenote-cleaner-toolbar .onc-muted{color:#cbd5e1;}' +
    '[data-onc-editing="true"] [data-onc-editable="1"]{outline:1px dashed #7ea5e0;outline-offset:2px;}' +
    '</style>';
}

function buildScriptTag() {
  const serializedEditStyles = JSON.stringify(EDIT_STYLE_OPTIONS).replace(/</g, '\\u003c');
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
    return editStyles.find((style) => style && String(style.key || '').toLowerCase() === normalized) || null;
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
      setToolbarVisible(false);
      showButton.focus();
    });
    showButton.addEventListener('click', () => {
      setToolbarVisible(true);
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

  return `<script id="${TOOLBAR_SCRIPT_ID}" data-onc-toolbar-script="${TOOLBAR_VERSION}">${script}</script>`;
}

function buildMetadataTag(metadata) {
  const json = JSON.stringify(metadata).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${TOOLBAR_METADATA_ID}">${json}</script>`;
}

function buildToolbarMarkup(metadata, options = {}) {
  const editEnabled = options.ToolbarEditToggleEnabled === true;
  const metadataEnabled = options.ToolbarMetadataToggleEnabled === true;
  const styleOptionsMarkup = EDIT_STYLE_OPTIONS
    .map((style) => `<option value="${escapeHtml(style.key)}">${escapeHtml(style.label)}</option>`)
    .join('');

  return [
    `<div id="${TOOLBAR_ROOT_ID}" data-onc-toolbar="${TOOLBAR_VERSION}" data-onc-edit-enabled="${editEnabled}" data-onc-metadata-enabled="${metadataEnabled}" tabindex="-1" aria-label="OneNote Cleaner toolbar" hidden>`,
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

function injectIntoHead(html, insert) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${insert}</head>`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${insert}</head>`);
  }

  return `<!doctype html><html lang="en"><head>${insert}</head><body>${html}</body></html>`;
}

function injectIntoBody(html, insert) {
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}${insert}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<body>${insert}`) + (/<\/body>/i.test(html) ? '' : '</body>');
  }

  return `<!doctype html><html lang="en"><head></head><body>${insert}${html}</body></html>`;
}

export function injectOutputToolbar(html, options = {}) {
  const input = String(html || '');
  if (!input) return input;

  const toolbarEnabled = options.ToolbarEnabled === true;
  const toolbarBundleMode = String(options.ToolbarBundleMode || 'inline').toLowerCase();
  if (!toolbarEnabled || toolbarBundleMode !== 'inline') {
    return input;
  }

  if (hasToolbarRoot(input)) {
    return input;
  }

  const metadata = buildMetadata(options);
  const headInsert = `${buildStyleTag()}${buildMetadataTag(metadata)}${buildScriptTag()}`;
  const bodyInsert = buildToolbarMarkup(metadata, options);

  const withHead = injectIntoHead(input, headInsert);
  return injectIntoBody(withHead, bodyInsert);
}

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
  return `<style id="${CONVERTED_THEME_STYLE_ID}" data-onc-converted-theme-style="${CONVERTED_THEME_VERSION}">` +
    `#${CONVERTED_THEME_ROOT_ID}{position:fixed;right:1rem;top:var(--onc-floating-top,.75rem);z-index:10000;border:0;background:transparent;color:#0f172a;border-radius:0;width:auto;height:auto;display:block;cursor:pointer;padding:0;line-height:1;font:400 1.5rem/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-shadow:none;}` +
    `#${CONVERTED_THEME_ROOT_ID}:focus-visible{outline:2px solid #7ea5e0;outline-offset:2px;}` +
    `html[data-onc-converted-theme="dark"]{--onc-converted-bg:#1f1f1f;--onc-converted-fg:#e6e6e6;}` +
    `html[data-onc-converted-theme="dark"][data-onc-converted-oled="true"]{--onc-converted-bg:#000000;--onc-converted-fg:#d6d6cf;}` +
    `html[data-onc-converted-theme="dark"] body{background:var(--onc-converted-bg);color:var(--onc-converted-fg);}` +
    `html[data-onc-converted-theme="dark"] main{background:var(--onc-converted-bg);color:var(--onc-converted-fg);}` +
    `html[data-onc-converted-theme="dark"] body [style*="color: #000"],html[data-onc-converted-theme="dark"] body [style*="color:#000"],html[data-onc-converted-theme="dark"] body [style*="color: black"],html[data-onc-converted-theme="dark"] body [style*="color:black"],html[data-onc-converted-theme="dark"] body [style*="color: rgb(0, 0, 0)"],html[data-onc-converted-theme="dark"] body [style*="color:rgb(0,0,0)"]{color:var(--onc-converted-fg) !important;}` +
    `html[data-onc-converted-theme="dark"] body [style*="background: white"],html[data-onc-converted-theme="dark"] body [style*="background:white"],html[data-onc-converted-theme="dark"] body [style*="background-color: white"],html[data-onc-converted-theme="dark"] body [style*="background-color:white"],html[data-onc-converted-theme="dark"] body [style*="background: #fff"],html[data-onc-converted-theme="dark"] body [style*="background:#fff"],html[data-onc-converted-theme="dark"] body [style*="background-color: #fff"],html[data-onc-converted-theme="dark"] body [style*="background-color:#fff"],html[data-onc-converted-theme="dark"] body [style*="background: rgb(255, 255, 255)"],html[data-onc-converted-theme="dark"] body [style*="background:rgb(255,255,255)"]{background:transparent !important;}` +
    '</style>';
}

function buildConvertedThemeScriptTag(options = {}) {
  const oledBlack = options.ConvertedPageThemeToggleOledBlack === true;
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

    const oledBlack = ${oledBlack ? 'true' : 'false'};
    const storageKey = 'onc:converted-theme:' + location.pathname;

    function applyTheme(nextTheme){
      const theme = nextTheme === 'dark' ? 'dark' : 'light';
      html.setAttribute('data-onc-converted-theme', theme);
      html.setAttribute('data-onc-converted-oled', oledBlack ? 'true' : 'false');
      root.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      root.setAttribute('aria-label', theme === 'dark' ? 'Switch converted page to light theme' : 'Switch converted page to dark theme');
      root.textContent = theme === 'dark' ? '🌙' : '🔆';
    }

    let saved = 'light';
    try {
      saved = localStorage.getItem(storageKey) || 'light';
    } catch (_err) {}

    applyTheme(saved);

    root.addEventListener('click', function(){
      const current = html.getAttribute('data-onc-converted-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(storageKey, next); } catch (_err) {}
    });

    return true;
  }

  if (!init()) {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();`;

  return `<script id="${CONVERTED_THEME_SCRIPT_ID}" data-onc-converted-theme-script="${CONVERTED_THEME_VERSION}">${script}</script>`;
}

function buildConvertedThemeToggleMarkup() {
  return `<button type="button" id="${CONVERTED_THEME_ROOT_ID}" data-onc-converted-theme-toggle="${CONVERTED_THEME_VERSION}" aria-pressed="false" aria-label="Switch converted page to dark theme" title="Toggle converted page theme">🔆</button>`;
}

export function injectConvertedPageThemeToggle(html, options = {}) {
  const input = String(html || '');
  if (!input) return input;

  if (options.ConvertedPageThemeToggleEnabled !== true) {
    return input;
  }

  if (!isHtmlExportEnabled(options)) {
    return input;
  }

  if (hasConvertedThemeToggleRoot(input)) {
    return input;
  }

  const withHead = injectIntoHead(input, `${buildConvertedThemeStyleTag()}${buildConvertedThemeScriptTag(options)}`);
  return injectIntoBody(withHead, buildConvertedThemeToggleMarkup());
}
