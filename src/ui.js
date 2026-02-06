// src/ui.js
// UI glue: file input, drag/drop, worker handling, debug helpers
// Includes BOM on downloads and diagnostic logging to help track MHT -> HTML issues.

export function initUI(workerManager) {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileList = document.getElementById('fileList');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addListItem(name, id) {
    const el = document.createElement('div');
    el.className = 'file-item';
    el.dataset.id = id;
    el.innerHTML = `<strong>${escapeHtml(name)}</strong> <span class="status">queued</span>`;
    fileList.appendChild(el);
    return el;
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

  async function handleFile(file) {
    const text = await file.text();
    const id = crypto.randomUUID();
    const li = addListItem(file.name, id);

    // Progress callback wrapper
    const onprogress = (p) => {
      const status = li.querySelector('.status');
      if (!status) return;
      const step = p.step || 'progress';
      const pct = p.percent ? ` ${p.percent}%` : '';
      status.textContent = `${step}${pct}`;
    };

    // Store a small preview for diagnostics
    console.log(`[ui] enqueue file=${file.name} size=${file.size} type=${file.type}`);

    workerManager.enqueue({ id, type: 'process-file', fileName: file.name, html: text, relativePath: file.name, config: {} }, onprogress)
      .then(res => {
        try {
          li.querySelector('.status').textContent = 'done';
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
        li.querySelector('.status').textContent = 'error';
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
}
