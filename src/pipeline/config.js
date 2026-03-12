import { normalizeMarkdownFlavor } from '../convert/markdownFlavors.js';

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

const DEFAULT_PIPELINE_CONFIG = {
  Profile: 'onenote',
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
};

const SUPPORTED_EXPORT_FORMATS = new Set(['html', 'markdown']);

export function normalizeExportFormat(value) {
  const normalized = String(value || '').trim().toLowerCase();
  // Stable-release contract: only HTML and Markdown are live export formats.
  // Unsupported or deferred formats such as .docx intentionally collapse to HTML
  // here so downstream code can stay binary until post-release work begins.
  if (SUPPORTED_EXPORT_FORMATS.has(normalized)) return normalized;
  return 'html';
}

export { normalizeMarkdownFlavor };

function normalizeExternalCssConfig(rawConfig = {}) {
  return {
    ExternalizeCssEnabled: toBoolean(rawConfig.ExternalizeCssEnabled, false),
    ExternalizeCssMode: normalizeExternalizeCssMode(rawConfig.ExternalizeCssMode)
  };
}

export function normalizeExportConfig(rawConfig = {}) {
  const normalizedExperimental = toBoolean(rawConfig.ExperimentalExportEnabled, false);
  const normalizedFormat = normalizeExportFormat(rawConfig.ExportFormat);
  const normalizedFlavor = normalizeMarkdownFlavor(rawConfig.MarkdownFlavor);

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
  const convertedPageThemeToggleEnabled = toBoolean(rawConfig.ConvertedPageThemeToggleEnabled, false);
  const convertedPageThemeToggleOledBlack = convertedPageThemeToggleEnabled
    ? toBoolean(rawConfig.ConvertedPageThemeToggleOledBlack, false)
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

export function normalizePipelineConfig(rawConfig = {}) {
  const useTableSemantics = Object.prototype.hasOwnProperty.call(rawConfig, 'UseTableSemantics')
    ? toBoolean(rawConfig.UseTableSemantics, true)
    : true;
  const tableHeaderFallback = Object.prototype.hasOwnProperty.call(rawConfig, 'TableHeaderFallback')
    ? toBoolean(rawConfig.TableHeaderFallback, true)
    : true;
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  const normalizedExternalCssConfig = normalizeExternalCssConfig(rawConfig);
  const normalizedExportConfig = normalizeExportConfig(rawConfig);
  const normalizedConvertedPageThemeConfig = normalizeConvertedPageThemeConfig(rawConfig);
  const outputCleanupMode = normalizeOutputCleanupMode(rawConfig.OutputCleanupMode || DEFAULT_PIPELINE_CONFIG.OutputCleanupMode);
  const unitStrategy = normalizeUnitStrategy(rawConfig.UnitStrategy || DEFAULT_PIPELINE_CONFIG.UnitStrategy);
  const normalizeDirectionLayout = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeDirectionLayout')
      ? rawConfig.NormalizeDirectionLayout
      : DEFAULT_PIPELINE_CONFIG.NormalizeDirectionLayout,
    DEFAULT_PIPELINE_CONFIG.NormalizeDirectionLayout !== false
  );
  const normalizeTopLevelPageWidths = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeTopLevelPageWidths')
      ? rawConfig.NormalizeTopLevelPageWidths
      : DEFAULT_PIPELINE_CONFIG.NormalizeTopLevelPageWidths,
    DEFAULT_PIPELINE_CONFIG.NormalizeTopLevelPageWidths !== false
  );
  return {
    ...DEFAULT_PIPELINE_CONFIG,
    ...rawConfig,
    ...normalizedToolbarConfig,
    ...normalizedExternalCssConfig,
    ...normalizedExportConfig,
    ...normalizedConvertedPageThemeConfig,
    Profile: DEFAULT_PIPELINE_CONFIG.Profile,
    UseTableSemantics: useTableSemantics,
    TableHeaderFallback: tableHeaderFallback,
    OutputCleanupMode: outputCleanupMode,
    UnitStrategy: unitStrategy,
    NormalizeDirectionLayout: normalizeDirectionLayout,
    NormalizeTopLevelPageWidths: normalizeTopLevelPageWidths
  };
}
