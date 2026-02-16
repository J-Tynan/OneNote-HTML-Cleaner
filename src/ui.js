import { detectSourceKind } from './importers/sourceKind.js';
import { baseNameFromFile, toFolderSafeName } from './importers/sourceKind.js';
import { WARNING_CODES } from './importers/warnings.js';
import { createStateHelpers } from './ui-state.js';
import { createDiagnosticsHelpers } from './ui-diagnostics.js';
import { createDownloadHelpers } from './ui-downloads.js';

function createNativeRenderer(ctx, helpers) {
  const { downloadBlob, downloadNativeZip } = helpers;

  function getActionContainer(li) {
    return li.querySelector('.item-actions') || li;
  }

  function buildHierarchyList(node, pageMap, downloadBaseName) {
    const ul = document.createElement('ul');
    ul.className = 'native-tree';

    const li = document.createElement('li');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = (node && node.name) ? node.name : '(unnamed)';
    li.appendChild(titleSpan);

    if (node && node.kind === 'page' && node.path && pageMap && downloadBaseName) {
      const page = pageMap.get(node.path);
      if (page) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = 'Download';
        link.className = 'native-page-link';
        link.onclick = (event) => {
          event.preventDefault();
          const downloadName = `${downloadBaseName}_${toFolderSafeName(page.name || 'page')}.html`;
          downloadBlob(downloadName, page.html || '', 'text/html');
        };
        li.appendChild(document.createTextNode(' '));
        li.appendChild(link);
      }
    }

    ul.appendChild(li);

    const children = Array.isArray(node && node.children) ? node.children : [];
    if (children.length > 0) {
      const childContainer = document.createElement('ul');
      for (const child of children) {
        const childTree = buildHierarchyList(child, pageMap, downloadBaseName);
        childContainer.appendChild(childTree.firstElementChild);
      }
      li.appendChild(childContainer);
    }

    return ul;
  }

  function renderCompressedHelper(content) {
    const helper = document.createElement('details');
    helper.className = 'rounded-lg border border-amber-200 bg-amber-50 p-3';

    const summary = document.createElement('summary');
    summary.className = 'cursor-pointer text-sm font-medium text-amber-800';
    summary.textContent = 'Compressed .onepkg guidance';
    helper.appendChild(summary);

    const helperText = document.createElement('p');
    helperText.className = 'mt-2 text-sm text-amber-900';
    helperText.textContent =
      'This notebook package uses compression that may require local extraction before full page conversion. Use trusted local tooling, then import extracted .one files in this app.';
    helper.appendChild(helperText);

    const helperHint = document.createElement('p');
    helperHint.className = 'mt-2 text-xs text-amber-900';
    helperHint.textContent = 'See project documentation for extraction workflow options.';
    helper.appendChild(helperHint);

    content.appendChild(helper);
  }

  function renderNativeResult(li, file, nativeResult) {
    const content = li.querySelector('.item-content') || li;

    const sourceLabel = nativeResult && nativeResult.sourceKind
      ? nativeResult.sourceKind.toUpperCase()
      : 'NATIVE';

    const pages = Array.isArray(nativeResult && nativeResult.pages)
      ? nativeResult.pages
      : [];

    const warnings = Array.isArray(nativeResult && nativeResult.warnings)
      ? nativeResult.warnings
      : [];

    const warningDetails = Array.isArray(nativeResult && nativeResult.warningDetails)
      ? nativeResult.warningDetails
      : [];

    const warningCodes = new Set(
      warningDetails
        .map((item) => (item && item.code ? String(item.code) : ''))
        .filter(Boolean)
    );

    const hasFallbackCode =
      warningCodes.has(WARNING_CODES.onepkg.unsupportedCompressionPlaceholders) ||
      warningCodes.has(WARNING_CODES.onepkg.unsupportedCompressionWithFallback) ||
      warningCodes.has(WARNING_CODES.onepkg.noFolderDecode);

    const hasFallbackRegex = warnings.some((item) =>
      /placeholder|unsupported compression|cannot be decoded in-browser/i.test(String(item || ''))
    );

    const extractionLabel = (hasFallbackCode || hasFallbackRegex)
      ? 'parsed with fallbacks'
      : 'parsed';

    const info = document.createElement('div');
    info.className =
      'rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700';
    info.textContent = `${sourceLabel}: ${extractionLabel}. Pages discovered: ${pages.length}`;
    content.appendChild(info);

    const isOnePkgCompressedFallback =
      nativeResult &&
      nativeResult.sourceKind === 'onepkg' &&
      (
        warningCodes.has(WARNING_CODES.onepkg.unsupportedCompressionPlaceholders) ||
        warningCodes.has(WARNING_CODES.onepkg.unsupportedCompressionWithFallback) ||
        warningCodes.has(WARNING_CODES.onepkg.lzxDecoderHint) ||
        warnings.some((item) => /unsupported compression|lzx/i.test(String(item || '')))
      );

    if (isOnePkgCompressedFallback) {
      renderCompressedHelper(content);
    }

    if (nativeResult && nativeResult.hierarchy) {
      const downloadBaseName = file && file.name
        ? baseNameFromFile(file.name)
        : 'native';

      const pageMap = new Map(
        pages
          .filter((page) => page && page.path)
          .map((page) => [page.path, page])
      );

      content.appendChild(
        buildHierarchyList(nativeResult.hierarchy, pageMap, downloadBaseName)
      );
    }

    if (warnings.length > 0) {
      const details = document.createElement('details');
      details.className = 'rounded-lg border border-slate-200 bg-white p-3';

      const summary = document.createElement('summary');
      summary.className = 'cursor-pointer text-sm font-medium text-slate-800';
      summary.textContent = 'Native parser notes';
      details.appendChild(summary);

      const warnList = document.createElement('ul');
      warnList.className = 'mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700';

      for (const warning of warnings) {
        const warnItem = document.createElement('li');
        warnItem.textContent = warning;
        warnList.appendChild(warnItem);
      }

      details.appendChild(warnList);
      content.appendChild(details);
    }

    const zipButton = document.createElement('button');
    zipButton.type = 'button';
    zipButton.textContent = `Download ${sourceLabel} ZIP`;
    zipButton.className = ctx.BUTTON_SECONDARY_CLASS;

    zipButton.onclick = async () => {
      zipButton.disabled = true;
      const originalText = zipButton.textContent;
      zipButton.textContent = 'Building ZIP...';
      try {
        await downloadNativeZip(file, nativeResult);
      } finally {
        zipButton.textContent = originalText;
        zipButton.disabled = false;
      }
    };

    getActionContainer(li).appendChild(zipButton);
  }

  return { renderNativeResult };
}

export function initUI(workerManager) {
  const ctx = {
    fileInput: document.getElementById('fileInput'),
    importButton: document.getElementById('importButton'),
    dropzone: document.getElementById('dropzone'),
    fileList: document.getElementById('fileList'),
    controlsPanel: document.getElementById('controls'),
    statusPanel: document.getElementById('statusPanel'),
    importStateText: document.getElementById('importStateText'),
    statusSummary: document.getElementById('statusSummary'),
    statusHelp: document.getElementById('statusHelp'),
    warningSummary: document.getElementById('warningSummary'),
    appStateBadge: document.getElementById('appStateBadge'),
    diagnosticsPanel: document.getElementById('diagnosticsPanel'),
    diagnosticsCount: document.getElementById('diagnosticsCount'),
    diagnosticsSummaryText: document.getElementById('diagnosticsSummaryText'),
    diagnosticsList: document.getElementById('diagnosticsList'),
    conversionProfile: document.getElementById('conversionProfile'),
    toolbarEnabled: document.getElementById('toolbarEnabled'),
    toolbarEditToggleEnabled: document.getElementById('toolbarEditToggleEnabled'),
    toolbarMetadataToggleEnabled: document.getElementById('toolbarMetadataToggleEnabled'),
    filterFailures: document.getElementById('filterFailures'),
    collapseStatus: document.getElementById('collapseStatus'),
    downloadZipButton: document.getElementById('downloadZip'),

    allowedExtensions: ['.mht', '.mhtml', '.html', '.htm', '.one', '.onepkg'],
    allowedMimeTypes: ['text/html', 'message/rfc822', 'application/octet-stream'],
    successfulOutputs: new Map(),
    diagnostics: [],

    FAILURE_STATES: new Set(['error', 'unsupported']),
    WARNING_LEVELS: new Set(['warn', 'warning', 'error']),
    MHTML_MARKER_REGEX: /Single File Web Page|Web Archive|(^From:|^Content-Type: multipart\/related|^--)/i,
    NATIVE_PARTIAL_REGEX: /fallback|unsupported compression|placeholder|cannot be decoded/i
  };

  const state = createStateHelpers(ctx);
  const downloads = createDownloadHelpers(ctx, state.updateZipButton);
  const diagnostics = createDiagnosticsHelpers(ctx, state.updateStateSummary);
  const nativeUi = createNativeRenderer(ctx, {
    downloadBlob: downloads.downloadBlob,
    downloadNativeZip: downloads.downloadNativeZip
  });

  function setDropzoneHighlight(active) {
    if (!ctx.dropzone) return;
    ctx.dropzone.classList.toggle('border-sky-500', active);
    ctx.dropzone.classList.toggle('bg-sky-50', active);
    ctx.dropzone.classList.toggle('text-sky-700', active);
    ctx.dropzone.classList.toggle('border-slate-300', !active);
    ctx.dropzone.classList.toggle('bg-slate-50', !active);
    ctx.dropzone.classList.toggle('text-slate-700', !active);
  }

  function isSupportedFile(file) {
    const name = (file && file.name) ? file.name.toLowerCase() : '';
    const type = (file && file.type) ? file.type.toLowerCase() : '';
    return ctx.allowedExtensions.some((ext) => name.endsWith(ext)) ||
      (type ? ctx.allowedMimeTypes.includes(type) : false);
  }

  function addUnsupportedFile(file) {
    const id = crypto.randomUUID();
    const li = state.addListItem(file.name || 'unknown', id);
    const unsupportedMessage = 'Expected .mht, .mhtml, .html, .htm, .one, or .onepkg';
    state.setStatus(li, 'unsupported', unsupportedMessage);
    diagnostics.recordDiagnostic(
      file.name || 'unknown',
      `Unsupported file type. ${unsupportedMessage}.`,
      'warning'
    );
  }

  async function buildPayload(file, id) {
    const sourceKind = detectSourceKind(file.name, file.type);

    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      const bytes = await file.arrayBuffer();
      return {
        payload: {
          id,
          type: 'process-native-file',
          fileName: file.name,
          relativePath: file.name,
          sourceKind,
          bytes,
          config: downloads.getConversionConfig()
        },
        transferList: [bytes],
        sourceKind
      };
    }

    return {
      payload: {
        id,
        type: 'process-file',
        fileName: file.name,
        sourceKind,
        html: await file.text(),
        relativePath: file.name,
        config: downloads.getConversionConfig()
      },
      transferList: [],
      sourceKind
    };
  }

  function handlePipelineResult(li, file, res) {
    const logs = Array.isArray(res.logs) ? res.logs : [];
    const hasWarnings = diagnostics.addDiagnosticsFromLogs(file.name, logs);

    state.setStatus(
      li,
      hasWarnings ? 'partial' : 'success',
      hasWarnings ? 'completed with warnings' : 'complete'
    );

    const out = res.outputHtml || '';

    if (ctx.MHTML_MARKER_REGEX.test(out)) {
      diagnostics.recordDiagnostic(
        file.name,
        'Output may still contain MHTML wrapper markers.',
        'warning'
      );

      const dbgName =
        file.name.replace(/\.(mht|mhtml|htm|html)$/i, '') + '_debug_output.txt';

      const btn = document.createElement('button');
      btn.textContent = 'Download debug output';
      btn.className = ctx.BUTTON_SECONDARY_CLASS;
      btn.onclick = () => downloads.downloadDebug(dbgName, out.slice(0, 20000));

      li.querySelector('.item-actions')?.appendChild(btn);
      return;
    }

    const downloadName =
      file.name.replace(/\.(mht|mhtml|htm|html)$/i, '') + '_cleaned.html';

    ctx.successfulOutputs.set(downloadName, out);
    state.updateZipButton();

    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([`\uFEFF${out}`], { type: 'text/html;charset=utf-8' })
    );
    a.download = downloadName;
    a.textContent = 'Download';
    a.className = ctx.LINK_ACTION_CLASS;

    li.querySelector('.item-actions')?.appendChild(a);
  }

  async function handleFile(file) {
    if (!isSupportedFile(file)) {
      addUnsupportedFile(file);
      return;
    }

    const id = crypto.randomUUID();
    const li = state.addListItem(file.name, id);

    const onprogress = (p) => {
      const step = p.step || 'progress';
      const pct = p.percent ? ` ${p.percent}%` : '';
      state.setStatus(li, 'working', `${step}${pct}`);
    };

    const { payload, transferList } = await buildPayload(file, id);
    state.setStatus(li, 'working', 'starting');

    workerManager.enqueue(payload, onprogress, transferList)
      .then((res) => {
        if (res.resultType === 'native') {
          const nativeResult = res.nativeResult || {};
          const warningStrings = Array.isArray(nativeResult.warnings)
            ? nativeResult.warnings
            : [];

          diagnostics.addDiagnosticsFromMessages(file.name, warningStrings, 'warning');

          const isPartial = warningStrings.some((item) =>
            ctx.NATIVE_PARTIAL_REGEX.test(String(item || ''))
          );

          state.setStatus(
            li,
            isPartial ? 'partial' : 'success',
            isPartial ? 'completed with warnings or fallbacks' : 'native parse complete'
          );

          nativeUi.renderNativeResult(li, file, nativeResult);
          return;
        }

        handlePipelineResult(li, file, res);
      })
      .catch((err) => {
        state.setStatus(li, 'error', 'processing failed');
        diagnostics.recordDiagnostic(file.name, String(err), 'error');

        const dbgName =
          file.name.replace(/\.(mht|mhtml|htm|html|one|onepkg)$/i, '') +
          '_error_debug.txt';

        downloads.downloadDebug(dbgName, String(err));
      });
  }

  ctx.fileInput.addEventListener('change', async (ev) => {
    for (const f of ev.target.files) {
      await handleFile(f);
    }
  });

  if (ctx.importButton) {
    ctx.importButton.addEventListener('click', () => {
      ctx.fileInput.multiple = true;
      ctx.fileInput.click();
    });
  }

  ctx.dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    setDropzoneHighlight(true);
  });

  ctx.dropzone.addEventListener('dragover', (e) => e.preventDefault());

  ctx.dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    setDropzoneHighlight(false);
  });

  ctx.dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    setDropzoneHighlight(false);
    for (const f of e.dataTransfer.files) {
      await handleFile(f);
    }
  });

  if (ctx.filterFailures) {
    ctx.filterFailures.addEventListener('change', state.applyFilters);
  }

  if (ctx.collapseStatus) {
    ctx.collapseStatus.addEventListener('change', state.applyCollapse);
    state.applyCollapse();
  }

  if (ctx.downloadZipButton) {
    ctx.downloadZipButton.addEventListener('click', downloads.downloadZip);
    state.updateZipButton();
  }

  state.updateStateSummary();
}