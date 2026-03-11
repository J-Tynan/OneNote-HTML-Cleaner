export const pipelineConfig = {
  version: '0.2.0'
};

function toBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

function normalizeToolbarBundleMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'inline' ? 'inline' : 'inline';
}

function normalizeOutputCleanupMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'safe') return 'safe';
  return 'off';
}

function normalizeUnitStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'normalize-safe') return 'normalize-safe';
  return 'preserve';
}

function normalizeExternalizeCssMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'per-page' ? 'per-page' : 'shared';
}

export function normalizeExportFormat(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'markdown') return normalized;
  return 'html';
}

export function normalizeMarkdownFlavor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'commonmark' || normalized === 'gfm' || normalized === 'markdown-extra') {
    return normalized;
  }
  return 'obsidian';
}

function normalizeExternalCssConfig(rawConfig = {}) {
  const enabledValue = Object.prototype.hasOwnProperty.call(rawConfig, 'ExternalizeCssEnabled')
    ? rawConfig.ExternalizeCssEnabled
    : rawConfig.externalizeCssEnabled;
  const modeValue = Object.prototype.hasOwnProperty.call(rawConfig, 'ExternalizeCssMode')
    ? rawConfig.ExternalizeCssMode
    : rawConfig.externalizeCssMode;
  return {
    ExternalizeCssEnabled: toBoolean(enabledValue, false),
    ExternalizeCssMode: normalizeExternalizeCssMode(modeValue)
  };
}

export function normalizeExportConfig(rawConfig = {}) {
  const experimentalEnabled = Object.prototype.hasOwnProperty.call(rawConfig, 'ExperimentalExportEnabled')
    ? rawConfig.ExperimentalExportEnabled
    : rawConfig.experimentalExportEnabled;
  const exportFormatValue = Object.prototype.hasOwnProperty.call(rawConfig, 'ExportFormat')
    ? rawConfig.ExportFormat
    : rawConfig.exportFormat;
  const markdownFlavorValue = Object.prototype.hasOwnProperty.call(rawConfig, 'MarkdownFlavor')
    ? rawConfig.MarkdownFlavor
    : rawConfig.markdownFlavor;

  const normalizedExperimental = toBoolean(experimentalEnabled, false);
  const normalizedFormat = normalizeExportFormat(exportFormatValue);
  const normalizedFlavor = normalizeMarkdownFlavor(markdownFlavorValue);

  return {
    ExperimentalExportEnabled: normalizedExperimental,
    ExportFormat: normalizedExperimental ? normalizedFormat : 'html',
    MarkdownFlavor: normalizedFlavor
  };
}

export function isHtmlExportEnabled(rawConfig = {}) {
  return normalizeExportConfig(rawConfig).ExportFormat === 'html';
}

function normalizeConvertedPageThemeConfig(rawConfig = {}) {
  const toggleEnabledValue = Object.prototype.hasOwnProperty.call(rawConfig, 'ConvertedPageThemeToggleEnabled')
    ? rawConfig.ConvertedPageThemeToggleEnabled
    : rawConfig.convertedPageThemeToggleEnabled;
  const oledBlackValue = Object.prototype.hasOwnProperty.call(rawConfig, 'ConvertedPageThemeToggleOledBlack')
    ? rawConfig.ConvertedPageThemeToggleOledBlack
    : rawConfig.convertedPageThemeToggleOledBlack;

  const convertedPageThemeToggleEnabled = toBoolean(toggleEnabledValue, false);
  const convertedPageThemeToggleOledBlack = convertedPageThemeToggleEnabled
    ? toBoolean(oledBlackValue, false)
    : false;

  return {
    ConvertedPageThemeToggleEnabled: convertedPageThemeToggleEnabled,
    ConvertedPageThemeToggleOledBlack: convertedPageThemeToggleOledBlack
  };
}

function normalizeToolbarConfig(rawConfig = {}) {
  const toolbarEnabled = toBoolean(rawConfig.ToolbarEnabled, false);
  return {
    ToolbarEnabled: toolbarEnabled,
    ToolbarEditToggleEnabled: toolbarEnabled ? true : toBoolean(rawConfig.ToolbarEditToggleEnabled, false),
    ToolbarMetadataToggleEnabled: toolbarEnabled ? true : toBoolean(rawConfig.ToolbarMetadataToggleEnabled, false),
    ToolbarBundleMode: normalizeToolbarBundleMode(rawConfig.ToolbarBundleMode)
  };
}

export function buildOutputDecorationConfig(rawConfig = {}) {
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  const normalizedExportConfig = normalizeExportConfig(rawConfig);
  const normalizedConvertedPageThemeConfig = normalizeConvertedPageThemeConfig(rawConfig);

  return {
    ...normalizedToolbarConfig,
    ...normalizedExportConfig,
    ConvertedPageThemeToggleEnabled: normalizedExportConfig.ExportFormat === 'html'
      ? normalizedConvertedPageThemeConfig.ConvertedPageThemeToggleEnabled
      : false,
    ConvertedPageThemeToggleOledBlack: normalizedExportConfig.ExportFormat === 'html'
      ? normalizedConvertedPageThemeConfig.ConvertedPageThemeToggleOledBlack
      : false
  };
}

const SINGLE_PROFILE = 'onenote';

const PROFILE_PRESETS = {
  [SINGLE_PROFILE]: {
    Profile: SINGLE_PROFILE,
    RepairListItemValues: 'smart',
    ListMarginLeft: '0.35em',
    ListPaddingLeft: '1.2em',
    NormalizeAllListIndent: true,
    UseTableSemantics: true,
    TableHeaderFallback: true,
    MergeCreatedDateTime: true,
    CreatedDateTimeGap: '0.75em',
    MigrateInlineStylesToUtilities: true,
    RemoveMigratedInlineDeclarations: false,
    InlineStyleMigrationSelector: '[style]',
    InlineStyleWarningEnabled: true,
    InlineStyleWarningMaxNodes: 250,
    InlineStyleWarningMaxChars: 24000,
    HandwritingDetectionEnabled: true,
    HandwritingRasterAltText: 'Handwritten notes (raster image)',
    InjectTailwindCss: true,
    TailwindCssHref: 'assets/tailwind-output.css',
    CollapseInlineStyles: false,
    OutputCleanupMode: 'off',
    UnitStrategy: 'normalize-safe',
    NormalizeDirectionLayout: true,
    NormalizeTopLevelPageWidths: true,
    ExternalizeCssEnabled: false,
    ExternalizeCssMode: 'shared',
    ExperimentalExportEnabled: false,
    ExportFormat: 'html',
    MarkdownFlavor: 'obsidian',
    ConvertedPageThemeToggleEnabled: false,
    ConvertedPageThemeToggleOledBlack: false
  }
};

function normalizeProfile(value) {
  const profile = String(value || '').trim().toLowerCase();
  if (!profile) return SINGLE_PROFILE;
  if (profile === 'generic' || profile === 'onenote' || profile === SINGLE_PROFILE) {
    return SINGLE_PROFILE;
  }
  return SINGLE_PROFILE;
}

export function normalizePipelineConfig(rawConfig = {}) {
  const useTableSemantics = Object.prototype.hasOwnProperty.call(rawConfig, 'UseTableSemantics')
    ? toBoolean(rawConfig.UseTableSemantics, true)
    : true;
  const tableHeaderFallback = Object.prototype.hasOwnProperty.call(rawConfig, 'TableHeaderFallback')
    ? toBoolean(rawConfig.TableHeaderFallback, true)
    : true;
  const profile = normalizeProfile(rawConfig.Profile || rawConfig.profile);
  const preset = PROFILE_PRESETS[SINGLE_PROFILE];
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  const normalizedExternalCssConfig = normalizeExternalCssConfig(rawConfig);
  const normalizedExportConfig = normalizeExportConfig(rawConfig);
  const normalizedConvertedPageThemeConfig = normalizeConvertedPageThemeConfig(rawConfig);
  const outputCleanupMode = normalizeOutputCleanupMode(rawConfig.OutputCleanupMode || rawConfig.outputCleanupMode || preset.OutputCleanupMode);
  const unitStrategy = normalizeUnitStrategy(rawConfig.UnitStrategy || rawConfig.unitStrategy || preset.UnitStrategy);
  const normalizeDirectionLayout = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeDirectionLayout')
      ? rawConfig.NormalizeDirectionLayout
      : rawConfig.normalizeDirectionLayout,
    preset.NormalizeDirectionLayout !== false
  );
  const normalizeTopLevelPageWidths = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeTopLevelPageWidths')
      ? rawConfig.NormalizeTopLevelPageWidths
      : rawConfig.normalizeTopLevelPageWidths,
    preset.NormalizeTopLevelPageWidths !== false
  );
  return {
    ...preset,
    ...rawConfig,
    ...normalizedToolbarConfig,
    ...normalizedExternalCssConfig,
    ...normalizedExportConfig,
    ...normalizedConvertedPageThemeConfig,
    Profile: SINGLE_PROFILE,
    UseTableSemantics: useTableSemantics,
    TableHeaderFallback: tableHeaderFallback,
    OutputCleanupMode: outputCleanupMode,
    UnitStrategy: unitStrategy,
    NormalizeDirectionLayout: normalizeDirectionLayout,
    NormalizeTopLevelPageWidths: normalizeTopLevelPageWidths
  };
}
