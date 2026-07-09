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

function extractTagContentLength(html, tag, id) {
  const match = String(html || '').match(new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) {
    fail(`Expected ${id} ${tag} tag to be present for size measurement`);
  }
  return match[1].length;
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

  function assertSharedToolbarMarkup(html, preset) {
    if (!new RegExp(`id="onenote-cleaner-toolbar"[^>]*data-onc-toolbar-preset="${preset}"`, 'i').test(html)) {
      fail(`Expected ${preset} toolbar preset marker on injected toolbar`);
    }
    if (!new RegExp(`id="onc-toolbar-style"[^>]*data-onc-toolbar-preset="${preset}"`, 'i').test(html)) {
      fail(`Expected ${preset} toolbar preset marker on injected toolbar style tag`);
    }
    if (!/data-onc-action="edit-toggle"/i.test(html)) {
      fail(`Expected edit toggle control on ${preset} toolbar`);
    }
    if (!/data-onc-action="metadata-toggle"/i.test(html)) {
      fail(`Expected metadata toggle control on ${preset} toolbar`);
    }
    if (!/data-onc-action="hide-toolbar"/i.test(html)) {
      fail(`Expected hide control on ${preset} toolbar`);
    }
    if (!/data-onc-action="save"/i.test(html)) {
      fail(`Expected save control on ${preset} toolbar`);
    }
    if (!/data-onc-edit-command="bold"[^>]*data-onc-active="false"[^>]*aria-pressed="false"/i.test(html)) {
      fail(`Expected inactive edit command attributes on ${preset} toolbar buttons`);
    }
    if (!/data-onc-role="style-select"/i.test(html) || !/data-onc-role="color-input"/i.test(html)) {
      fail(`Expected style and color edit controls on ${preset} toolbar`);
    }
    if (!/data-onc-field="page-title"/i.test(html) || !/data-onc-field="export-format"/i.test(html)) {
      fail(`Expected page-title and export-format metadata fields on ${preset} toolbar`);
    }
    if (/data-onc-action="save-as"/i.test(html)) {
      fail(`Did not expect save-as control on ${preset} toolbar`);
    }
    if (/Advanced features in one toolbar/i.test(html)) {
      fail(`Did not expect removed helper message text on ${preset} toolbar`);
    }
  }

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
  if (!/id="onenote-cleaner-toolbar"[^>]*data-onc-toolbar-preset="compact"/i.test(injected)) {
    fail('Expected compact toolbar preset marker on default injected toolbar');
  }
  if (!/id="onc-toolbar-style"[^>]*data-onc-toolbar-preset="compact"/i.test(injected)) {
    fail('Expected compact toolbar preset marker on injected toolbar style tag');
  }
  assertSharedToolbarMarkup(injected, 'compact');
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

  const officeInjected = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    ToolbarStyle: 'office-97'
  });
  assertSharedToolbarMarkup(officeInjected, 'office-97');

  const classicAliasInjected = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    ToolbarStyle: 'classic'
  });
  assertSharedToolbarMarkup(classicAliasInjected, 'office-97');

  for (const preset of ['ribbon', 'macos', 'linux']) {
    const injectedPreset = mod.injectOutputToolbar(baseHtml, {
      ToolbarEnabled: true,
      ToolbarEditToggleEnabled: true,
      ToolbarMetadataToggleEnabled: true,
      ToolbarBundleMode: 'inline',
      ToolbarStyle: preset
    });
    assertSharedToolbarMarkup(injectedPreset, preset);
  }

  const fallbackPreset = mod.injectOutputToolbar(baseHtml, {
    ToolbarEnabled: true,
    ToolbarEditToggleEnabled: true,
    ToolbarMetadataToggleEnabled: true,
    ToolbarBundleMode: 'inline',
    ToolbarStyle: 'retro-office'
  });
  if (!/id="onenote-cleaner-toolbar"[^>]*data-onc-toolbar-preset="compact"/i.test(fallbackPreset)) {
    fail('Expected invalid toolbar preset values to fallback to compact');
  }
  assertSharedToolbarMarkup(fallbackPreset, 'compact');

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

  const payloadMetrics = {
    totalInjectedOutputLength: withThemeToggle.length,
    toolbarStyleTagContentLength: extractTagContentLength(injected, 'style', 'onc-toolbar-style'),
    toolbarScriptTagContentLength: extractTagContentLength(injected, 'script', 'onc-toolbar-script'),
    convertedThemeStyleTagContentLength: extractTagContentLength(withThemeToggle, 'style', 'onc-converted-theme-style'),
    convertedThemeScriptTagContentLength: extractTagContentLength(withThemeToggle, 'script', 'onc-converted-theme-script')
  };

  if (payloadMetrics.totalInjectedOutputLength >= 34000) {
    fail(`Expected injected toolbar + theme payload to stay below 34000 chars, got ${payloadMetrics.totalInjectedOutputLength}`);
  }
  if (payloadMetrics.toolbarScriptTagContentLength >= 21000) {
    fail(`Expected toolbar script payload to stay below 21000 chars, got ${payloadMetrics.toolbarScriptTagContentLength}`);
  }
  if (payloadMetrics.toolbarStyleTagContentLength >= 6200) {
    fail(`Expected toolbar style payload to stay below 6200 chars, got ${payloadMetrics.toolbarStyleTagContentLength}`);
  }
  if (payloadMetrics.convertedThemeScriptTagContentLength >= 1450) {
    fail(`Expected converted-page theme script payload to stay below 1450 chars, got ${payloadMetrics.convertedThemeScriptTagContentLength}`);
  }
  if (payloadMetrics.convertedThemeStyleTagContentLength >= 2120) {
    fail(`Expected converted-page theme style payload to stay below 2120 chars, got ${payloadMetrics.convertedThemeStyleTagContentLength}`);
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
