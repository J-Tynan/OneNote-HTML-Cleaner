# Externalized CSS Review

Last updated: 2026-03-09
Feature branch merged: `chore/externalized-css-review` (PR #5)

## Purpose

This document is the authoritative handoff for the externalized CSS review follow-up.
It records what was reviewed, what passed, what automation now protects the feature,
and what work is intentionally out of scope.

## Scope Reviewed

- CSS extraction from converted HTML when `ExternalizeCssEnabled=true`
- Shared vs `per-page` stylesheet packaging behavior
- Canonicalization and deduplication of extracted inline declarations
- Parity with embedded-style output for representative exported fixtures

## Evidence

- `Tests/reports/css-audit-report.md`
- `Tests/reports/css-audit-report.json`
- `Tests/reports/manual-review-findings.md`
- `Tests/externalize-css.unit.js`
- `Tests/externalize-css-parity.unit.js`
- `Tests/ui-download-zip-playwright.js`

## Reviewed Fixtures

- `Communicate using Markdown.mht`
- `Dental Appointment.mht`
- `DevToys.mht`
- `Problematic mht-full-snippet.mhtml`
- `Problematic mht-sample.mht`
- `Resolve merge conflicts.mht`
- `Test File.mht`
- `Test Handwriting.mht`

## Findings

- Shared and `per-page` modes emit content-identical extracted CSS; the difference is packaging/linking, not rule generation.
- Canonical declaration signatures and normalized extracted style blocks are now the intended consolidation boundary for the pipeline.
- Cross-fixture bundle analysis showed substantial duplicate CSS across fixtures, but that is a packaging optimization concern rather than a correctness blocker.
- Representative fixtures preserve semantic structure when externalized CSS is enabled; styling differences are isolated to extracted CSS assets and generated `extcss-*` classes.

## Automated Coverage

- `test:externalize-css` verifies extraction mechanics, style-block deduplication, and canonicalized inline-style signatures.
- `test:externalize-css-parity` runs representative MHT fixtures through the pipeline in embedded, shared, and `per-page` modes and asserts:
	- semantic structure is unchanged after presentational attributes are stripped
	- generated CSS assets are emitted in both modes
	- shared and `per-page` CSS payloads stay content-identical
	- every generated `extcss-*` class in HTML has a matching rule in the emitted stylesheet
- `test:ui-download-smoke` covers ZIP packaging behavior, including sidecar CSS assets and fallback README handling.

## Decision

The externalized CSS review follow-up is complete.

The repository now has:

- completed audit evidence
- documented consolidation behavior
- packaging smoke coverage
- automated parity regression coverage for representative fixtures

## Out Of Scope

The following are intentionally not part of this completed review pass:

- redesigning cross-fixture shared-bundle consolidation
- introducing new extraction heuristics solely for file-size reduction
- screenshot-diff infrastructure for exported pages

If future work is needed on shared-bundle optimization or broader visual regression tooling,
it should be tracked as a separate post-release task.
