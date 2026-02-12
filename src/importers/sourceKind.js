export function detectSourceKind(fileName = '', mimeType = '') {
  const name = String(fileName || '').toLowerCase();
  const type = String(mimeType || '').toLowerCase();

  if (name.endsWith('.onepkg')) return 'onepkg';
  if (name.endsWith('.one')) return 'one';
  if (name.endsWith('.mht') || name.endsWith('.mhtml') || /multipart\/related/i.test(type)) return 'mht';
  if (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html') return 'html';
  return 'unknown';
}

export function baseNameFromFile(fileName = '') {
  const name = String(fileName || 'input').trim();
  return name.replace(/\.[^./\\]+$/, '') || 'input';
}

export function toFolderSafeName(name = '') {
  return String(name || 'item')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'item';
}