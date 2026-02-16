const TOOLBAR_ROOT_ID = 'onenote-cleaner-toolbar';
const TOOLBAR_VERSION = 'v1';
const TOOLBAR_STYLE_ID = 'onc-toolbar-style';
const TOOLBAR_SCRIPT_ID = 'onc-toolbar-script';
const TOOLBAR_METADATA_ID = 'onc-toolbar-metadata';
const TOOLBAR_SHOW_BUTTON_ID = 'onc-toolbar-show';

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

function buildWarningSummaryText(summary) {
  return `total ${summary.total} · info ${summary.info} · warning ${summary.warning} · error ${summary.error}`;
}

function buildMetadata(options = {}) {
  const warningSummary = normalizeWarningSummary(options.WarningSummary || options.warningSummary || {});
  return {
    sourceName: String(options.SourceName || options.sourceName || options.fileName || 'Unknown source'),
    sourceKind: normalizeSourceKind(options.SourceKind || options.sourceKind || 'html'),
    profile: String(options.Profile || options.profile || 'generic'),
    timestamp: String(options.ConversionTimestamp || options.conversionTimestamp || new Date().toISOString()),
    warningSummary
  };
}

function hasToolbarRoot(html = '') {
  const hasId = new RegExp(`id=["']${TOOLBAR_ROOT_ID}["']`, 'i').test(html);
  const hasMarker = /data-onc-toolbar=["']v1["']/i.test(html);
  return hasId && hasMarker;
}

function buildStyleTag() {
  return `<style id="${TOOLBAR_STYLE_ID}" data-onc-toolbar-style="${TOOLBAR_VERSION}">` +
    '#onenote-cleaner-toolbar{position:sticky;top:0;z-index:9999;background:#fff;border-bottom:1px solid #d7dce2;padding:.5rem .75rem;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}' +
    '#onenote-cleaner-toolbar .onc-toolbar-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;}' +
    '#onenote-cleaner-toolbar .onc-title{font-weight:600;margin-right:.25rem;}' +
    '#onenote-cleaner-toolbar .onc-btn,#onc-toolbar-show{border:1px solid #b7c0cc;background:#fff;color:#1f2a37;border-radius:.35rem;padding:.3rem .55rem;cursor:pointer;font:inherit;}' +
    '#onenote-cleaner-toolbar .onc-btn[aria-pressed="true"]{background:#eef5ff;border-color:#7ea5e0;}' +
    '#onenote-cleaner-toolbar .onc-btn:focus-visible,#onc-toolbar-show:focus-visible{outline:2px solid #7ea5e0;outline-offset:2px;}' +
    '#onenote-cleaner-toolbar .onc-muted{font-size:12px;color:#4b5563;}' +
    '#onenote-cleaner-toolbar .onc-panel{margin-top:.5rem;border:1px solid #d7dce2;border-radius:.35rem;padding:.5rem;background:#f8fafc;}' +
    '#onenote-cleaner-toolbar .onc-panel dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem .5rem;margin:0;}' +
    '#onenote-cleaner-toolbar .onc-panel dt{font-weight:600;}' +
    '#onenote-cleaner-toolbar .onc-panel dd{margin:0;word-break:break-word;}' +
    '#onc-toolbar-show{position:fixed;right:1rem;bottom:1rem;z-index:9999;}' +
    '[data-onc-editing="true"] [data-onc-editable="1"]{outline:1px dashed #7ea5e0;outline-offset:2px;}' +
    '</style>';
}

function buildScriptTag() {
  const script = `(function(){
  const root = document.getElementById('${TOOLBAR_ROOT_ID}');
  if (!root || root.dataset.oncInitialized === '1') return;
  root.dataset.oncInitialized = '1';

  const showButton = document.getElementById('${TOOLBAR_SHOW_BUTTON_ID}');
  const metadataPanel = root.querySelector('[data-onc-role="metadata-panel"]');
  const editToggle = root.querySelector('[data-onc-action="edit-toggle"]');
  const metadataToggle = root.querySelector('[data-onc-action="metadata-toggle"]');
  const hideButton = root.querySelector('[data-onc-action="hide-toolbar"]');
  const metadataScript = document.getElementById('${TOOLBAR_METADATA_ID}');
  const canEdit = root.dataset.oncEditEnabled === 'true';
  const canMetadata = root.dataset.oncMetadataEnabled === 'true';

  if (!canEdit && editToggle) editToggle.hidden = true;
  if (!canMetadata && metadataToggle) metadataToggle.hidden = true;
  if (!canMetadata && metadataPanel) metadataPanel.hidden = true;

  let metadata = null;
  try {
    metadata = metadataScript ? JSON.parse(metadataScript.textContent || '{}') : null;
  } catch (_err) {
    metadata = null;
  }

  function hasCornellClass(node){
    if (!node || !node.closest) return false;
    const hit = node.closest('[class]');
    if (!hit) return false;
    const className = String(hit.className || '');
    return /\\bcornell-/i.test(className);
  }

  function editableTargets(){
    const targets = Array.from(document.querySelectorAll('p, li, td'));
    return targets.filter((node) => {
      if (!node || !node.tagName) return false;
      if (node.closest('#${TOOLBAR_ROOT_ID}')) return false;
      if (hasCornellClass(node)) return false;
      return true;
    });
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
    if (editToggle) {
      editToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      editToggle.textContent = enabled ? 'Disable edit mode' : 'Enable edit mode';
    }
    document.body.setAttribute('data-onc-editing', enabled ? 'true' : 'false');
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
      root.hidden = true;
      showButton.hidden = false;
      showButton.focus();
    });
    showButton.addEventListener('click', () => {
      root.hidden = false;
      showButton.hidden = true;
      root.focus();
    });
  }

  if (!metadata || !metadataPanel) return;
  const sourceName = metadataPanel.querySelector('[data-onc-field="source-name"]');
  const sourceKind = metadataPanel.querySelector('[data-onc-field="source-kind"]');
  const profile = metadataPanel.querySelector('[data-onc-field="profile"]');
  const timestamp = metadataPanel.querySelector('[data-onc-field="timestamp"]');
  const warningSummary = metadataPanel.querySelector('[data-onc-field="warning-summary"]');
  if (sourceName) sourceName.textContent = metadata.sourceName || 'Unknown source';
  if (sourceKind) sourceKind.textContent = metadata.sourceKind || 'html';
  if (profile) profile.textContent = metadata.profile || 'generic';
  if (timestamp) timestamp.textContent = metadata.timestamp || '';
  if (warningSummary && metadata.warningSummary) {
    const ws = metadata.warningSummary;
    warningSummary.textContent = 'total ' + (ws.total || 0) + ' · info ' + (ws.info || 0) + ' · warning ' + (ws.warning || 0) + ' · error ' + (ws.error || 0);
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
  const warningSummaryText = buildWarningSummaryText(metadata.warningSummary);

  return [
    `<div id="${TOOLBAR_ROOT_ID}" data-onc-toolbar="${TOOLBAR_VERSION}" data-onc-edit-enabled="${editEnabled}" data-onc-metadata-enabled="${metadataEnabled}" tabindex="-1" aria-label="OneNote Cleaner toolbar">`,
    '<div class="onc-toolbar-row">',
    '<span class="onc-title">OneNote Cleaner Tools</span>',
    `<button type="button" class="onc-btn" data-onc-action="edit-toggle" aria-pressed="false"${editEnabled ? '' : ' hidden'}>Enable edit mode</button>`,
    `<button type="button" class="onc-btn" data-onc-action="metadata-toggle" aria-pressed="false"${metadataEnabled ? '' : ' hidden'}>Show metadata</button>`,
    '<button type="button" class="onc-btn" data-onc-action="hide-toolbar">Hide toolbar</button>',
    '<span class="onc-muted">Advanced features in one toolbar</span>',
    '</div>',
    `<aside class="onc-panel" data-onc-role="metadata-panel"${metadataEnabled ? ' hidden' : ' hidden'}>`,
    '<dl>',
    `<dt>Source</dt><dd data-onc-field="source-name">${escapeHtml(metadata.sourceName)}</dd>`,
    `<dt>Kind</dt><dd data-onc-field="source-kind">${escapeHtml(metadata.sourceKind)}</dd>`,
    `<dt>Profile</dt><dd data-onc-field="profile">${escapeHtml(metadata.profile)}</dd>`,
    `<dt>Timestamp</dt><dd data-onc-field="timestamp">${escapeHtml(metadata.timestamp)}</dd>`,
    `<dt>Warnings</dt><dd data-onc-field="warning-summary">${escapeHtml(warningSummaryText)}</dd>`,
    '</dl>',
    '</aside>',
    '</div>',
    `<button type="button" id="${TOOLBAR_SHOW_BUTTON_ID}" hidden>Show toolbar</button>`
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
