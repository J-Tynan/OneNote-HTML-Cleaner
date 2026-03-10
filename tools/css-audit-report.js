import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';

if (typeof global.DOMParser === 'undefined' && typeof DOMParser === 'undefined') {
  const dom = new JSDOM('');
  global.DOMParser = dom.window.DOMParser;
  global.NodeFilter = dom.window.NodeFilter;
}

const { parseMht } = await import('../src/pipeline/mht.js');
const { runPipeline } = await import('../src/pipeline/pipeline.js');
const { setEnabled } = await import('../src/logging.js');
setEnabled(false);

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, 'Tests');
const LOCKED_MANIFEST_PATH = path.join(TESTS_DIR, 'expected', 'locked-cleaned', 'manifest.json');
const REPORTS_DIR = path.join(TESTS_DIR, 'reports');
const REPORT_MD_PATH = path.join(REPORTS_DIR, 'css-audit-report.md');
const REPORT_JSON_PATH = path.join(REPORTS_DIR, 'css-audit-report.json');

const MODES = ['shared', 'per-page'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function collapseSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalDeclarationBlock(text) {
  const entries = String(text || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = collapseSpaces(part.slice(idx + 1));
      if (!prop) return null;
      return { prop, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.prop.localeCompare(b.prop));

  if (!entries.length) return '';
  return entries.map(({ prop, value }) => `${prop}:${value}`).join(';');
}

function consolidateCssRulesForBundle(cssText) {
  const rules = [];
  const seen = new Set();
  const css = String(cssText || '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = re.exec(css)) !== null) {
    const selector = collapseSpaces(match[1]);
    const declaration = canonicalDeclarationBlock(match[2]);
    if (!selector || !declaration) continue;
    const key = `${selector}\u0000${declaration}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(`${selector} { ${declaration.replace(/;/g, '; ').replace(/:\s*/g, ': ').trim()} }`);
  }

  if (!rules.length) return css.trim();
  return rules.join('\n\n');
}

function parseCssRules(cssText) {
  const rules = [];
  const css = String(cssText || '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    const selectorText = collapseSpaces(match[1]);
    const declarationText = collapseSpaces(match[2]);
    if (!selectorText) continue;
    const selectors = selectorText.split(',').map((part) => part.trim()).filter(Boolean);
    const declarationSignature = canonicalDeclarationBlock(declarationText);
    rules.push({
      selectorText,
      selectors,
      declarationText,
      declarationSignature
    });
  }
  return rules;
}

function countMapToSortedArray(map, minCount = 1, limit = 12) {
  return Array.from(map.entries())
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function summarizeCss(cssText) {
  const rules = parseCssRules(cssText);
  const selectorCounts = new Map();
  const declarationCounts = new Map();

  rules.forEach((rule) => {
    if (rule.declarationSignature) {
      declarationCounts.set(
        rule.declarationSignature,
        (declarationCounts.get(rule.declarationSignature) || 0) + 1
      );
    }

    rule.selectors.forEach((selector) => {
      selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
    });
  });

  const uniqueSelectors = Array.from(selectorCounts.keys());
  const extcssSelectors = uniqueSelectors.filter((selector) => /^\.extcss-[a-z0-9-]+$/i.test(selector));
  const singleUseExtcssSelectors = extcssSelectors.filter((selector) => (selectorCounts.get(selector) || 0) === 1);

  return {
    cssBytes: Buffer.byteLength(String(cssText || ''), 'utf8'),
    cssSha256: sha256(cssText),
    ruleCount: rules.length,
    selectorCount: rules.reduce((sum, rule) => sum + rule.selectors.length, 0),
    uniqueSelectorCount: uniqueSelectors.length,
    uniqueDeclarationCount: declarationCounts.size,
    extcssSelectorCount: extcssSelectors.length,
    singleUseExtcssSelectorCount: singleUseExtcssSelectors.length,
    singleUseExtcssRatio: extcssSelectors.length
      ? Number((singleUseExtcssSelectors.length / extcssSelectors.length).toFixed(4))
      : 0,
    topRepeatedSelectors: countMapToSortedArray(selectorCounts, 2, 10),
    topRepeatedDeclarations: countMapToSortedArray(declarationCounts, 2, 10),
    selectorCounts,
    declarationCounts
  };
}

function resolveFixtureSource(cleanedHtmlName) {
  const stem = cleanedHtmlName.replace(/\.html$/i, '');
  const candidates = [
    `${stem}.mht`,
    `${stem}.mhtml`
  ];

  for (const candidate of candidates) {
    const candidatePath = path.join(TESTS_DIR, candidate);
    if (fs.existsSync(candidatePath)) {
      return { fileName: candidate, filePath: candidatePath };
    }
  }

  return null;
}

async function convertFixtureWithMode(sourcePath, mode) {
  const raw = fs.readFileSync(sourcePath, 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });
  const config = {
    EnableCharsetFallback: true,
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe',
    ExternalizeCssEnabled: true,
    ExternalizeCssMode: mode,
    imageMap: parsed.imageMap || {}
  };

  const result = await runPipeline(parsed.html || '', config);
  const cssAsset = (result.assets || []).find((asset) => asset && asset.type === 'text/css' && typeof asset.content === 'string');

  return {
    mode,
    outputLength: Buffer.byteLength(String(result.output || ''), 'utf8'),
    assetCount: Array.isArray(result.assets) ? result.assets.length : 0,
    cssAssetFileName: cssAsset ? String(cssAsset.filename || '') : '',
    cssText: cssAsset ? String(cssAsset.content || '') : '',
    hasCssAsset: Boolean(cssAsset && cssAsset.content)
  };
}

function aggregateModeSummaries(fixtureRows, mode) {
  const rows = fixtureRows.map((row) => row.modes[mode]).filter(Boolean);
  const summary = {
    fixtures: rows.length,
    missingCssAssets: rows.filter((row) => !row.hasCssAsset).length,
    totalCssBytes: rows.reduce((sum, row) => sum + row.metrics.cssBytes, 0),
    totalRules: rows.reduce((sum, row) => sum + row.metrics.ruleCount, 0),
    totalUniqueSelectors: rows.reduce((sum, row) => sum + row.metrics.uniqueSelectorCount, 0),
    totalExtcssSelectors: rows.reduce((sum, row) => sum + row.metrics.extcssSelectorCount, 0),
    avgSingleUseExtcssRatio: rows.length
      ? Number((rows.reduce((sum, row) => sum + row.metrics.singleUseExtcssRatio, 0) / rows.length).toFixed(4))
      : 0
  };

  const repeatedSelectors = new Map();
  const repeatedDeclarations = new Map();

  rows.forEach((row) => {
    row.metrics.selectorCounts.forEach((count, selector) => {
      repeatedSelectors.set(selector, (repeatedSelectors.get(selector) || 0) + count);
    });
    row.metrics.declarationCounts.forEach((count, declaration) => {
      repeatedDeclarations.set(declaration, (repeatedDeclarations.get(declaration) || 0) + count);
    });
  });

  summary.topSelectors = countMapToSortedArray(repeatedSelectors, 3, 12);
  summary.topDeclarations = countMapToSortedArray(repeatedDeclarations, 3, 12);

  if (mode === 'shared') {
    const rawBundle = rows.map((row) => String(row.cssText || '').trim()).filter(Boolean).join('\n\n');
    const consolidatedBundle = consolidateCssRulesForBundle(rawBundle);
    const rawBundleBytes = Buffer.byteLength(rawBundle, 'utf8');
    const consolidatedBundleBytes = Buffer.byteLength(consolidatedBundle, 'utf8');
    const savingsBytes = Math.max(0, rawBundleBytes - consolidatedBundleBytes);
    summary.sharedBundleRawBytes = rawBundleBytes;
    summary.sharedBundleConsolidatedBytes = consolidatedBundleBytes;
    summary.sharedBundleSavingsBytes = savingsBytes;
    summary.sharedBundleSavingsRatio = rawBundleBytes
      ? Number((savingsBytes / rawBundleBytes).toFixed(4))
      : 0;
  }

  return summary;
}

function toPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function renderModeSummaryTable(modeSummaries) {
  const lines = [];
  lines.push('| Mode | Fixtures | Missing CSS Assets | Total CSS Bytes | Total Rules | Total Unique Selectors | Total `extcss-*` Selectors | Avg Single-Use `extcss-*` Ratio |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  MODES.forEach((mode) => {
    const s = modeSummaries[mode];
    lines.push(`| ${mode} | ${s.fixtures} | ${s.missingCssAssets} | ${s.totalCssBytes} | ${s.totalRules} | ${s.totalUniqueSelectors} | ${s.totalExtcssSelectors} | ${toPercent(s.avgSingleUseExtcssRatio)} |`);
  });
  return lines.join('\n');
}

function renderFixtureTable(fixtureRows) {
  const lines = [];
  lines.push('| Fixture | Source | Shared CSS Bytes | Shared Rules | Shared Unique Selectors | Shared `extcss` (single-use ratio) | Per-page CSS Bytes | Per-page Rules | Per-page Unique Selectors | Per-page `extcss` (single-use ratio) | CSS Hash Equal Across Modes |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |');

  fixtureRows.forEach((row) => {
    const shared = row.modes.shared;
    const perPage = row.modes['per-page'];
    lines.push(
      `| ${row.cleanedHtmlName} | ${row.sourceFixtureName} | ${shared.metrics.cssBytes} | ${shared.metrics.ruleCount} | ${shared.metrics.uniqueSelectorCount} | ${shared.metrics.extcssSelectorCount} (${toPercent(shared.metrics.singleUseExtcssRatio)}) | ${perPage.metrics.cssBytes} | ${perPage.metrics.ruleCount} | ${perPage.metrics.uniqueSelectorCount} | ${perPage.metrics.extcssSelectorCount} (${toPercent(perPage.metrics.singleUseExtcssRatio)}) | ${row.cssHashEqualAcrossModes ? 'Yes' : 'No'} |`
    );
  });

  return lines.join('\n');
}

function renderTopList(title, rows) {
  const lines = [];
  lines.push(`#### ${title}`);
  if (!rows.length) {
    lines.push('- None');
    return lines.join('\n');
  }
  rows.forEach((row) => {
    lines.push(`- \`${row.key}\` (${row.count})`);
  });
  return lines.join('\n');
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push('# CSS Audit Report');
  lines.push('');
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Source of truth fixtures: `Tests/expected/locked-cleaned/manifest.json`');
  lines.push('- Conversion source directory: `Tests/` (`.mht`/`.mhtml`)');
  lines.push('- Conversion modes audited: `shared`, `per-page`');
  lines.push('- Pipeline config: `ExternalizeCssEnabled=true`, `OutputCleanupMode=safe`, `UnitStrategy=normalize-safe`, charset fallback enabled');
  lines.push('');
  lines.push('## Mode Summary');
  lines.push('');
  lines.push(renderModeSummaryTable(payload.modeSummaries));
  lines.push('');
  if (payload.modeSummaries.shared && Number.isFinite(payload.modeSummaries.shared.sharedBundleRawBytes)) {
    const shared = payload.modeSummaries.shared;
    lines.push('## Shared Bundle Consolidation Impact');
    lines.push('');
    lines.push(`- Raw shared bundle bytes (naive concatenation): ${shared.sharedBundleRawBytes}`);
    lines.push(`- Consolidated shared bundle bytes (deduped rules): ${shared.sharedBundleConsolidatedBytes}`);
    lines.push(`- Estimated savings: ${shared.sharedBundleSavingsBytes} (${toPercent(shared.sharedBundleSavingsRatio)})`);
    lines.push('');
  }

  lines.push('## Fixture-Level Metrics');
  lines.push('');
  lines.push(renderFixtureTable(payload.fixtures));
  lines.push('');

  MODES.forEach((mode) => {
    const summary = payload.modeSummaries[mode];
    lines.push(`### Mode: ${mode}`);
    lines.push('');
    lines.push(renderTopList('Top Repeated Selectors', summary.topSelectors));
    lines.push('');
    lines.push(renderTopList('Top Repeated Declaration Blocks', summary.topDeclarations));
    lines.push('');
  });

  const mismatched = payload.fixtures.filter((fixture) => fixture.cssHashEqualAcrossModes !== true);
  lines.push('## Cross-Mode Equivalence');
  lines.push('');
  if (!mismatched.length) {
    lines.push('- All fixtures produced identical CSS content between `shared` and `per-page` modes (asset naming differs by mode at packaging stage).');
  } else {
    lines.push('- Some fixtures produced different CSS across modes:');
    mismatched.forEach((item) => {
      lines.push(`  - ${item.cleanedHtmlName}`);
    });
  }

  lines.push('');
  lines.push('## Initial Consolidation Signals');
  lines.push('');
  const highSingleUse = payload.fixtures
    .map((fixture) => ({
      fixture: fixture.cleanedHtmlName,
      ratio: fixture.modes.shared.metrics.singleUseExtcssRatio,
      extcssCount: fixture.modes.shared.metrics.extcssSelectorCount
    }))
    .filter((row) => row.extcssCount > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  if (!highSingleUse.length) {
    lines.push('- No `extcss-*` selectors were generated; no consolidation signal from hash-class extraction.');
  } else {
    lines.push('- Highest single-use `extcss-*` ratios (shared mode):');
    highSingleUse.forEach((item) => {
      lines.push(`  - ${item.fixture}: ${toPercent(item.ratio)} single-use across ${item.extcssCount} extcss selectors`);
    });
  }

  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  lines.push('- Implement selector/declaration consolidation rules focused on top repeated declaration blocks.');
  lines.push('- Add visual parity Playwright checks comparing embedded baseline vs externalized outputs for this fixture set.');
  lines.push('- Validate deterministic CSS naming/path behavior at ZIP packaging level (`converted-shared.css` vs per-page naming).');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  if (!fs.existsSync(LOCKED_MANIFEST_PATH)) {
    throw new Error(`Missing manifest: ${LOCKED_MANIFEST_PATH}`);
  }

  const manifest = readJson(LOCKED_MANIFEST_PATH);
  const requiredFiles = Array.isArray(manifest.requiredFiles) ? manifest.requiredFiles : [];
  if (!requiredFiles.length) {
    throw new Error('Locked manifest requiredFiles is empty.');
  }

  const fixtures = [];

  for (const cleanedHtmlName of requiredFiles) {
    const source = resolveFixtureSource(cleanedHtmlName);
    if (!source) {
      throw new Error(`Could not resolve source fixture for ${cleanedHtmlName}`);
    }

    const modes = {};
    for (const mode of MODES) {
      const conversion = await convertFixtureWithMode(source.filePath, mode);
      const metrics = summarizeCss(conversion.cssText);
      modes[mode] = {
        ...conversion,
        metrics
      };
    }

    fixtures.push({
      cleanedHtmlName,
      sourceFixtureName: source.fileName,
      modes,
      cssHashEqualAcrossModes: modes.shared.metrics.cssSha256 === modes['per-page'].metrics.cssSha256
    });
  }

  const modeSummaries = {
    shared: aggregateModeSummaries(fixtures, 'shared'),
    'per-page': aggregateModeSummaries(fixtures, 'per-page')
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(ROOT, LOCKED_MANIFEST_PATH).replace(/\\/g, '/'),
    fixtures,
    modeSummaries
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, buildMarkdownReport(payload), 'utf8');

  console.log(`wrote ${path.relative(ROOT, REPORT_JSON_PATH)}`);
  console.log(`wrote ${path.relative(ROOT, REPORT_MD_PATH)}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
