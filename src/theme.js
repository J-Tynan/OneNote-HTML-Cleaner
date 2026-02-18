// src/theme.js
const STORAGE_KEY = 'theme';
const TOGGLE_ID = 'themeToggle';
const ICON_ID = 'themeToggleIcon';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  updateToggleUI(theme);
}

function effectiveThemeFromSystem() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

function updateToggleUI(theme) {
  const btn = document.getElementById(TOGGLE_ID);
  const icon = document.getElementById(ICON_ID);
  if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

export function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  applyTheme(next);
  return next;
}

export function initTheme() {
  // Determine persisted preference. If none exists, default to LIGHT and persist it.
  let stored;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { stored = null; }

  let theme;
  if (stored === 'dark' || stored === 'light') {
    theme = stored;
  } else {
    theme = 'light';
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore write errors */ }
  }

  // Apply the resolved theme and update UI
  applyTheme(theme);

  // Wire UI toggle if present
  const btn = document.getElementById(TOGGLE_ID);
  if (btn) {
    btn.addEventListener('click', () => toggleTheme());
    // reflect initial state
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}
