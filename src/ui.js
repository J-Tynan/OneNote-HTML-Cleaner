// src/ui.js
// UI glue: file input, drag/drop, worker handling, debug helpers
// Includes BOM on downloads and diagnostic logging to help track MHT -> HTML issues.

import { detectSourceKind, baseNameFromFile, toFolderSafeName } from './importers/sourceKind.js';

export function initUI(workerManager) {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileList = document.getElementById('fileList');
  const conversionProfile = document.getElementById('conversionProfile');
  const filterFailures = document.getElementById('filterFailures');
  const collapseStatus = document.getElementById('collapseStatus');
  const downloadZipButton = document.getElementById('downloadZip');
  const allowedExtensions = ['.mht', '.mhtml', '.html', '.htm', '.one', '.onepkg'];
  const allowedMimeTypes = ['text/html', 'message/rfc822', 'application/octet-stream'];
  const successfulOutputs = new Map();

  async function downloadNativeZip(file, nativeResult) {
    const JSZip = window.JSZip;
    if (!JSZip) {
      console.error('[ui] JSZip not available; ensure dependency is installed and loaded');
      return;
    }

    const zip = new JSZip();
    const pages = Array.isArray(nativeResult && nativeResult.pages) ? nativeResult.pages : [];

    for (const page of pages) {
      if (!page || !page.path) continue;
      const html = page.html || '';
      zip.file(page.path, '\uFEFF' + html);
    }

    if (pages.length === 0) {
      const baseName = toFolderSafeName(baseNameFromFile(file.name));
      const warnings = Array.isArray(nativeResult && nativeResult.warnings) ? nativeResult.warnings : [];
      const note = [
        'No converted pages were available for export in this build.',
        '',
        ...warnings
      ].join('\n');
      zip.file(`${baseName}/README.txt`, note);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
    const downloadName = `${baseNameFromFile(file.name)}_converted.zip`;
    downloadBinary(downloadName, blob);
  }

  function buildHierarchyList(node) {
    const ul = document.createElement('ul');
    ul.className = 'native-tree';

    const li = document.createElement('li');
    li.textContent = node.name || '(unnamed)';
    ul.appendChild(li);

    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
      const childContainer = document.createElement('ul');
      for (const child of children) {
        const childTree = buildHierarchyList(child);
        childContainer.appendChild(childTree.firstElementChild);
      }
      li.appendChild(childContainer);
    }

    return ul;
  }

  function renderNativeResult(li, file, nativeResult) {
    const info = document.createElement('div');
    info.className = 'native-info';

    const sourceLabel = nativeResult && nativeResult.sourceKind ? nativeResult.sourceKind.toUpperCase() : 'NATIVE';
    const pages = Array.isArray(nativeResult && nativeResult.pages) ? nativeResult.pages : [];
    info.textContent = `${sourceLabel}: parsed. Pages discovered: ${pages.length}`;
    li.appendChild(info);

    if (nativeResult && nativeResult.hierarchy) {
      li.appendChild(buildHierarchyList(nativeResult.hierarchy));
    }

    const warnings = Array.isArray(nativeResult && nativeResult.warnings) ? nativeResult.warnings : [];
    if (warnings.length > 0) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Native parser notes';
      details.appendChild(summary);
      const warnList = document.createElement('ul');
      for (const warning of warnings) {
        const warnItem = document.createElement('li');
        warnItem.textContent = warning;
        warnList.appendChild(warnItem);
      }
      details.appendChild(warnList);
      li.appendChild(details);
    }

    if (pages.length > 0) {
      const pagesContainer = document.createElement('div');
      pagesContainer.className = 'native-pages';
      pagesContainer.textContent = 'Page downloads:';

      for (const page of pages) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Download ${page.name || 'page'}`;
        button.onclick = () => {
          const html = page.html || '';
          const downloadName = `${baseNameFromFile(file.name)}_${toFolderSafeName(page.name || 'page')}.html`;
          downloadBlob(downloadName, html, 'text/html');
        };
        pagesContainer.appendChild(document.createTextNode(' '));
        pagesContainer.appendChild(button);
      }

      li.appendChild(pagesContainer);
    }

    const zipButton = document.createElement('button');
    zipButton.type = 'button';
    zipButton.textContent = `Download ${sourceLabel} ZIP`;
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
    li.appendChild(document.createTextNode(' '));
    li.appendChild(zipButton);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addListItem(name, id) {
    const el = document.createElement('div');
    el.className = 'file-item';
    el.dataset.id = id;
    el.dataset.status = 'queued';
    el.innerHTML = `<strong>${escapeHtml(name)}</strong> <span class="status-badge status-queued">Queued</span> <span class="status-text">queued</span>`;
    fileList.appendChild(el);
    applyFilters();
    return el;
  }

  function applyFilters() {
    if (!filterFailures) return;
    const showOnlyFailures = filterFailures.checked;
    const items = fileList.querySelectorAll('.file-item');
    for (const item of items) {
      const status = item.dataset.status || 'queued';
      const isFailure = status === 'error' || status === 'unsupported';
      item.style.display = (!showOnlyFailures || isFailure) ? '' : 'none';
    }
  }

  function applyCollapse() {
    if (!collapseStatus) return;
    fileList.classList.toggle('status-collapsed', collapseStatus.checked);
  }

  function updateZipButton() {
    if (!downloadZipButton) return;
    downloadZipButton.disabled = successfulOutputs.size === 0;
  }

  function setStatus(li, state, detail) {
    const badge = li.querySelector('.status-badge');
    const text = li.querySelector('.status-text');
    if (!badge || !text) return;

    const labels = {
      queued: 'Queued',
      working: 'Working',
      success: 'Done',
      error: 'Error',
      unsupported: 'Unsupported'
    };

    badge.className = `status-badge status-${state}`;
    badge.textContent = labels[state] || state;
    text.textContent = detail || '';
    li.dataset.status = state;
    applyFilters();
  }

  function isSupportedFile(file) {
    const name = (file && file.name) ? file.name.toLowerCase() : '';
    const hasExt = allowedExtensions.some(ext => name.endsWith(ext));
    const type = (file && file.type) ? file.type.toLowerCase() : '';
    const hasType = type ? allowedMimeTypes.includes(type) : false;
    return hasExt || hasType;
  }

  function addUnsupportedFile(file) {
    const id = crypto.randomUUID();
    const li = addListItem(file.name || 'unknown', id);
    setStatus(li, 'unsupported', 'Expected .mht, .mhtml, .html, .htm, .one, or .onepkg');
  }

  // Download helper that prepends a UTF-8 BOM to help Edge detect UTF-8 correctly.
  function downloadBlob(filename, text, mime = 'text/html') {
    const bom = '\uFEFF';
    const content = bom + (text || '');

    // Diagnostics
    const hasCharset = /<meta\s+charset=["']?utf-8["']?/i.test(content) ||
                       /<meta\s+http-equiv=["']content-type["']\s+content=["'][^"']*charset=utf-8/i.test(content);
    const hasDataImages = /data:image\//i.test(content);
    console.log(`[ui] downloadBlob: filename=${filename} hasCharset=${hasCharset} hasDataImages=${hasDataImages} length=${content.length}`);

    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function downloadDebug(name, text) {
    downloadBlob(name, text, 'text/plain');
  }

  function downloadBinary(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function getZipFilename() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `cleaned_${stamp}.zip`;
  }

  function getConversionConfig() {
    const profile = conversionProfile ? conversionProfile.value : 'cornell';
    return {
      Profile: profile,
      TailwindCssHref: 'assets/tailwind-output.css'
    };
  }

  async function downloadZip() {
    if (!downloadZipButton || downloadZipButton.disabled) return;
    const JSZip = window.JSZip;
    if (!JSZip) {
      console.error('[ui] JSZip not available; ensure dependency is installed and loaded');
      return;
    }

    const zip = new JSZip();
    for (const [name, html] of successfulOutputs.entries()) {
      const content = '\uFEFF' + (html || '');
      zip.file(name, content);
    }

    downloadZipButton.disabled = true;
    downloadZipButton.textContent = 'Building ZIP...';

    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
      downloadBinary(getZipFilename(), blob);
    } finally {
      downloadZipButton.textContent = 'Download ZIP';
      updateZipButton();
    }
  }

  async function handleFile(file) {
    if (!isSupportedFile(file)) {
      addUnsupportedFile(file);
      return;
    }

    const sourceKind = detectSourceKind(file.name, file.type);
    const id = crypto.randomUUID();
    const li = addListItem(file.name, id);

    // Progress callback wrapper
    const onprogress = (p) => {
      const step = p.step || 'progress';
      const pct = p.percent ? ` ${p.percent}%` : '';
      setStatus(li, 'working', `${step}${pct}`);
    };

    // Store a small preview for diagnostics
    console.log(`[ui] enqueue file=${file.name} size=${file.size} type=${file.type}`);

    let payload;
    let transferList = [];

    if (sourceKind === 'one' || sourceKind === 'onepkg') {
      const bytes = await file.arrayBuffer();
      payload = {
        id,
        type: 'process-native-file',
        fileName: file.name,
        relativePath: file.name,
        sourceKind,
        bytes,
        config: getConversionConfig()
      };
      transferList = [bytes];
    } else {
      const text = await file.text();
      payload = {
        id,
        type: 'process-file',
        fileName: file.name,
        sourceKind,
        html: text,
        relativePath: file.name,
        config: getConversionConfig()
      };
    }

    workerManager.enqueue(payload, onprogress, transferList)
      .then(res => {
        try {
          if (res.resultType === 'native') {
            setStatus(li, 'success', 'native parse complete');
            renderNativeResult(li, file, res.nativeResult || {});
            return;
          }

          setStatus(li, 'success', 'complete');
          const out = res.outputHtml || '';
          console.log('[ui] pipeline result length:', out.length);
          console.log('[ui] pipeline result startsWith:', out.slice(0, 200).replace(/\r?\n/g, '\\n'));
          console.log('[ui] contains MHTML markers:', /(^From:|^Content-Type: multipart\/related|^--|Single File Web Page|Web Archive)/i.test(out));
          console.log('[ui] contains data images:', /data:image\//i.test(out));

          if (/Single File Web Page|Web Archive|(^From:|^Content-Type: multipart\/related|^--)/i.test(out)) {
            console.warn('[ui] output looks like MHTML wrapper or contains MIME markers');
            const dbgName = file.name.replace(/\.(mht|mhtml|htm|html)$/i, '') + '_debug_output.txt';
            const btn = document.createElement('button');
            btn.textContent = 'Download debug output';
            btn.onclick = () => downloadDebug(dbgName, out.slice(0, 20000));
            li.appendChild(document.createTextNode(' '));
            li.appendChild(btn);
          } else {
            const downloadName = file.name.replace(/\.(mht|mhtml|htm|html)$/i, '') + '_cleaned.html';
            successfulOutputs.set(downloadName, out);
            updateZipButton();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([('\uFEFF' + out)], { type: 'text/html;charset=utf-8' }));
            a.download = downloadName;
            a.textContent = 'Download';
            li.appendChild(document.createTextNode(' '));
            li.appendChild(a);
          }
        } catch (err) {
          console.error('[ui] error handling result:', err);
        }
      })
      .catch(err => {
        setStatus(li, 'error', 'processing failed');
        console.error('[ui] processing error:', err);
        const dbgName = file.name.replace(/\.(mht|mhtml|htm|html|one|onepkg)$/i, '') + '_error_debug.txt';
        downloadDebug(dbgName, String(err));
      });
  }

  fileInput.addEventListener('change', async (ev) => {
    for (const f of ev.target.files) {
      await handleFile(f);
    }
  });

  dropzone.addEventListener('dragover', e => e.preventDefault());
  dropzone.addEventListener('drop', async e => {
    e.preventDefault();
    for (const f of e.dataTransfer.files) {
      await handleFile(f);
    }
  });

  if (filterFailures) {
    filterFailures.addEventListener('change', applyFilters);
  }
  if (collapseStatus) {
    collapseStatus.addEventListener('change', applyCollapse);
    applyCollapse();
  }
  if (downloadZipButton) {
    downloadZipButton.addEventListener('click', downloadZip);
    updateZipButton();
  }
}
