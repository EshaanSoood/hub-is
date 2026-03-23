import { createRequestLogger } from '../lib/logger.mjs';

const transactionLog = createRequestLogger('system', 'SYSTEM', '/db/transaction', 'system');

/**
 * Shared SQLite transaction wrapper for route-level mutations.
 */
export const withTransaction = (db, fn) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      db.exec('ROLLBACK');
      throw new Error('withTransaction does not support async callbacks.');
    }
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      transactionLog.warn('Rollback failed while unwinding transaction.', { error: rollbackError });
    }
    throw error;
  }
};
