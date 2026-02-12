export const pipelineConfig = {
  version: '0.2.0'
};

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
  return {
    ...preset,
    ...rawConfig,
    Profile: profile
  };
}
