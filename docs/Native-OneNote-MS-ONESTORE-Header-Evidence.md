# MS-ONESTORE Header Evidence

## Source

The physical revision-store header is defined by Microsoft [MS-ONESTORE: OneNote Revision Store File Format](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-onestore/), section 2.3.1, `Header`. The source used for this record is version 13.3, published 2025-05-20:

- DOCX: `https://officeprotocoldocs-f5hpbjgea6b8gneq.b02.azurefd.net/files/MS-ONESTORE/%5bMS-ONESTORE%5d-250520.docx`
- SHA-256: `2795d6bff185356ea09d993b211b720ba4afa1d51a9862c28fa73b87f6c16896`
- Extraction: `word/document.xml`, where the `Heading3` paragraph `Header` is immediately followed by the complete field diagram and field definitions.

The local [OneNote File Format.docx](OneNote%20File%20Format.docx) is MS-ONE, not MS-ONESTORE. Its section 2.2.1 is `ListFont`; it does not define this physical header layout.

## Header Layout

MS-ONESTORE defines `Header` at the beginning of the file and specifies it as 1024 bytes. The offsets below are the sequential byte offsets derived from the fixed-width source fields.

| Offset | Field | Size | Source type |
| --- | --- | ---: | --- |
| `0x000` | `guidFileType` | 16 | GUID |
| `0x010` | `guidFile` | 16 | GUID |
| `0x020` | `guidLegacyFileVersion` | 16 | GUID |
| `0x030` | `guidFileFormat` | 16 | GUID |
| `0x040` | `ffvLastCodeThatWroteToThisFile` | 4 | unsigned integer |
| `0x044` | `ffvOldestCodeThatHasWrittenToThisFile` | 4 | unsigned integer |
| `0x048` | `ffvNewestCodeThatHasWrittenToThisFile` | 4 | unsigned integer |
| `0x04C` | `ffvOldestCodeThatMayReadThisFile` | 4 | unsigned integer |
| `0x050` | `fcrLegacyFreeChunkList` | 8 | `FileChunkReference32` |
| `0x058` | `fcrLegacyTransactionLog` | 8 | `FileChunkReference32` |
| `0x060` | `cTransactionsInLog` | 4 | unsigned integer |
| `0x064` | `cbLegacyExpectedFileLength` | 4 | unsigned integer |
| `0x068` | `rgbPlaceholder` | 8 | unsigned integer |
| `0x070` | `fcrLegacyFileNodeListRoot` | 8 | `FileChunkReference32` |
| `0x078` | `cbLegacyFreeSpaceInFreeChunkList` | 4 | unsigned integer |
| `0x07C` | header flags | 4 | four one-byte fields |
| `0x080` | `guidAncestor` | 16 | GUID |
| `0x090` | `crcName` | 4 | unsigned integer |
| `0x094` | `fcrHashedChunkList` | 12 | `FileChunkReference64x32` |
| `0x0A0` | `fcrTransactionLog` | 12 | `FileChunkReference64x32` |
| `0x0AC` | `fcrFileNodeListRoot` | 12 | `FileChunkReference64x32` |
| `0x0B8` | `fcrFreeChunkList` | 12 | `FileChunkReference64x32` |
| `0x0C4` | `cbExpectedFileLength` | 8 | unsigned integer |
| `0x0CC` | `cbFreeSpaceInFreeChunkList` | 8 | unsigned integer |
| `0x0D4` | `guidFileVersion` | 16 | GUID |
| `0x0E4` | `nFileVersionGeneration` | 8 | unsigned integer |
| `0x0EC` | `guidDenyReadFileVersion` | 16 | GUID |
| `0x0FC` | `grfDebugLogFlags` | 4 | unsigned integer |
| `0x100` | `fcrDebugLog` | 12 | `FileChunkReference64x32` |
| `0x10C` | `fcrAllocVerificationFreeChunkList` | 12 | `FileChunkReference64x32` |
| `0x118` | `bnCreated` | 4 | unsigned integer |
| `0x11C` | `bnLastWroteToThisFile` | 4 | unsigned integer |
| `0x120` | `bnOldestWritten` | 4 | unsigned integer |
| `0x124` | `bnNewestWritten` | 4 | unsigned integer |
| `0x128` | `rgbReserved` | 728 | reserved bytes |

The table ends at `0x400`, matching the 1024-byte header size. `fcrFileNodeListRoot` is therefore at `0x0AC`; `0x30` is the start of `guidFileFormat`, not a file-node reference.

## Locked Fixture Comparison

[Tests/Test section.one](../Tests/Test%20section.one) remains a transitional header-research fixture. It is 30,056 bytes with SHA-256 `fc650495212471f1175edd1171a2d8ad917554b0bbd3c5b77e6e7a191d2859d6`.

| Field | Observed value | Result |
| --- | --- | --- |
| `guidFileType` | valid `.one` signature | matches preflight gate |
| `guidFileFormat` | `{109ADD3F-911B-49F5-A5D0-1791EDC8AED8}` | matches source invariant |
| `ffvLastCodeThatWroteToThisFile` | `0x0000002A` | matches `.one` source value |
| `cTransactionsInLog` | `39` | nonzero as required |
| `fcrHashedChunkList` | `stp=22672`, `cb=1024` | in file |
| `fcrTransactionLog` | `stp=2048`, `cb=2408` | in file |
| `fcrFileNodeListRoot` | `stp=1024`, `cb=1024` | in file |
| `fcrFreeChunkList` | `fcrNil` | documented sentinel; not dereferenced |
| `cbExpectedFileLength` | `30056` | equals fixture length |

`Tests/native-one-revision-store.unit.js` also proves a header truncated before the final byte of `fcrFileNodeListRoot` cannot decode that reference.

## Scope Boundary

This proves the header field location and fixture value only. The bounded
transaction-log and root-fragment reader is separately documented in
[MS-ONESTORE Transaction Log And File-Node Fragment Evidence](Native-OneNote-MS-ONESTORE-FileNodeList-Evidence.md).
It does not establish continuation traversal or page discovery.
