// @ts-check
import { normalizeMarkdownFlavor } from '../convert/markdownFlavors.js';

/**
 * @typedef {import('../contracts.js').ExportConfig} ExportConfig
 * @typedef {import('../contracts.js').ExportFormat} ExportFormat
 * @typedef {import('../contracts.js').ExportStylesMode} ExportStylesMode
 * @typedef {import('../contracts.js').ExternalizeCssMode} ExternalizeCssMode
 * @typedef {import('../contracts.js').MarkdownFlavor} MarkdownFlavor
 * @typedef {import('../contracts.js').NormalizedPipelineConfig} NormalizedPipelineConfig
 * @typedef {import('../contracts.js').OutputCleanupMode} OutputCleanupMode
 * @typedef {import('../contracts.js').OutputDecorationConfig} OutputDecorationConfig
 * @typedef {import('../contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {import('../contracts.js').ToolbarBundleMode} ToolbarBundleMode
 * @typedef {import('../contracts.js').ToolbarStyle} ToolbarStyle
 * @typedef {import('../contracts.js').UnitStrategy} UnitStrategy
 * @typedef {Pick<OutputDecorationConfig, 'ConvertedPageThemeToggleEnabled'>} ConvertedPageThemeConfig
 * @typedef {Pick<NormalizedPipelineConfig, 'ExternalizeCssEnabled' | 'ExternalizeCssMode'>} ExternalCssConfig
 * @typedef {Pick<OutputDecorationConfig, 'ToolbarEnabled' | 'ToolbarEditToggleEnabled' | 'ToolbarMetadataToggleEnabled' | 'ToolbarBundleMode' | 'ToolbarStyle'>} ToolbarConfig
 */

export const pipelineConfig = {
  version: '0.2.0'
};

/**
 * @param {unknown} value
 * @param {boolean} [defaultValue]
 * @returns {boolean}
 */
function toBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

/**
 * @param {unknown} value
 * @returns {ToolbarBundleMode}
 */
function normalizeToolbarBundleMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'inline' ? 'inline' : 'inline';
}

/**
 * @param {unknown} value
 * @returns {ToolbarStyle}
 */
function normalizeToolbarStyle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'classic' || normalized === 'office-97' || normalized === 'office') return 'office';
  if (normalized === 'ribbon') return 'ribbon';
  return 'compact';
}

/**
 * @param {unknown} value
 * @returns {OutputCleanupMode}
 */
function normalizeOutputCleanupMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'safe') return 'safe';
  return 'off';
}

/**
 * @param {unknown} value
 * @returns {UnitStrategy}
 */
function normalizeUnitStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'normalize-safe') return 'normalize-safe';
  return 'preserve';
}

/**
 * @param {unknown} value
 * @returns {ExternalizeCssMode}
 */
function normalizeExternalizeCssMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'per-page' ? 'per-page' : 'shared';
}

/**
 * @param {unknown} value
 * @returns {ExportStylesMode}
 */
function normalizeExportStylesMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'deferred' ? 'deferred' : 'tailwind';
}

/** @type {import('../contracts.js').PipelineProfile} */
const DEFAULT_PROFILE = 'onenote';

/** @satisfies {PipelineConfigInput} */
const DEFAULT_PIPELINE_CONFIG = {
  Profile: DEFAULT_PROFILE,
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
  ExportStylesMode: 'tailwind',
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
  ToolbarStyle: 'compact'
};

const SUPPORTED_EXPORT_FORMATS = new Set(['html', 'markdown']);

/**
 * @param {unknown} value
 * @returns {ExportFormat}
 */
export function normalizeExportFormat(value) {
  const normalized = String(value || '').trim().toLowerCase();
  // Stable-release contract: only HTML and Markdown are live export formats.
  // Unsupported or deferred formats such as .docx intentionally collapse to HTML
  // here so downstream code can stay binary until post-release work begins.
  if (SUPPORTED_EXPORT_FORMATS.has(normalized)) return /** @type {ExportFormat} */ (normalized);
  return 'html';
}

export { normalizeMarkdownFlavor };

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {ExternalCssConfig}
 */
function normalizeExternalCssConfig(rawConfig = {}) {
  return {
    ExternalizeCssEnabled: toBoolean(rawConfig.ExternalizeCssEnabled, false),
    ExternalizeCssMode: normalizeExternalizeCssMode(rawConfig.ExternalizeCssMode)
  };
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {ExportConfig}
 */
export function normalizeExportConfig(rawConfig = {}) {
  const normalizedExperimental = toBoolean(rawConfig.ExperimentalExportEnabled, false);
  const normalizedFormat = normalizeExportFormat(rawConfig.ExportFormat);
  const normalizedFlavor = /** @type {MarkdownFlavor} */ (normalizeMarkdownFlavor(rawConfig.MarkdownFlavor));

  return {
    ExperimentalExportEnabled: normalizedExperimental,
    ExportFormat: normalizedExperimental ? normalizedFormat : 'html',
    MarkdownFlavor: normalizedFlavor
  };
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {boolean}
 */
export function isHtmlExportEnabled(rawConfig = {}) {
  return normalizeExportConfig(rawConfig).ExportFormat === 'html';
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {ConvertedPageThemeConfig}
 */
function normalizeConvertedPageThemeConfig(rawConfig = {}) {
  return {
    ConvertedPageThemeToggleEnabled: toBoolean(rawConfig.ConvertedPageThemeToggleEnabled, false)
  };
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {ToolbarConfig}
 */
function normalizeToolbarConfig(rawConfig = {}) {
  const toolbarEnabled = toBoolean(rawConfig.ToolbarEnabled, false);
  return {
    ToolbarEnabled: toolbarEnabled,
    ToolbarEditToggleEnabled: toolbarEnabled ? true : toBoolean(rawConfig.ToolbarEditToggleEnabled, false),
    ToolbarMetadataToggleEnabled: toolbarEnabled ? true : toBoolean(rawConfig.ToolbarMetadataToggleEnabled, false),
    ToolbarBundleMode: normalizeToolbarBundleMode(rawConfig.ToolbarBundleMode),
    ToolbarStyle: normalizeToolbarStyle(rawConfig.ToolbarStyle)
  };
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {OutputDecorationConfig}
 */
export function buildOutputDecorationConfig(rawConfig = {}) {
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  const normalizedExportConfig = normalizeExportConfig(rawConfig);
  const normalizedConvertedPageThemeConfig = normalizeConvertedPageThemeConfig(rawConfig);
  const htmlExport = normalizedExportConfig.ExportFormat === 'html';

  return {
    ...normalizedToolbarConfig,
    ...normalizedExportConfig,
    ToolbarEnabled: htmlExport ? normalizedToolbarConfig.ToolbarEnabled : false,
    ToolbarEditToggleEnabled: htmlExport ? normalizedToolbarConfig.ToolbarEditToggleEnabled : false,
    ToolbarMetadataToggleEnabled: htmlExport ? normalizedToolbarConfig.ToolbarMetadataToggleEnabled : false,
    ConvertedPageThemeToggleEnabled: htmlExport
      ? normalizedConvertedPageThemeConfig.ConvertedPageThemeToggleEnabled
      : false
  };
}

/**
 * @param {PipelineConfigInput} [rawConfig]
 * @returns {NormalizedPipelineConfig}
 */
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
  const defaultNormalizeDirectionLayout = toBoolean(DEFAULT_PIPELINE_CONFIG.NormalizeDirectionLayout, true);
  const normalizeDirectionLayout = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeDirectionLayout')
      ? rawConfig.NormalizeDirectionLayout
      : DEFAULT_PIPELINE_CONFIG.NormalizeDirectionLayout,
    defaultNormalizeDirectionLayout
  );
  const defaultNormalizeTopLevelPageWidths = toBoolean(DEFAULT_PIPELINE_CONFIG.NormalizeTopLevelPageWidths, true);
  const normalizeTopLevelPageWidths = toBoolean(
    Object.prototype.hasOwnProperty.call(rawConfig, 'NormalizeTopLevelPageWidths')
      ? rawConfig.NormalizeTopLevelPageWidths
      : DEFAULT_PIPELINE_CONFIG.NormalizeTopLevelPageWidths,
    defaultNormalizeTopLevelPageWidths
  );
  return {
    ...DEFAULT_PIPELINE_CONFIG,
    ...rawConfig,
    ...normalizedToolbarConfig,
    ...normalizedExternalCssConfig,
    ...normalizedExportConfig,
    ...normalizedConvertedPageThemeConfig,
    Profile: DEFAULT_PROFILE,
    UseTableSemantics: useTableSemantics,
    TableHeaderFallback: tableHeaderFallback,
    ExportStylesMode: normalizeExportStylesMode(rawConfig.ExportStylesMode || DEFAULT_PIPELINE_CONFIG.ExportStylesMode),
    OutputCleanupMode: outputCleanupMode,
    UnitStrategy: unitStrategy,
    NormalizeDirectionLayout: normalizeDirectionLayout,
    NormalizeTopLevelPageWidths: normalizeTopLevelPageWidths
  };
}
