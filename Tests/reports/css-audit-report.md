# CSS Audit Report

Generated: 2026-03-08T07:45:56.160Z
Fixtures audited: 4
Modes: `shared`, `per-page`

## Branch Summary

- Shared total CSS bytes: 17331
- Per-page total CSS bytes: 17331
- Shared bundle raw bytes: 17337
- Shared bundle consolidated bytes: 7238
- Shared bundle savings: 10099 (58.25%)
- Avg single-use extcss ratio (shared): 100.00%
- Avg single-use extcss ratio (per-page): 100.00%

## Fixture Review

| Fixture | Shared bytes | Shared rules | Per-page bytes | Hash equal across modes |
| --- | ---: | ---: | ---: | :---: |
| Resolve merge conflicts.mht | 5226 | 51 | 5226 | Yes |
| Test File.mht | 5330 | 51 | 5330 | Yes |
| Communicate using Markdown.mht | 5155 | 52 | 5155 | Yes |
| DevToys.mht | 1620 | 18 | 1620 | Yes |

## Top Repeated Selectors (shared mode)

- `.extcss-12m0fk`: 4
- `.extcss-1c41jvk`: 4
- `.extcss-1cvc7ad`: 4
- `.extcss-1xg3od4`: 4
- `.extcss-1y1iip5`: 4
- `.extcss-1youtby`: 4
- `.extcss-d0khnq`: 4
- `.extcss-o13jvv`: 4
- `.extcss-pmr7gx`: 4
- `.extcss-r1mt8i`: 4
- `.extcss-sa3w3n`: 4
- `.extcss-ztpqdc`: 4

## Top Repeated Declaration Blocks (shared mode)

- `border-bottom:1px solid #b7b7b7;display:inline-block;font-family:"Calibri Light";font-size:20pt;font-weight:400;margin:0;padding-bottom:0.08em;padding-right:1in`: 4
- `border-collapse:collapse;border-color:#A3A3A3;border-style:solid;border-width:0;direction:ltr`: 4
- `color:#666666;direction:ltr;font-family:Arial;font-size:9pt;margin:0;text-align:left`: 4
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0`: 4
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0;margin-left:0.75em`: 4
- `direction:ltr`: 4
- `direction:ltr;margin-left:.075in`: 4
- `direction:ltr;margin-left:.075in;margin-top:0`: 4
- `direction:ltr;margin-left:0;margin-top:0`: 4
- `font-family:Calibri;font-size:11.0pt`: 4
- `font-family:Calibri;font-size:11.0pt;margin:0`: 4
- `margin:0`: 4

## Notes

- This report audits extracted CSS emitted by the pipeline with `ExternalizeCssEnabled=true`.
- Shared/per-page mode differences are packaging/linking concerns; CSS extraction content is expected to match across modes.
