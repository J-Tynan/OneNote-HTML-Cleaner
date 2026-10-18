# MS-ONESTORE Transaction Log And File-Node Fragment Evidence

## Source

The physical revision-store structures in this note come from Microsoft
[MS-ONESTORE: OneNote Revision Store File Format](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-onestore/), version 13.3, published 2025-05-20:

- DOCX: `https://officeprotocoldocs-f5hpbjgea6b8gneq.b02.azurefd.net/files/MS-ONESTORE/%5bMS-ONESTORE%5d-250520.docx`
- SHA-256: `2795d6bff185356ea09d993b211b720ba4afa1d51a9862c28fa73b87f6c16896`
- Sections: 2.3.3 `TransactionLogFragment`, 2.4.1 `FileNodeListFragment`,
  2.4.2 `FileNode`, and 2.4.3 `FileNodeChunkReference`.

The local [OneNote File Format.docx](OneNote%20File%20Format.docx) is
MS-ONE. It remains the eventual content-model source, but it does not define
these physical revision-store records.

## Direct Structural Path

`Header.cTransactionsInLog` at `0x060` declares the number of completed
transactions to read from `Header.fcrTransactionLog`. Each transaction is a
sequence of 8-byte entries: a 4-byte source ID and a 4-byte value. Source ID
`1` ends one transaction. A source ID equal to a `FileNodeListFragment` list
ID records that list's current file-node count.

The root reference from `Header.fcrFileNodeListRoot` addresses one
`FileNodeListFragment`. The directly implemented reader validates:

| Record portion | Validation |
| --- | --- |
| Header | 8-byte magic `0xA4567AB1F5F7F4C4`, 4-byte list ID, and 4-byte fragment sequence |
| Node stream | 4-byte packed `FileNode` header, including 10-bit ID, 13-bit size, formats, base type, and required reserved bit |
| End | exact node count from the latest transaction-log entry, 12-byte continuation reference, and 8-byte footer `0x8BC215C38233BA4B` |
| Bounds | fragment/reference ranges, node sizes, declared transaction count, transaction-entry count, and a configurable file-node count policy |

The node count is mandatory. Bytes after that count are fragment padding and
must not be guessed as `FileNode` headers. A fragment continuation reference
is validated but not followed.

## Locked Fixture Observations

| Fixture | Completed transactions | Latest root-list count | Root fragment result |
| --- | ---: | ---: | --- |
| `Fixture-1.one` | 16 | 3 | three structural nodes |
| `Fixture-2.one` | 20 | 4 | four structural nodes |
| `Fixture-3.one` | 17 | 4 | four structural nodes; no payload semantics claimed |

`Tests/native-one-transaction-log.unit.js` verifies those transaction and
node-count values. `Tests/native-one-file-node-list.unit.js` verifies the
complete Fixture 1 descriptor, the different Fixture 2 count, Fixture 3's
final descriptor, and malformed footer, node-size, count-limit, range, and
missing-count failures. `Fixture-4.one` is rejected by the header's declared
file-length check before this path can run.

## Scope Boundary

This evidence proves a bounded structural intake path only. It does not
decode file-node payloads, follow continuation fragments, resolve object
spaces, determine active revisions, or discover pages. Fragment-chain
traversal must first add documented activity/continuation rules, cycle and
depth limits, plus positive and negative fixtures.