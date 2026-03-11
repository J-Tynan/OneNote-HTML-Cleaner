import { buildOutputDecorationConfig } from './pipeline/config.js';

const BASE_CONVERSION_CONFIG = {
  Profile: 'onenote',
  OutputCleanupMode: 'safe',
  UnitStrategy: 'normalize-safe',
  TailwindCssHref: 'assets/tailwind-output.css'
};

function isChecked(control) {
  return Boolean(control && control.checked);
}

function getValue(control, fallback) {
  return control ? String(control.value || fallback) : fallback;
}

export function readAdvancedOptions(dom = {}) {
  return {
    ToolbarEnabled: isChecked(dom.toolbarEnabled),
    ToolbarEditToggleEnabled: isChecked(dom.toolbarEnabled),
    ToolbarMetadataToggleEnabled: isChecked(dom.toolbarEnabled),
    ExternalizeCssEnabled: isChecked(dom.externalizeCssEnabled),
    ExternalizeCssMode: getValue(dom.externalizeCssMode, 'shared'),
    ExperimentalExportEnabled: isChecked(dom.experimentalExportEnabled),
    ExportFormat: getValue(dom.exportFormat, 'html'),
    MarkdownFlavor: getValue(dom.markdownFlavor, 'obsidian'),
    ConvertedPageThemeToggleEnabled: isChecked(dom.convertedPageThemeToggleEnabled),
    ConvertedPageThemeToggleOledBlack: isChecked(dom.convertedPageThemeToggleOledBlack)
  };
}

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
    markdownSelected: experimentalEnabled && selectedExportFormat === 'markdown',
    htmlSelected: effectiveExportFormat === 'html',
    convertedPageThemeToggleChecked: rawConfig.ConvertedPageThemeToggleEnabled === true
  };
}

export function buildUiConversionConfig(dom = {}) {
  const { rawConfig, outputDecorationConfig } = buildAdvancedOptionsState(dom);

  return {
    ...BASE_CONVERSION_CONFIG,
    ToolbarEnabled: outputDecorationConfig.ToolbarEnabled,
    ToolbarEditToggleEnabled: outputDecorationConfig.ToolbarEditToggleEnabled,
    ToolbarMetadataToggleEnabled: outputDecorationConfig.ToolbarMetadataToggleEnabled,
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