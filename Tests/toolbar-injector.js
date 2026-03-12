import path from 'node:path';
import { pathToFileURL } from 'node:url';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function countMatches(input, re) {
  const matches = String(input || '').match(re);
  return Array.isArray(matches) ? matches.length : 0;
}

async function main() {
  const injectorPath = path.resolve(process.cwd(), 'src', 'pipeline', 'toolbarInjector.js');
  const injectorUrl = pathToFileURL(injectorPath).href;
  const mod = await import(injectorUrl);

  if (!mod || typeof mod.injectOutputToolbar !== 'function') {
    fail('Could not import injectOutputToolbar from src/pipeline/toolbarInjector.js');
  }
  if (typeof mod.injectConvertedPageThemeToggle !== 'function') {
    fail('Could not import injectConvertedPageThemeToggle from src/pipeline/toolbarInjector.js');
  }

  const baseHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sample</title></head><body><main><h1>Hello</h1><p>Body</p></main></body></html>';

  const injected = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    SourceName: 'Sample.mht',
    SourceKind: 'mht',
    Profile: 'onenote',
    WarningSummary: { total: 2, info: 1, warning: 1, error: 0 }
  });

  if (!/id="onenote-cleaner-toolbar"/i.test(injected)) {
    fail('Expected toolbar root to be injected once');
  }
  if (!/>Tools<\/span>/i.test(injected)) {
    fail('Expected toolbar title text to be Tools');
  }
  if (!/id="onenote-cleaner-toolbar"[^>]*\shidden/i.test(injected)) {
    fail('Expected injected toolbar to be hidden by default');
  }
  if (!/data-onc-action="edit-toggle"/i.test(injected)) {
    fail('Expected edit toggle control in injected toolbar');
  }
  if (!/data-onc-action="metadata-toggle"/i.test(injected)) {
    fail('Expected metadata toggle control in injected toolbar');
  }
  if (!/data-onc-action="hide-toolbar"/i.test(injected)) {
    fail('Expected hide control in injected toolbar');
  }
  if (!/data-onc-action="save"/i.test(injected)) {
    fail('Expected save control in injected toolbar');
  }
  if (/data-onc-action="save-as"/i.test(injected)) {
    fail('Did not expect save-as control in injected toolbar');
  }
  if (!/id="onc-toolbar-show"[^>]*>Toolbar</i.test(injected)) {
    fail('Expected toolbar reveal button label to be Toolbar');
  }
  if (!/data-onc-edit-command="undo"/i.test(injected)
    || !/data-onc-role="style-select"/i.test(injected)
    || !/data-onc-edit-command="bold"/i.test(injected)
    || !/data-onc-edit-command="italic"/i.test(injected)
    || !/data-onc-edit-command="color"/i.test(injected)
    || !/data-onc-role="color-input"/i.test(injected)
    || !/data-onc-edit-command="size"/i.test(injected)
    || !/data-onc-edit-command="sub"/i.test(injected)
    || !/data-onc-edit-command="super"/i.test(injected)
    || !/data-onc-edit-command="bullet"/i.test(injected)
    || !/data-onc-edit-command="number"/i.test(injected)
    || !/data-onc-edit-command="link"/i.test(injected)) {
    fail('Expected edit-mode formatting controls to be injected');
  }
  if (!/data-onc-edit-command="bold"[^>]*data-onc-active="false"[^>]*aria-pressed="false"/i.test(injected)) {
    fail('Expected edit command buttons to include inactive active-state attributes');
  }
  if (!/data-onc-edit-command="link"[^>]*>Link<\/button>/i.test(injected)) {
    fail('Expected hyperlink button label to be Link');
  }
  if (!/data-onc-role="style-select"[^>]*>.*Page Title.*Heading 1.*Heading 2.*Heading 3.*Heading 4.*Heading 5.*Heading 6.*Citation.*Quote.*Code.*Normal.*<\/select>/is.test(injected)) {
    fail('Expected styles dropdown to include the full OneNote-style option set');
  }
  if (!/data-onc-action="edit-toggle"[^>]*>Enable edit<\/button>/i.test(injected)) {
    fail('Expected edit toggle label to be Enable edit');
  }
  if (!/data-onc-action="hide-toolbar"[^>]*>Hide<\/button>/i.test(injected)) {
    fail('Expected hide button label to be Hide');
  }
  if (/>Hyperlink<\/button>/i.test(injected)) {
    fail('Did not expect Hyperlink label in edit controls');
  }
  if (/data-onc-field="profile"/i.test(injected) || /data-onc-field="warning-summary"/i.test(injected)) {
    fail('Did not expect Profile or Warnings metadata fields in injected toolbar');
  }
  if (!/data-onc-field="page-title"/i.test(injected) || !/data-onc-field="export-format"/i.test(injected)) {
    fail('Expected Page title and Format metadata fields in injected toolbar');
  }
  if (/Advanced features in one toolbar/i.test(injected)) {
    fail('Did not expect helper message text in injected toolbar');
  }

  const injectedAgain = mod.injectOutputToolbar(injected, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline'
  });

  const rootCount = countMatches(injectedAgain, /id="onenote-cleaner-toolbar"/gi);
  const styleCount = countMatches(injectedAgain, /id="onc-toolbar-style"/gi);
  const scriptCount = countMatches(injectedAgain, /id="onc-toolbar-script"/gi);

  if (rootCount !== 1 || styleCount !== 1 || scriptCount !== 1) {
    fail(`Expected idempotent injection (root/style/script exactly once), got root=${rootCount}, style=${styleCount}, script=${scriptCount}`);
  }

  const disabled = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: false,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline'
  });

  if (disabled !== baseHtml) {
    fail('Expected disabled toolbar config to keep output unchanged');
  }

  const withThemeToggle = mod.injectConvertedPageThemeToggle(baseHtml, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });

  if (!/id="onc-converted-theme-toggle"/i.test(withThemeToggle)) {
    fail('Expected converted-page theme toggle button to be injected');
  }
  if (!/id="onc-converted-theme-style"/i.test(withThemeToggle)) {
    fail('Expected converted-page theme toggle style to be injected');
  }
  if (!/id="onc-converted-theme-script"/i.test(withThemeToggle)) {
    fail('Expected converted-page theme toggle script to be injected');
  }
  if (!/const oledBlack = true;/i.test(withThemeToggle)) {
    fail('Expected OLED black flag to be embedded in injected script');
  }

  const withThemeToggleAgain = mod.injectConvertedPageThemeToggle(withThemeToggle, {
    ConvertedPageThemeToggleEnabled: true,
    ConvertedPageThemeToggleOledBlack: true,
    ExperimentalExportEnabled: false,
    ExportFormat: 'html'
  });
  const themeRootCount = countMatches(withThemeToggleAgain, /id="onc-converted-theme-toggle"/gi);
  const themeStyleCount = countMatches(withThemeToggleAgain, /id="onc-converted-theme-style"/gi);
  const themeScriptCount = countMatches(withThemeToggleAgain, /id="onc-converted-theme-script"/gi);
  if (themeRootCount !== 1 || themeStyleCount !== 1 || themeScriptCount !== 1) {
    fail(`Expected idempotent converted-page theme injection, got root=${themeRootCount}, style=${themeStyleCount}, script=${themeScriptCount}`);
  }

  const nonHtmlBypass = mod.injectConvertedPageThemeToggle(baseHtml, {
    ConvertedPageThemeToggleEnabled: true,
    ExperimentalExportEnabled: true,
    ExportFormat: 'markdown'
  });
  if (nonHtmlBypass !== baseHtml) {
    fail('Expected converted-page theme toggle to be skipped for non-HTML export format');
  }

  const injectedViaExportState = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    ExportFormat: 'html',
    SourceName: 'Sample.mht',
    SourceKind: 'mht',
    exportState: {
      ExperimentalExportEnabled: true,
      ExportFormat: 'markdown',
      MarkdownFlavor: 'gfm'
    }
  });
  if (!/data-onc-field="export-format">markdown<\/dd>/i.test(injectedViaExportState)) {
    fail('Expected explicit exportState to control toolbar metadata export format');
  }

  const nonHtmlBypassViaExportState = mod.injectConvertedPageThemeToggle(baseHtml, {
    ConvertedPageThemeToggleEnabled: true,
    ExportFormat: 'html',
    exportState: {
      ExperimentalExportEnabled: true,
      ExportFormat: 'markdown',
      MarkdownFlavor: 'gfm'
    }
  });
  if (nonHtmlBypassViaExportState !== baseHtml) {
    fail('Expected explicit exportState to control non-HTML theme toggle bypass');
  }

  console.log('toolbar-injector: OK');
}

main().catch((error) => {
  fail(`toolbar-injector failed: ${String(error && error.stack ? error.stack : error)}`);
});
