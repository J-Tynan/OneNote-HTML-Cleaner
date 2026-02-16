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

function normalizeToolbarConfig(rawConfig = {}) {
  return {
    ToolbarEnabled: toBoolean(rawConfig.ToolbarEnabled, false),
    ToolbarEditToggleEnabled: toBoolean(rawConfig.ToolbarEditToggleEnabled, false),
    ToolbarMetadataToggleEnabled: toBoolean(rawConfig.ToolbarMetadataToggleEnabled, false),
    ToolbarBundleMode: normalizeToolbarBundleMode(rawConfig.ToolbarBundleMode)
  };
}

const PROFILE_PRESETS = {
  cornell: {
    Profile: 'cornell',
    RepairListItemValues: 'smart',
    ListPaddingLeft: '1.2em',
    NormalizeAllListIndent: true,
    UseCornellSemantics: true,
    CornellHeaderFallback: true,
    MergeCreatedDateTime: true,
    CreatedDateTimeGap: '0.75em',
    MigrateInlineStylesToUtilities: true,
    RemoveMigratedInlineDeclarations: false,
    InlineStyleMigrationSelector: '[style]',
    InjectTailwindCss: true,
    TailwindCssHref: 'assets/tailwind-output.css'
  },
  generic: {
    Profile: 'generic',
    RepairListItemValues: 'smart',
    ListPaddingLeft: '1.2em',
    NormalizeAllListIndent: true,
    UseCornellSemantics: false,
    CornellHeaderFallback: false,
    MergeCreatedDateTime: true,
    CreatedDateTimeGap: '0.75em',
    MigrateInlineStylesToUtilities: false,
    RemoveMigratedInlineDeclarations: false,
    InlineStyleMigrationSelector: '[style]',
    InjectTailwindCss: false,
    TailwindCssHref: 'assets/tailwind-output.css'
  }
};

function normalizeProfile(value) {
  const profile = String(value || '').trim().toLowerCase();
  return profile === 'generic' ? 'generic' : 'cornell';
}

export function normalizePipelineConfig(rawConfig = {}) {
  const profile = normalizeProfile(rawConfig.Profile || rawConfig.profile);
  const preset = PROFILE_PRESETS[profile];
  const normalizedToolbarConfig = normalizeToolbarConfig(rawConfig);
  return {
    ...preset,
    ...rawConfig,
    ...normalizedToolbarConfig,
    Profile: profile
  };
}
