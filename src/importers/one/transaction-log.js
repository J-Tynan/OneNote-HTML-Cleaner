// @ts-check

/** @typedef {import('./binary-reader.js').BinaryReader} BinaryReader */
/** @typedef {import('./revision-store.js').FileChunkReference64x32} FileChunkReference64x32 */

export const TRANSACTION_ENTRY_BYTE_LENGTH = 8;
export const TRANSACTION_ENTRY_END_SOURCE_ID = 1;
export const DEFAULT_MAX_TRANSACTIONS = 10000;
export const DEFAULT_MAX_ENTRIES_PER_TRANSACTION = 10000;

export class TransactionLogError extends Error {
  /**
   * @param {'invalid-transaction-log-range' | 'transaction-count-limit' | 'entry-count-limit' | 'truncated-transaction-log' | 'missing-file-node-list-count'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'TransactionLogError';
    this.code = code;
  }
}

/** @param {FileChunkReference64x32} reference @param {number} fileLength */
function isInFileReference(reference, fileLength) {
  return reference.stp <= BigInt(fileLength)
    && BigInt(reference.cb) <= BigInt(fileLength) - reference.stp;
}

/**
 * @typedef {{ maxTransactions?: number, maxEntriesPerTransaction?: number }} TransactionLogOptions
 */

/**
 * Decode completed transaction entries from the directly referenced transaction
 * log. This does not interpret the remaining fragment padding or follow any
 * other physical-file references.
 *
 * @param {BinaryReader} reader
 * @param {FileChunkReference64x32} reference
 * @param {number} transactionCount
 * @param {TransactionLogOptions} [options={}]
 */
export function readTransactionLog(reader, reference, transactionCount, options = {}) {
  const maxTransactions = Number.isSafeInteger(options.maxTransactions) && options.maxTransactions >= 0
    ? options.maxTransactions
    : DEFAULT_MAX_TRANSACTIONS;
  const maxEntriesPerTransaction = Number.isSafeInteger(options.maxEntriesPerTransaction) && options.maxEntriesPerTransaction >= 0
    ? options.maxEntriesPerTransaction
    : DEFAULT_MAX_ENTRIES_PER_TRANSACTION;
  if (!Number.isSafeInteger(transactionCount) || transactionCount < 0 || transactionCount > maxTransactions) {
    throw new TransactionLogError('transaction-count-limit', 'Transaction log has an invalid or excessive transaction count.');
  }
  if (!isInFileReference(reference, reader.length) || reference.stp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TransactionLogError('invalid-transaction-log-range', 'Transaction log reference is outside the file.');
  }

  const offset = Number(reference.stp);
  const endOffset = offset + reference.cb;
  /** @type {Array<Array<{ sourceId: number, value: number }>>} */
  const transactions = [];
  let entryOffset = offset;
  let transaction = [];
  while (transactions.length < transactionCount) {
    if (entryOffset + TRANSACTION_ENTRY_BYTE_LENGTH > endOffset) {
      throw new TransactionLogError('truncated-transaction-log', 'Transaction log ends before all declared transactions.');
    }
    const sourceId = reader.readUint32LE(entryOffset);
    const value = reader.readUint32LE(entryOffset + 4);
    entryOffset += TRANSACTION_ENTRY_BYTE_LENGTH;
    if (sourceId === TRANSACTION_ENTRY_END_SOURCE_ID) {
      transactions.push(transaction);
      transaction = [];
      continue;
    }
    if (transaction.length >= maxEntriesPerTransaction) {
      throw new TransactionLogError('entry-count-limit', `Transaction log exceeds the ${maxEntriesPerTransaction}-entry policy.`);
    }
    transaction.push({ sourceId, value });
  }

  return {
    offset,
    byteLength: reference.cb,
    consumedByteLength: entryOffset - offset,
    transactions
  };
}

/**
 * @param {{ transactions: Array<Array<{ sourceId: number, value: number }>> }} transactionLog
 * @param {number} fileNodeListId
 */
export function getLatestFileNodeListCount(transactionLog, fileNodeListId) {
  for (let transactionIndex = transactionLog.transactions.length - 1; transactionIndex >= 0; transactionIndex -= 1) {
    const transaction = transactionLog.transactions[transactionIndex];
    for (let entryIndex = transaction.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const entry = transaction[entryIndex];
      if (entry.sourceId === fileNodeListId) {
        return entry.value;
      }
    }
  }
  throw new TransactionLogError('missing-file-node-list-count', `Transaction log has no node count for file-node list ${fileNodeListId}.`);
}