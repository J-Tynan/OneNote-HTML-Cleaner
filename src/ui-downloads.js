// src/ui-downloads.js
import { baseNameFromFile, toFolderSafeName } from './importers/sourceKind.js';
import { createLogger } from './logging.js';
const logger = createLogger('ui');

export function createDownloadHelpers(ctx, updateZipButton) {
  function getSuccessfulOutputRecord(value) {
    if (value && typeof value === 'object' && typeof value.html === 'string') {
      return {
        html: value.html,
        assets: Array.isArray(value.assets) ? value.assets : [],
        config: value.config || null
      };
    }

    return {
      html: typeof value === 'string' ? value : '',
      assets: [],
      config: null
    };
  }

  function ensureStylesheetLink(html, href) {
    const linkTag = `<link rel="stylesheet" href="${href}">`;
    if (new RegExp(`<link\\s+[^>]*href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i').test(html)) {
      return html;
    }
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${linkTag}</head>`);
    }
    if (/<html[^>]*>/i.test(html)) {
      return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${linkTag}</head>`);
    }
    return `${linkTag}${html}`;
  }

  function getCssAssetContent(record) {
    const cssAsset = (record.assets || []).find(asset => asset && asset.type === 'text/css' && typeof asset.content === 'string');
    return cssAsset ? cssAsset.content : '';
  }

  function downloadBlob(filename, text, mime = 'text/html') {
    const bom = '\uFEFF';
    const content = bom + (text || '');

    const hasCharset = /<meta\s+charset=["']?utf-8["']?/i.test(content)
      || /<meta\s+http-equiv=["']content-type["']\s+content=["'][^"']*charset=utf-8/i.test(content);
    const hasDataImages = /data:image\//i.test(content);
    logger.info({ msg: `downloadBlob: filename=${filename}`, meta: { hasCharset, hasDataImages, length: content.length } });

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
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
    const profile = ctx.conversionProfile ? ctx.conversionProfile.value : 'cornell';
    return {
      Profile: profile,
      OutputCleanupMode: 'safe',
      UnitStrategy: 'normalize-safe',
      TailwindCssHref: 'assets/tailwind-output.css',
      ToolbarEnabled: Boolean(ctx.toolbarEnabled && ctx.toolbarEnabled.checked),
      ToolbarEditToggleEnabled: Boolean(ctx.toolbarEditToggleEnabled && ctx.toolbarEditToggleEnabled.checked),
      ToolbarMetadataToggleEnabled: Boolean(ctx.toolbarMetadataToggleEnabled && ctx.toolbarMetadataToggleEnabled.checked),
      ExternalizeCssEnabled: Boolean(ctx.externalizeCssEnabled && ctx.externalizeCssEnabled.checked),
      ExternalizeCssMode: ctx.externalizeCssMode ? String(ctx.externalizeCssMode.value || 'shared') : 'shared',
      ToolbarBundleMode: 'inline'
    };
  }

  async function downloadZip() {
    if (!ctx.downloadZipButton || ctx.downloadZipButton.disabled) return;
    const JSZip = window.JSZip;
    if (!JSZip) {
      logger.error({ msg: 'JSZip not available; ensure dependency is installed and loaded' });
      return;
    }

    const zip = new JSZip();
    const sharedCssParts = [];
    const sharedCssFilename = 'converted-shared.css';
    const perPageCssTaken = new Set();

    for (const [name, value] of ctx.successfulOutputs.entries()) {
      const record = getSuccessfulOutputRecord(value);
      let html = record.html || '';
      const config = record.config || {};
      const externalizeEnabled = config.ExternalizeCssEnabled === true;
      const cssMode = String(config.ExternalizeCssMode || 'shared').toLowerCase() === 'per-page' ? 'per-page' : 'shared';
      const cssContent = getCssAssetContent(record).trim();

      if (externalizeEnabled && cssContent) {
        if (cssMode === 'per-page') {
          const stem = String(name || 'output.html').replace(/\.html$/i, '') || 'output';
          let cssName = `${stem}.css`;
          let suffix = 2;
          while (perPageCssTaken.has(cssName)) {
            cssName = `${stem} (${suffix}).css`;
            suffix += 1;
          }
          perPageCssTaken.add(cssName);
          html = ensureStylesheetLink(html, cssName);
          zip.file(cssName, `${cssContent}\n`);
        } else {
          html = ensureStylesheetLink(html, sharedCssFilename);
          sharedCssParts.push(cssContent);
        }
      }

      zip.file(name, `\uFEFF${html}`);
    }

    if (sharedCssParts.length) {
      const uniqueParts = Array.from(new Set(sharedCssParts.filter(Boolean)));
      zip.file(sharedCssFilename, `${uniqueParts.join('\n\n')}\n`);
    }

    ctx.downloadZipButton.disabled = true;
    ctx.downloadZipButton.textContent = 'Building ZIP...';

    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
      downloadBinary(getZipFilename(), blob);
    } finally {
      ctx.downloadZipButton.textContent = 'Download ZIP';
      updateZipButton();
    }
  }

  async function downloadNativeZip(file, nativeResult) {
    const JSZip = window.JSZip;
    if (!JSZip) {
      logger.error({ msg: 'JSZip not available; ensure dependency is installed and loaded' });
      return;
    }

    const zip = new JSZip();
    const pages = Array.isArray(nativeResult && nativeResult.pages) ? nativeResult.pages : [];
    const writtenResources = new Set();

    for (const page of pages) {
      if (!page || !page.path) continue;
      zip.file(page.path, `\uFEFF${page.html || ''}`);

      const metadata = page && typeof page.metadata === 'object' ? page.metadata : null;
      if (metadata) {
        const metadataPath = page.path.endsWith('.html')
          ? page.path.replace(/\.html$/i, '.metadata.json')
          : `${page.path}.metadata.json`;

        zip.file(metadataPath, `${JSON.stringify({ name: page.name || null, path: page.path, metadata }, null, 2)}\n`);
      }

      const resources = Array.isArray(page.resources) ? page.resources : [];
      for (const resource of resources) {
        if (!resource || !resource.path || writtenResources.has(resource.path)) continue;

        const rawBytes = resource.bytes;
        const payload = rawBytes instanceof Uint8Array
          ? rawBytes
          : rawBytes instanceof ArrayBuffer
            ? new Uint8Array(rawBytes)
            : null;

        if (!payload || payload.length === 0) continue;
        zip.file(resource.path, payload, { binary: true });
        writtenResources.add(resource.path);
      }
    }

    if (pages.length === 0) {
      const baseName = toFolderSafeName(baseNameFromFile(file.name));
      const warnings = Array.isArray(nativeResult && nativeResult.warnings) ? nativeResult.warnings : [];
      zip.file(`${baseName}/README.txt`, ['No converted pages were available for export in this build.', '', ...warnings].join('\n'));
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
    downloadBinary(`${baseNameFromFile(file.name)}_converted.zip`, blob);
  }

  return {
    downloadBlob,
    downloadDebug,
    downloadBinary,
    downloadZip,
    downloadNativeZip,
    getConversionConfig
  };
}
