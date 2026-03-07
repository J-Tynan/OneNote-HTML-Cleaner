# CSS Audit Report

Generated: 2026-03-07T16:24:02.274Z

## Scope

- Source of truth fixtures: `Tests/expected/locked-cleaned/manifest.json`
- Conversion source directory: `Tests/` (`.mht`/`.mhtml`)
- Conversion modes audited: `shared`, `per-page`
- Pipeline config: `ExternalizeCssEnabled=true`, `OutputCleanupMode=safe`, `UnitStrategy=normalize-safe`, charset fallback enabled

## Mode Summary

| Mode | Fixtures | Missing CSS Assets | Total CSS Bytes | Total Rules | Total Unique Selectors | Total `extcss-*` Selectors | Avg Single-Use `extcss-*` Ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| shared | 7 | 0 | 19820 | 201 | 201 | 187 | 100.0% |
| per-page | 7 | 0 | 19820 | 201 | 201 | 187 | 100.0% |

## Shared Bundle Consolidation Impact

- Raw shared bundle bytes (naive concatenation): 19832
- Consolidated shared bundle bytes (deduped rules): 9032
- Estimated savings: 10800 (54.5%)

## Fixture-Level Metrics

| Fixture | Source | Shared CSS Bytes | Shared Rules | Shared Unique Selectors | Shared `extcss` (single-use ratio) | Per-page CSS Bytes | Per-page Rules | Per-page Unique Selectors | Per-page `extcss` (single-use ratio) | CSS Hash Equal Across Modes |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| Communicate using Markdown.html | Communicate using Markdown.mht | 5285 | 54 | 54 | 52 (100.0%) | 5285 | 54 | 54 | 52 (100.0%) | Yes |
| DevToys.html | DevToys.mht | 1750 | 20 | 20 | 18 (100.0%) | 1750 | 20 | 20 | 18 (100.0%) | Yes |
| Problematic mht-full-snippet.html | Problematic mht-full-snippet.mhtml | 562 | 6 | 6 | 4 (100.0%) | 562 | 6 | 6 | 4 (100.0%) | Yes |
| Problematic mht-sample.html | Problematic mht-sample.mht | 351 | 3 | 3 | 1 (100.0%) | 351 | 3 | 3 | 1 (100.0%) | Yes |
| Resolve merge conflicts.html | Resolve merge conflicts.mht | 5356 | 53 | 53 | 51 (100.0%) | 5356 | 53 | 53 | 51 (100.0%) | Yes |
| Test Handwriting.html | Test Handwriting.mht | 1056 | 12 | 12 | 10 (100.0%) | 1056 | 12 | 12 | 10 (100.0%) | Yes |
| Test File.html | Test File.mht | 5460 | 53 | 53 | 51 (100.0%) | 5460 | 53 | 53 | 51 (100.0%) | Yes |

### Mode: shared

#### Top Repeated Selectors
- `.converted-content-spacer` (7)
- `.converted-page-spacer` (7)
- `.extcss-1cvc7ad` (5)
- `.extcss-1xg3od4` (5)
- `.extcss-1y1iip5` (5)
- `.extcss-1youtby` (5)
- `.extcss-d0khnq` (5)
- `.extcss-pmr7gx` (5)
- `.extcss-ztpqdc` (5)
- `.extcss-12m0fk` (4)
- `.extcss-1c41jvk` (4)
- `.extcss-o13jvv` (4)

#### Top Repeated Declaration Blocks
- `font-size:1em;line-height:0.95;margin:0` (7)
- `font-size:1em;line-height:1;margin:0` (7)
- `color:#666666;direction:ltr;font-family:Arial;font-size:9pt;margin:0;text-align:left` (5)
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0` (5)
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0;margin-left:0.75em` (5)
- `direction:ltr;margin-left:0;margin-top:0` (5)
- `font-family:Calibri;font-size:11.0pt` (5)
- `font-family:Calibri;font-size:11.0pt;margin:0` (5)
- `margin:0` (5)
- `border-bottom:1px solid #b7b7b7;display:inline-block;font-family:"Calibri Light";font-size:20pt;font-weight:400;margin:0;padding-bottom:0.08em;padding-right:1in` (4)
- `border-collapse:collapse;border-color:#A3A3A3;border-style:solid;border-width:0;direction:ltr` (4)
- `direction:ltr` (4)

### Mode: per-page

#### Top Repeated Selectors
- `.converted-content-spacer` (7)
- `.converted-page-spacer` (7)
- `.extcss-1cvc7ad` (5)
- `.extcss-1xg3od4` (5)
- `.extcss-1y1iip5` (5)
- `.extcss-1youtby` (5)
- `.extcss-d0khnq` (5)
- `.extcss-pmr7gx` (5)
- `.extcss-ztpqdc` (5)
- `.extcss-12m0fk` (4)
- `.extcss-1c41jvk` (4)
- `.extcss-o13jvv` (4)

#### Top Repeated Declaration Blocks
- `font-size:1em;line-height:0.95;margin:0` (7)
- `font-size:1em;line-height:1;margin:0` (7)
- `color:#666666;direction:ltr;font-family:Arial;font-size:9pt;margin:0;text-align:left` (5)
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0` (5)
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0;margin-left:0.75em` (5)
- `direction:ltr;margin-left:0;margin-top:0` (5)
- `font-family:Calibri;font-size:11.0pt` (5)
- `font-family:Calibri;font-size:11.0pt;margin:0` (5)
- `margin:0` (5)
- `border-bottom:1px solid #b7b7b7;display:inline-block;font-family:"Calibri Light";font-size:20pt;font-weight:400;margin:0;padding-bottom:0.08em;padding-right:1in` (4)
- `border-collapse:collapse;border-color:#A3A3A3;border-style:solid;border-width:0;direction:ltr` (4)
- `direction:ltr` (4)

## Cross-Mode Equivalence

- All fixtures produced identical CSS content between `shared` and `per-page` modes (asset naming differs by mode at packaging stage).

## Initial Consolidation Signals

- Highest single-use `extcss-*` ratios (shared mode):
  - Communicate using Markdown.html: 100.0% single-use across 52 extcss selectors
  - DevToys.html: 100.0% single-use across 18 extcss selectors
  - Problematic mht-full-snippet.html: 100.0% single-use across 4 extcss selectors
  - Problematic mht-sample.html: 100.0% single-use across 1 extcss selectors
  - Resolve merge conflicts.html: 100.0% single-use across 51 extcss selectors

## Next Actions

- Implement selector/declaration consolidation rules focused on top repeated declaration blocks.
- Add visual parity Playwright checks comparing embedded baseline vs externalized outputs for this fixture set.
- Validate deterministic CSS naming/path behavior at ZIP packaging level (`converted-shared.css` vs per-page naming).

