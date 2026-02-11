// src/ui.js
// UI glue: file input, drag/drop, worker handling, debug helpers
// Includes BOM on downloads and diagnostic logging to help track MHT -> HTML issues.

export function initUI(workerManager) {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileList = document.getElementById('fileList');
  const filterFailures = document.getElementById('filterFailures');
  const collapseStatus = document.getElementById('collapseStatus');
  const downloadZipButton = document.getElementById('downloadZip');
  const allowedExtensions = ['.mht', '.mhtml', '.html', '.htm'];
  const allowedMimeTypes = ['text/html', 'message/rfc822', 'application/octet-stream'];
  const successfulOutputs = new Map();

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
    setStatus(li, 'unsupported', 'Expected .mht, .mhtml, .html, or .htm');
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
    const text = await file.text();
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

    workerManager.enqueue({ id, type: 'process-file', fileName: file.name, html: text, relativePath: file.name, config: {} }, onprogress)
      .then(res => {
        try {
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
        const dbgName = file.name.replace(/\.(mht|mhtml|htm|html)$/i, '') + '_error_debug.txt';
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
