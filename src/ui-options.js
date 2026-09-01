// @ts-check
import { buildOutputDecorationConfig } from './pipeline/config.js';

/**
 * @typedef {import('./contracts.js').ExportFormat} ExportFormat
 * @typedef {import('./contracts.js').OutputDecorationConfig} OutputDecorationConfig
 * @typedef {import('./contracts.js').PipelineConfigInput} PipelineConfigInput
 * @typedef {Pick<HTMLInputElement, 'checked'>} CheckableControl
 * @typedef {Pick<HTMLInputElement | HTMLSelectElement, 'value'>} ValueControl
 * @typedef {{ toolbarEnabled?: CheckableControl | null, toolbarStyle?: ValueControl | null, externalizeCssEnabled?: CheckableControl | null, externalizeCssMode?: ValueControl | null, experimentalExportEnabled?: CheckableControl | null, exportFormat?: ValueControl | null, markdownFlavor?: ValueControl | null, convertedPageThemeToggleEnabled?: CheckableControl | null, convertedPageThemeToggleOledBlack?: CheckableControl | null }} AdvancedOptionsControls
 * @typedef {PipelineConfigInput & { ToolbarEnabled: boolean, ToolbarEditToggleEnabled: boolean, ToolbarMetadataToggleEnabled: boolean, ToolbarStyle: string, ExternalizeCssEnabled: boolean, ExternalizeCssMode: string, ExperimentalExportEnabled: boolean, ExportFormat: string, MarkdownFlavor: string, ConvertedPageThemeToggleEnabled: boolean, ConvertedPageThemeToggleOledBlack: boolean }} AdvancedOptionsRawConfig
 * @typedef {{ rawConfig: AdvancedOptionsRawConfig, outputDecorationConfig: OutputDecorationConfig, experimentalEnabled: boolean, selectedExportFormat: string, effectiveExportFormat: ExportFormat, toolbarEnabledChecked: boolean, markdownSelected: boolean, htmlSelected: boolean, convertedPageThemeToggleChecked: boolean }} AdvancedOptionsState
 */

/** @satisfies {PipelineConfigInput} */
const BASE_CONVERSION_CONFIG = {
  Profile: 'onenote',
  OutputCleanupMode: 'safe',
  UnitStrategy: 'normalize-safe',
  ExportStylesMode: 'deferred',
  TailwindCssHref: 'assets/tailwind-output.css'
};

/**
 * @param {CheckableControl | null | undefined} control
 * @returns {boolean}
 */
function isChecked(control) {
  return Boolean(control && control.checked);
}

/**
 * @param {ValueControl | null | undefined} control
 * @param {string} fallback
 * @returns {string}
 */
function getValue(control, fallback) {
  return control ? String(control.value || fallback) : fallback;
}

/**
 * @param {AdvancedOptionsControls} [dom]
 * @returns {AdvancedOptionsRawConfig}
 */
export function readAdvancedOptions(dom = {}) {
  return {
    ToolbarEnabled: isChecked(dom.toolbarEnabled),
    ToolbarEditToggleEnabled: isChecked(dom.toolbarEnabled),
    ToolbarMetadataToggleEnabled: isChecked(dom.toolbarEnabled),
    ToolbarStyle: getValue(dom.toolbarStyle, 'compact'),
    ExternalizeCssEnabled: isChecked(dom.externalizeCssEnabled),
    ExternalizeCssMode: getValue(dom.externalizeCssMode, 'shared'),
    ExperimentalExportEnabled: isChecked(dom.experimentalExportEnabled),
    ExportFormat: getValue(dom.exportFormat, 'html'),
    MarkdownFlavor: getValue(dom.markdownFlavor, 'obsidian'),
    ConvertedPageThemeToggleEnabled: isChecked(dom.convertedPageThemeToggleEnabled),
    ConvertedPageThemeToggleOledBlack: isChecked(dom.convertedPageThemeToggleOledBlack)
  };
}

/**
 * @param {AdvancedOptionsControls} [dom]
 * @returns {AdvancedOptionsState}
 */
export function buildAdvancedOptionsState(dom = {}) {
  const rawConfig = readAdvancedOptions(dom);
  const outputDecorationConfig = buildOutputDecorationConfig(rawConfig);
  const selectedExportFormat = String(rawConfig.ExportFormat || 'html').trim().toLowerCase() || 'html';
  const experimentalEnabled = rawConfig.ExperimentalExportEnabled === true;
  const effectiveExportFormat = outputDecorationConfig.ExportFormat;

  return {
    rawConfig,
    outputDecorationConfig,
    experimentalEnabled,
    selectedExportFormat,
    effectiveExportFormat,
    toolbarEnabledChecked: rawConfig.ToolbarEnabled === true,
    markdownSelected: experimentalEnabled && selectedExportFormat === 'markdown',
    htmlSelected: effectiveExportFormat === 'html',
    convertedPageThemeToggleChecked: rawConfig.ConvertedPageThemeToggleEnabled === true
  };
}

/**
 * @param {AdvancedOptionsControls} [dom]
 * @returns {PipelineConfigInput}
 */
export function buildUiConversionConfig(dom = {}) {
  const { rawConfig, outputDecorationConfig } = buildAdvancedOptionsState(dom);

  return {
    ...BASE_CONVERSION_CONFIG,
    ToolbarEnabled: outputDecorationConfig.ToolbarEnabled,
    ToolbarEditToggleEnabled: outputDecorationConfig.ToolbarEditToggleEnabled,
    ToolbarMetadataToggleEnabled: outputDecorationConfig.ToolbarMetadataToggleEnabled,
    ToolbarStyle: outputDecorationConfig.ToolbarStyle,
    ExternalizeCssEnabled: rawConfig.ExternalizeCssEnabled,
    ExternalizeCssMode: rawConfig.ExternalizeCssMode,
    ExperimentalExportEnabled: outputDecorationConfig.ExperimentalExportEnabled,
    ExportFormat: outputDecorationConfig.ExportFormat,
    MarkdownFlavor: outputDecorationConfig.MarkdownFlavor,
    ConvertedPageThemeToggleEnabled: outputDecorationConfig.ConvertedPageThemeToggleEnabled,
    ConvertedPageThemeToggleOledBlack: outputDecorationConfig.ConvertedPageThemeToggleOledBlack,
    ToolbarBundleMode: outputDecorationConfig.ToolbarBundleMode
  };
}