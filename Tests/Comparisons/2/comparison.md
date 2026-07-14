# Comparison Table

This file compares OneNote native export formats (`.docx`, `.mht`, `.pdf`) against the cleaned HTML output (`.html`) for the files in this folder.

## Method

- Raw file size is measured directly from the saved file bytes on disk.
- Exact token counts use the `o200k_base` tokenizer on normalized extracted text, not on raw binary/container bytes.
- `.html`: extracted visible text from `main` when present, otherwise `body`, excluding `script`, `style`, and toolbar chrome.
- `.mht`: decoded the MIME container, selected the main HTML part, then extracted visible text using the same HTML rules.
- `.docx`: extracted text from `word/document.xml`.
- `.pdf`: extracted text with `pypdf`.
- Because `.docx` and `.pdf` are binary containers, their token counts represent extracted text only. They are not directly comparable as raw text sources.
- Handwriting-heavy files contain very little recoverable text, so bytes-per-token ratios become much less meaningful for those samples.

## Overall Format Summary

| Format | Files | Total raw bytes | Total extracted tokens | Total raw bytes per token | Total tokens per KB raw | Raw human-readable? | Editable? | Direct AI ingest? | Overall verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| HTML | 4 | 85,939 B | 1,172 | 73.33 | 13.96 | Yes | Yes | Yes | Best overall working format for reading, editing, diffing, and AI analysis |
| MHT | 4 | 121,213 B | 1,182 | 102.55 | 9.99 | Partial | Partial | Partial | Recovers similar text to HTML, but carries noticeably more archive/container overhead |
| DOCX | 4 | 95,538 B | 1,061 | 90.05 | 11.37 | No | Yes | No | Can store text efficiently, but requires extraction and is not source-readable |
| PDF | 4 | 1,140,978 B | 1,226 | 930.65 | 1.10 | No | No | No | Best for fixed presentation, worst source format for AI-oriented analysis |

## Raw File Size By Document

| Document | HTML | MHT | DOCX | PDF | Smallest raw format | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Review pull requests | 20,730 B | 32,479 B | 21,898 B | 290,244 B | HTML | Cleaned HTML is also the most directly reusable text source in this set |
| Test File | 30,061 B | 47,147 B | 26,134 B | 312,255 B | DOCX | DOCX is slightly smaller here, but still requires opaque container extraction |
| Test Fonts & Headings | 9,482 B | 13,472 B | 16,303 B | 280,566 B | HTML | Strong example of compact cleaned HTML versus native export formats |
| Test Handwriting | 25,666 B | 28,115 B | 31,203 B | 257,913 B | HTML | Image-heavy sample; raw size is dominated by non-text payloads |

## Exact Extracted-Text Token Benchmark

| Document | Format | Extracted chars | Exact tokens | Raw bytes per token | Tokens per KB raw | AI-ready without preprocessing? | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Review pull requests | HTML | 3,570 | 803 | 25.82 | 39.67 | Yes | Best result in this set: compact, structured, and directly ingestible |
| Review pull requests | MHT | 3,570 | 804 | 40.40 | 25.35 | Partial | Similar recoverable text to HTML, but extra MIME/container overhead |
| Review pull requests | DOCX | 3,544 | 716 | 30.58 | 33.48 | No | Efficient after extraction, but not directly readable or inspectable |
| Review pull requests | PDF | 3,613 | 781 | 371.63 | 2.76 | No | Text can be extracted, but the file is a very heavy AI source container |
| Test File | HTML | 393 | 198 | 151.82 | 6.74 | Yes | Best directly usable format despite DOCX being slightly smaller on disk |
| Test File | MHT | 393 | 199 | 236.92 | 4.32 | Partial | Similar text yield to HTML, but substantially worse storage efficiency |
| Test File | DOCX | 371 | 188 | 139.01 | 7.37 | No | Slightly better bytes-per-token than HTML, but requires preprocessing |
| Test File | PDF | 603 | 282 | 1,107.29 | 0.92 | No | Extracted text is noisier and much more expensive per recoverable token |
| Test Fonts & Headings | HTML | 454 | 151 | 62.79 | 16.31 | Yes | Clear win for cleaned HTML on both raw size and AI-readiness |
| Test Fonts & Headings | MHT | 454 | 152 | 88.63 | 11.55 | Partial | Same basic content as HTML with more archive overhead |
| Test Fonts & Headings | DOCX | 432 | 138 | 118.14 | 8.67 | No | Acceptable after extraction, but still a binary editing format |
| Test Fonts & Headings | PDF | 452 | 134 | 2,093.78 | 0.49 | No | Very poor container efficiency for AI-style text recovery |
| Test Handwriting | HTML | 61 | 20 | 1,283.30 | 0.80 | Yes | Token metrics are unstable here because the file is mostly image payload, not text |
| Test Handwriting | MHT | 81 | 27 | 1,041.30 | 0.98 | Partial | Similar caveat: image-heavy file with minimal recoverable text |
| Test Handwriting | DOCX | 59 | 19 | 1,642.26 | 0.62 | No | Binary editing format with very little text to recover |
| Test Handwriting | PDF | 92 | 29 | 8,893.55 | 0.12 | No | Worst result in this folder; fixed-layout container around very little extractable text |

## Format Characteristics

| Format | Raw file human-readable? | Easily editable? | Searchable as raw source? | Version-control friendly? | Best use case |
| --- | --- | --- | --- | --- | --- |
| HTML | Yes | Yes | Yes | Yes | Clean reading, editing, structured downstream reuse, AI analysis |
| MHT | Partial | Partial | Partial | Poor | Native OneNote archive/export interchange |
| DOCX | No | Yes | No | No | Office document editing and sharing |
| PDF | No | No | No | No | Fixed-layout viewing, printing, and presentation |

## Main Takeaways

- Cleaned HTML is the best overall source format in this sample set for AI analysis because it is already text, already structured, and directly inspectable.
- MHT preserves similar recoverable content, but carries more archive and encoding overhead than cleaned HTML.
- DOCX can be relatively storage-efficient for some documents after extraction, but it is not directly human-readable or AI-ready as a raw file.
- PDF is by far the least efficient source format for AI-style text analysis in this sample set.
- Handwriting-heavy pages should be interpreted carefully because their payload is dominated by embedded image content rather than recoverable text.
