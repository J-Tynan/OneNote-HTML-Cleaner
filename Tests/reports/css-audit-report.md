# CSS Audit Report

Generated: 2026-03-08T08:18:31.487Z
Fixtures audited: 8
Modes: `shared`, `per-page`

## Branch Summary

- Shared total CSS bytes: 21624
- Per-page total CSS bytes: 21624
- Shared bundle raw bytes: 21638
- Shared bundle consolidated bytes: 10447
- Shared bundle savings: 11191 (51.72%)
- Avg single-use extcss ratio (shared): 100.00%
- Avg single-use extcss ratio (per-page): 100.00%

## Fixture Review

| Fixture | Shared bytes | Shared rules | Per-page bytes | Hash equal across modes |
| --- | ---: | ---: | ---: | :---: |
| Communicate using Markdown.mht | 4809 | 52 | 4809 | Yes |
| Dental Appointment.mht | 3910 | 44 | 3910 | Yes |
| DevToys.mht | 1508 | 18 | 1508 | Yes |
| Problematic mht-full-snippet.mhtml | 406 | 4 | 406 | Yes |
| Problematic mht-sample.mht | 206 | 1 | 206 | Yes |
| Resolve merge conflicts.mht | 4873 | 51 | 4873 | Yes |
| Test File.mht | 4961 | 51 | 4961 | Yes |
| Test Handwriting.mht | 951 | 11 | 951 | Yes |

## Top Repeated Selectors (shared mode)

- `.extcss-1cvc7ad`: 6
- `.extcss-1xg3od4`: 6
- `.extcss-1y1iip5`: 6
- `.extcss-1youtby`: 6
- `.extcss-d0khnq`: 6
- `.extcss-pmr7gx`: 6
- `.extcss-ztpqdc`: 6
- `.extcss-12m0fk`: 5
- `.extcss-1c41jvk`: 5
- `.extcss-sa3w3n`: 5
- `.extcss-1ta1xbu`: 4
- `.extcss-9loqhw`: 4

## Top Repeated Declaration Blocks (shared mode)

- `color:#666666;direction:ltr;font-family:Arial;font-size:9pt;margin:0;text-align:left`: 6
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0`: 6
- `color:#666666;font-family:Calibri, Arial, sans-serif;font-size:10pt;margin:0;margin-left:0.75em`: 6
- `direction:ltr;margin-left:0;margin-top:0`: 6
- `font-family:Calibri;font-size:11.0pt`: 6
- `font-family:Calibri;font-size:11.0pt;margin:0`: 6
- `margin:0`: 6
- `border-bottom:1px solid #b7b7b7;display:inline-block;font-family:"Calibri Light";font-size:20pt;font-weight:400;margin:0;padding-bottom:0.08em;padding-right:1in`: 5
- `border-collapse:collapse;border-color:#A3A3A3;border-style:solid;border-width:0;direction:ltr`: 5
- `direction:ltr`: 5
- `direction:ltr;margin-bottom:0;margin-left:0.35em;margin-top:0;padding-inline-start:1.2em;padding-left:1.2em;unicode-bidi:embed`: 4
- `direction:ltr;margin-left:.075in`: 4

## Notes

- This report audits extracted CSS emitted by the pipeline with `ExternalizeCssEnabled=true`.
- Shared/per-page mode differences are packaging/linking concerns; CSS extraction content is expected to match across modes.
