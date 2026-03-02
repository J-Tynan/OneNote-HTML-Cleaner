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

function normalizeToolbarConfig(rawConfig = {}) {
  return {
    ToolbarEnabled: toBoolean(rawConfig.ToolbarEnabled, false),
    ToolbarEditToggleEnabled: toBoolean(rawConfig.ToolbarEditToggleEnabled, false),
    ToolbarMetadataToggleEnabled: toBoolean(rawConfig.ToolbarMetadataToggleEnabled, false),
    ToolbarBundleMode: normalizeToolbarBundleMode(rawConfig.ToolbarBundleMode)
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
    UseCornellSemantics: true,
    CornellHeaderFallback: true,
    MergeCreatedDateTime: true,
    CreatedDateTimeGap: '0.75em',
    MigrateInlineStylesToUtilities: true,
    RemoveMigratedInlineDeclarations: false,
    InlineStyleMigrationSelector: '[style]',
    InlineStyleWarningEnabled: true,
    InlineStyleWarningMaxNodes: 250,
    InlineStyleWarningMaxChars: 24000,
    InjectTailwindCss: true,
    TailwindCssHref: 'assets/tailwind-output.css',
    CollapseInlineStyles: false,
    OutputCleanupMode: 'off',
    UnitStrategy: 'normalize-safe',
    NormalizeDirectionLayout: true,
    NormalizeTopLevelPageWidths: true,
    ExternalizeCssEnabled: false,
    ExternalizeCssMode: 'shared'
  }
};

function normalizeProfile(value) {
  const profile = String(value || '').trim().toLowerCase();
  if (!profile) return SINGLE_PROFILE;
  if (profile === 'cornell' || profile === 'generic' || profile === SINGLE_PROFILE) {
    return SINGLE_PROFILE;
  }
  return SINGLE_PROFILE;
}

export function normalizePipelineConfig(rawConfig = {}) {
  const profile = normalizeProfile(rawConfig.Profile || rawConfig.profile);
  const preset = PROFILE_PRESETS[SINGLE_PROFILE];
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  const normalizedExternalCssConfig = normalizeExternalCssConfig(rawConfig);
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
    Profile: SINGLE_PROFILE,
    OutputCleanupMode: outputCleanupMode,
    UnitStrategy: unitStrategy,
    NormalizeDirectionLayout: normalizeDirectionLayout,
    NormalizeTopLevelPageWidths: normalizeTopLevelPageWidths
  };
}
