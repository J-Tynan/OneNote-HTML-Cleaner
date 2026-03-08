import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';

import { parseMht } from '../src/pipeline/mht.js';
import { runPipeline } from '../src/pipeline/pipeline.js';
import { CORE_NOTE_FIXTURES, resolveFixturePath } from '../Tests/fixtures.js';

const dom = new JSDOM('');
global.DOMParser = dom.window.DOMParser;
global.NodeFilter = dom.window.NodeFilter;

const REPORTS_DIR = path.join('Tests', 'reports');
const JSON_REPORT = path.join(REPORTS_DIR, 'css-audit-report.json');
const MD_REPORT = path.join(REPORTS_DIR, 'css-audit-report.md');
const SOURCE_MANIFEST = 'Tests/expected/locked-cleaned/manifest.json';

function canonicalizeDeclarationBlock(text) {
  const parts = String(text || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const idx = part.indexOf(':');
      if (idx < 0) return null;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim().replace(/\s+/g, ' ');
      return prop && value ? [prop, value] : null;
    })
    .filter(Boolean);

  const byProp = new Map();
  for (const [prop, value] of parts) {
    byProp.set(prop, value);
  }

  return Array.from(byProp.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([prop, value]) => `${prop}:${value}`)
    .join(';');
}

function parseCssRules(cssText) {
  const rules = [];
  const text = String(cssText || '');
  const rx = /([^{}]+)\{([^{}]*)\}/g;
  let match = null;

  while ((match = rx.exec(text)) !== null) {
    const rawSelector = String(match[1] || '').trim();
    const rawDeclaration = String(match[2] || '').trim();
    if (!rawSelector || !rawDeclaration) continue;

    const selectors = rawSelector
      .split(',')
      .map(selector => selector.trim())
      .filter(Boolean);

    const canonicalDeclaration = canonicalizeDeclarationBlock(rawDeclaration);
    for (const selector of selectors) {
      rules.push({ selector, declaration: canonicalDeclaration });
    }
  }

  return rules;
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function topCounts(map, limit = 12) {
  return Array.from(map.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function computeCssMetrics(cssText) {
  const rules = parseCssRules(cssText);
  const selectorCounts = new Map();
  const declarationCounts = new Map();

  for (const rule of rules) {
    selectorCounts.set(rule.selector, (selectorCounts.get(rule.selector) || 0) + 1);
    declarationCounts.set(rule.declaration, (declarationCounts.get(rule.declaration) || 0) + 1);
  }

  const extcssSelectors = Array.from(selectorCounts.keys()).filter(s => /^\.extcss-/i.test(s));
  const singleUseExtcssSelectorCount = extcssSelectors.filter(s => selectorCounts.get(s) === 1).length;

  return {
    cssBytes: Buffer.byteLength(String(cssText || ''), 'utf8'),
    cssSha256: sha256(cssText || ''),
    ruleCount: rules.length,
    selectorCount: rules.length,
    uniqueSelectorCount: selectorCounts.size,
    uniqueDeclarationCount: declarationCounts.size,
    extcssSelectorCount: extcssSelectors.length,
    singleUseExtcssSelectorCount,
    singleUseExtcssRatio: extcssSelectors.length ? Number((singleUseExtcssSelectorCount / extcssSelectors.length).toFixed(4)) : 0,
    topRepeatedSelectors: topCounts(selectorCounts).filter(entry => entry.count > 1),
    topRepeatedDeclarations: topCounts(declarationCounts).filter(entry => entry.count > 1),
    selectorCounts: Object.fromEntries(Array.from(selectorCounts.entries()).filter(([, count]) => count > 1)),
    declarationCounts: Object.fromEntries(Array.from(declarationCounts.entries()).filter(([, count]) => count > 1))
  };
}

function summarizeMode(fixtures, mode) {
  const modeRows = fixtures.map(entry => entry.modes[mode]).filter(Boolean);
  const selectorCounts = new Map();
  const declarationCounts = new Map();

  let missingCssAssets = 0;
  let totalCssBytes = 0;
  let totalRules = 0;
  let totalUniqueSelectors = 0;
  let totalExtcssSelectors = 0;
  let singleUseRatioTotal = 0;

  for (const row of modeRows) {
    if (!row.hasCssAsset) {
      missingCssAssets += 1;
      continue;
    }

    totalCssBytes += row.metrics.cssBytes;
    totalRules += row.metrics.ruleCount;
    totalUniqueSelectors += row.metrics.uniqueSelectorCount;
    totalExtcssSelectors += row.metrics.extcssSelectorCount;
    singleUseRatioTotal += row.metrics.singleUseExtcssRatio;

    const rules = parseCssRules(row.cssText);
    for (const rule of rules) {
      selectorCounts.set(rule.selector, (selectorCounts.get(rule.selector) || 0) + 1);
      declarationCounts.set(rule.declaration, (declarationCounts.get(rule.declaration) || 0) + 1);
    }
  }

  return {
    fixtures: modeRows.length,
    missingCssAssets,
    totalCssBytes,
    totalRules,
    totalUniqueSelectors,
    totalExtcssSelectors,
    avgSingleUseExtcssRatio: modeRows.length ? Number((singleUseRatioTotal / modeRows.length).toFixed(4)) : 0,
    topSelectors: topCounts(selectorCounts),
    topDeclarations: topCounts(declarationCounts)
  };
}

function consolidateBundleCss(cssParts) {
  const ordered = [];
  const seen = new Set();

  for (const cssText of cssParts) {
    const rules = parseCssRules(cssText);
    for (const rule of rules) {
      const key = `${rule.selector}|${rule.declaration}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(`
${rule.selector}{${rule.declaration}}`);
    }
  }

  return ordered.join('').trim();
}

async function renderFixtureForMode(fileName, mode) {
  const fixturePath = resolveFixturePath(fileName);
  const raw = fs.readFileSync(fixturePath, 'latin1');
  const parsed = parseMht(raw, { EnableCharsetFallback: true, EnableMapping: true });

  const result = await runPipeline(parsed.html || '', {
    imageMap: parsed.imageMap || {},
    OutputCleanupMode: 'safe',
    UnitStrategy: 'normalize-safe',
    ExternalizeCssEnabled: true,
    ExternalizeCssMode: mode
  });

  const assets = Array.isArray(result.assets) ? result.assets : [];
  const cssAsset = assets.find(asset => asset && asset.type === 'text/css' && typeof asset.content === 'string');
  const cssText = cssAsset ? String(cssAsset.content || '') : '';

  return {
    mode,
    outputLength: String(result.output || '').length,
    assetCount: assets.length,
    cssAssetFileName: cssAsset ? cssAsset.filename || (mode === 'per-page' ? 'converted-page.css' : 'converted-shared.css') : '',
    cssText,
    hasCssAsset: Boolean(cssAsset && cssText.trim()),
    metrics: computeCssMetrics(cssText)
  };
}

function toCleanedHtmlName(sourceFixtureName) {
  const parsed = path.parse(sourceFixtureName);
  return `${parsed.name}.html`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function makeMarkdown(report) {
  const shared = report.modeSummaries.shared;
  const perPage = report.modeSummaries['per-page'];

  const lines = [];
  lines.push('# CSS Audit Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Fixtures audited: ${report.fixtures.length}`);
  lines.push('Modes: `shared`, `per-page`');
  lines.push('');

  lines.push('## Branch Summary');
  lines.push('');
  lines.push(`- Shared total CSS bytes: ${shared.totalCssBytes}`);
  lines.push(`- Per-page total CSS bytes: ${perPage.totalCssBytes}`);
  lines.push(`- Shared bundle raw bytes: ${shared.sharedBundleRawBytes}`);
  lines.push(`- Shared bundle consolidated bytes: ${shared.sharedBundleConsolidatedBytes}`);
  lines.push(`- Shared bundle savings: ${shared.sharedBundleSavingsBytes} (${formatPercent(shared.sharedBundleSavingsRatio)})`);
  lines.push(`- Avg single-use extcss ratio (shared): ${formatPercent(shared.avgSingleUseExtcssRatio)}`);
  lines.push(`- Avg single-use extcss ratio (per-page): ${formatPercent(perPage.avgSingleUseExtcssRatio)}`);
  lines.push('');

  lines.push('## Fixture Review');
  lines.push('');
  lines.push('| Fixture | Shared bytes | Shared rules | Per-page bytes | Hash equal across modes |');
  lines.push('| --- | ---: | ---: | ---: | :---: |');
  for (const fixture of report.fixtures) {
    lines.push(`| ${fixture.sourceFixtureName} | ${fixture.modes.shared.metrics.cssBytes} | ${fixture.modes.shared.metrics.ruleCount} | ${fixture.modes['per-page'].metrics.cssBytes} | ${fixture.cssHashEqualAcrossModes ? 'Yes' : 'No'} |`);
  }
  lines.push('');

  lines.push('## Top Repeated Selectors (shared mode)');
  lines.push('');
  for (const row of shared.topSelectors.slice(0, 12)) {
    lines.push(`- \`${row.key}\`: ${row.count}`);
  }
  lines.push('');

  lines.push('## Top Repeated Declaration Blocks (shared mode)');
  lines.push('');
  for (const row of shared.topDeclarations.slice(0, 12)) {
    lines.push(`- \`${row.key}\`: ${row.count}`);
  }
  lines.push('');

  lines.push('## Notes');
  lines.push('');
  lines.push('- This report audits extracted CSS emitted by the pipeline with `ExternalizeCssEnabled=true`.');
  lines.push('- Shared/per-page mode differences are packaging/linking concerns; CSS extraction content is expected to match across modes.');

  return `${lines.join('\n')}\n`;
}

async function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const fixtures = [];
  for (const fixtureName of CORE_NOTE_FIXTURES) {
    const shared = await renderFixtureForMode(fixtureName, 'shared');
    const perPage = await renderFixtureForMode(fixtureName, 'per-page');

    fixtures.push({
      cleanedHtmlName: toCleanedHtmlName(fixtureName),
      sourceFixtureName: fixtureName,
      modes: {
        shared,
        'per-page': perPage
      },
      cssHashEqualAcrossModes: shared.metrics.cssSha256 === perPage.metrics.cssSha256
    });
  }

  const modeSummaries = {
    shared: summarizeMode(fixtures, 'shared'),
    'per-page': summarizeMode(fixtures, 'per-page')
  };

  const sharedCssParts = fixtures
    .map(entry => entry.modes.shared.cssText)
    .filter(Boolean);

  const sharedRaw = sharedCssParts.join('\n\n').trim();
  const sharedConsolidated = consolidateBundleCss(sharedCssParts);
  const rawBytes = Buffer.byteLength(sharedRaw, 'utf8');
  const consolidatedBytes = Buffer.byteLength(sharedConsolidated, 'utf8');
  const savingsBytes = Math.max(rawBytes - consolidatedBytes, 0);
  const savingsRatio = rawBytes > 0 ? Number((savingsBytes / rawBytes).toFixed(4)) : 0;

  modeSummaries.shared.sharedBundleRawBytes = rawBytes;
  modeSummaries.shared.sharedBundleConsolidatedBytes = consolidatedBytes;
  modeSummaries.shared.sharedBundleSavingsBytes = savingsBytes;
  modeSummaries.shared.sharedBundleSavingsRatio = savingsRatio;

  const report = {
    generatedAt: new Date().toISOString(),
    sourceManifest: SOURCE_MANIFEST,
    fixtures,
    modeSummaries
  };

  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_REPORT, makeMarkdown(report), 'utf8');

  console.log(`wrote ${JSON_REPORT}`);
  console.log(`wrote ${MD_REPORT}`);
  console.log(`fixtures: ${fixtures.length}`);
  console.log(`shared bundle savings: ${savingsBytes} bytes (${formatPercent(savingsRatio)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
