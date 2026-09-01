export type SourceKind = 'html' | 'mht' | 'one' | 'onepkg' | 'unknown';
export type ActiveSourceKind = 'html' | 'mht';
export type NativeSourceKind = 'one' | 'onepkg';

export type PipelineProfile = 'onenote';
export type ListRepairMode = 'smart' | 'mergeStyled' | 'renumber';
export type ToolbarBundleMode = 'inline';
export type ToolbarStyle = 'compact' | 'office' | 'ribbon';
export type ExportStylesMode = 'tailwind' | 'deferred';
export type OutputCleanupMode = 'off' | 'safe';
export type UnitStrategy = 'preserve' | 'normalize-safe';
export type ExternalizeCssMode = 'shared' | 'per-page';
export type ExportFormat = 'html' | 'markdown';
export type MarkdownFlavor = 'obsidian' | 'commonmark' | 'gfm' | 'markdown-extra';
export type BooleanConfigValue = boolean | string;

export type LogLevel = 'debug' | 'info' | 'warn' | 'warning' | 'error';

export interface LoggerPayload {
  id?: string;
  type?: string;
  msg?: string;
  meta?: unknown;
  preview?: string;
}

export interface PipelineLogEntry {
  step: string;
  level?: LogLevel;
  details?: string;
  meta?: unknown;
}

export type ImageMap = Record<string, string>;

export interface PipelineConfigInput {
  [key: string]: unknown;
  Profile?: PipelineProfile | string;
  RepairListItemValues?: ListRepairMode | string;
  ListMarginLeft?: string;
  ListPaddingLeft?: string;
  NormalizeAllListIndent?: BooleanConfigValue;
  UseTableSemantics?: BooleanConfigValue;
  TableHeaderFallback?: BooleanConfigValue;
  MergeCreatedDateTime?: BooleanConfigValue;
  CreatedDateTimeGap?: string;
  MigrateInlineStylesToUtilities?: BooleanConfigValue;
  RemoveMigratedInlineDeclarations?: BooleanConfigValue;
  InlineStyleMigrationSelector?: string;
  InlineStyleWarningEnabled?: BooleanConfigValue;
  InlineStyleWarningMaxNodes?: number;
  InlineStyleWarningMaxChars?: number;
  HandwritingDetectionEnabled?: BooleanConfigValue;
  HandwritingRasterAltText?: string;
  InjectTailwindCss?: BooleanConfigValue;
  TailwindCssHref?: string;
  ExportStylesMode?: ExportStylesMode | string;
  CollapseInlineStyles?: BooleanConfigValue;
  CollapseInlineStylesMinCount?: number;
  OutputCleanupMode?: OutputCleanupMode | string;
  UnitStrategy?: UnitStrategy | string;
  NormalizeDirectionLayout?: BooleanConfigValue;
  NormalizeTopLevelPageWidths?: BooleanConfigValue;
  NormalizeTables?: BooleanConfigValue;
  ExternalizeCssEnabled?: BooleanConfigValue;
  ExternalizeCssMode?: ExternalizeCssMode | string;
  ExperimentalExportEnabled?: BooleanConfigValue;
  ExportFormat?: ExportFormat | string;
  MarkdownFlavor?: MarkdownFlavor | string;
  ConvertedPageThemeToggleEnabled?: BooleanConfigValue;
  ConvertedPageThemeToggleOledBlack?: BooleanConfigValue;
  ToolbarEnabled?: BooleanConfigValue;
  ToolbarEditToggleEnabled?: BooleanConfigValue;
  ToolbarMetadataToggleEnabled?: BooleanConfigValue;
  ToolbarBundleMode?: ToolbarBundleMode | string;
  ToolbarStyle?: ToolbarStyle | string;
  imageMap?: ImageMap;
  ParseWarnings?: PipelineLogEntry[];
  SourceName?: string;
  SourceKind?: SourceKind;
  defaultLang?: string;
  defaultTitle?: string;
  fileName?: string;
  sourceKind?: SourceKind;
}

export interface ExportConfig {
  ExperimentalExportEnabled: boolean;
  ExportFormat: ExportFormat;
  MarkdownFlavor: MarkdownFlavor;
}

export interface OutputDecorationConfig extends ExportConfig {
  ToolbarEnabled: boolean;
  ToolbarEditToggleEnabled: boolean;
  ToolbarMetadataToggleEnabled: boolean;
  ToolbarBundleMode: ToolbarBundleMode;
  ToolbarStyle: ToolbarStyle;
  ConvertedPageThemeToggleEnabled: boolean;
  ConvertedPageThemeToggleOledBlack: boolean;
}

type NormalizedPipelineConfigBase = Omit<PipelineConfigInput, keyof OutputDecorationConfig>;

export interface NormalizedPipelineConfig extends NormalizedPipelineConfigBase, OutputDecorationConfig {
  Profile: PipelineProfile;
  RepairListItemValues: ListRepairMode | string;
  ListMarginLeft: string;
  ListPaddingLeft: string;
  NormalizeAllListIndent: BooleanConfigValue;
  UseTableSemantics: boolean;
  TableHeaderFallback: boolean;
  MergeCreatedDateTime: BooleanConfigValue;
  CreatedDateTimeGap: string;
  MigrateInlineStylesToUtilities: BooleanConfigValue;
  RemoveMigratedInlineDeclarations: BooleanConfigValue;
  InlineStyleMigrationSelector: string;
  InlineStyleWarningEnabled: BooleanConfigValue;
  InlineStyleWarningMaxNodes: number;
  InlineStyleWarningMaxChars: number;
  HandwritingDetectionEnabled: BooleanConfigValue;
  HandwritingRasterAltText: string;
  InjectTailwindCss: BooleanConfigValue;
  TailwindCssHref: string;
  ExportStylesMode: ExportStylesMode;
  CollapseInlineStyles: BooleanConfigValue;
  OutputCleanupMode: OutputCleanupMode;
  UnitStrategy: UnitStrategy;
  NormalizeDirectionLayout: boolean;
  NormalizeTopLevelPageWidths: boolean;
  ExternalizeCssEnabled: boolean;
  ExternalizeCssMode: ExternalizeCssMode;
}

export interface OutputAsset {
  type: string;
  role?: string;
  mode?: string;
  filename?: string;
  path?: string;
  content?: string;
  bytes?: Uint8Array | ArrayBuffer;
}

export interface PipelineResult {
  output: string;
  logs: PipelineLogEntry[];
  assets?: OutputAsset[];
}

export interface WorkerInitRequest {
  type: 'init';
  options?: Record<string, unknown>;
}

export interface WorkerReadyMessage {
  type: 'ready';
  id: string;
  timestamp: number;
  hasDOMParser: boolean;
}

export interface ProcessFileRequest {
  id: string;
  type?: 'process-file';
  fileName: string;
  relativePath?: string;
  mimetype?: string;
  sourceKind?: ActiveSourceKind | 'unknown';
  html: string;
  config?: PipelineConfigInput;
}

export interface ProcessNativeFileRequest {
  id: string;
  type: 'process-native-file';
  fileName: string;
  relativePath?: string;
  mimetype?: string;
  sourceKind: NativeSourceKind;
  bytes: ArrayBuffer;
  config?: PipelineConfigInput;
}

export type WorkerJobRequest = ProcessFileRequest | ProcessNativeFileRequest;

export interface WorkerRuntimePayload {
  [key: string]: unknown;
  id?: string;
  type?: string;
  fileName?: string;
  relativePath?: string;
  mimetype?: string;
  sourceKind?: SourceKind;
  html?: string;
  bytes?: ArrayBuffer;
  config?: PipelineConfigInput;
  debug?: {
    mhtCharsetLogging?: boolean;
    [key: string]: unknown;
  };
}

export interface WorkerQueuedPayload extends WorkerRuntimePayload {
  id: string;
}

export interface WorkerProgressMessage {
  id: string;
  status: 'progress';
  step: string;
  percent: number;
}

export interface WorkerDoneBase {
  id: string;
  status: 'done';
  relativePath?: string;
  logs: PipelineLogEntry[];
  originalId?: string | null;
}

export interface WorkerHtmlDoneResponse extends WorkerDoneBase {
  outputHtml: string;
  outputFormat: 'html';
  outputAssets: OutputAsset[];
}

export interface WorkerMarkdownDoneResponse extends WorkerDoneBase {
  outputText: string;
  outputFormat: 'markdown';
  outputAssets: OutputAsset[];
}

export interface WorkerNativeDoneResponse extends WorkerDoneBase {
  resultType: 'native';
  nativeResult: NativeImportResult;
}

export interface WorkerErrorResponse {
  id: string;
  status: 'error';
  error: string;
  originalId?: string | null;
}

export type UnsupportedCode = 'native-disabled' | 'worker-dom-unavailable';

export interface WorkerUnsupportedResponse {
  id: string;
  status: 'unsupported';
  code?: UnsupportedCode | string;
  reason?: string;
  originalId?: string | null;
}

export interface WorkerDiagnosticMessage {
  id?: string;
  type: '__diag__' | 'handshake-timeout' | string;
  status?: 'info' | 'warn' | 'warning' | 'error' | string;
  level?: LogLevel | string;
  phase?: string;
  msg?: string;
  message?: string;
  error?: string;
  meta?: unknown;
  details?: unknown;
  timestamp?: number;
  source?: 'worker' | 'wrapper' | string;
  workerUrl?: string | null;
  workerHash?: string | null;
}

export type WorkerResponse =
  | WorkerReadyMessage
  | WorkerProgressMessage
  | WorkerHtmlDoneResponse
  | WorkerMarkdownDoneResponse
  | WorkerNativeDoneResponse
  | WorkerErrorResponse
  | WorkerUnsupportedResponse
  | WorkerDiagnosticMessage;

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface WarningDetail {
  code: string;
  severity: WarningSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export interface NativeResource {
  kind?: string;
  extension?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  bytes?: Uint8Array | ArrayBuffer;
  dataUri?: string | null;
  path?: string;
  relativePath?: string;
}

export interface NativePageMetadata {
  title?: string;
  author?: string;
  createdAt?: string;
  modifiedAt?: string;
  notebook?: string;
  sectionPath?: string;
  source?: string;
}

export interface NativePage {
  name: string;
  path: string;
  html: string;
  metadata?: NativePageMetadata | Record<string, unknown>;
  resources?: NativeResource[];
}

export type NativeHierarchyKind = 'section' | 'notebook' | 'folder' | 'entry' | 'section-group' | 'page';

export interface NativeHierarchyNode {
  kind: NativeHierarchyKind;
  name: string;
  path: string;
  children?: NativeHierarchyNode[];
}

export interface NativeImportResult {
  sourceKind: NativeSourceKind;
  hierarchy: NativeHierarchyNode;
  pages: NativePage[];
  warningDetails?: WarningDetail[];
  warnings: string[];
}