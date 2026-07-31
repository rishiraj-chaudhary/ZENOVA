import mongoose from "mongoose";
import logger from "./logger.js";

/**
 * Runs a unit of work inside a transaction when the deployment supports one.
 *
 * Transactions require a replica set or sharded cluster. Atlas provides one; a
 * standalone mongod does not. Rather than make multi-document consistency
 * depend on the environment, the work falls back to running unsessioned — the
 * callers already tolerate partial failure, so this upgrades safety where it is
 * available instead of failing where it is not.
 *
 * Support is detected from the first real attempt rather than a probe, because
 * a standalone accepts startTransaction() and only rejects the first write.
 */
let transactionsSupported = null;

const UNSUPPORTED_CODE_NAMES = new Set([
  "IllegalOperation",
  "NoSuchTransaction",
  "CommandNotSupported",
]);

const isUnsupportedError = (error) =>
  UNSUPPORTED_CODE_NAMES.has(error?.codeName) ||
  /replica set member or mongos|Transaction numbers are only allowed/i.test(
    error?.message ?? ""
  );

export const withTransaction = async (work) => {
  if (transactionsSupported === false) return work(null);

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });

    transactionsSupported = true;
    return result;
  } catch (error) {
    if (!isUnsupportedError(error)) throw error;

    if (transactionsSupported !== false) {
      transactionsSupported = false;
      logger.warn(
        "transactions unavailable on this deployment; multi-document writes run unsessioned"
      );
    }

    // The aborted attempt wrote nothing, so replaying without a session is safe.
    return work(null);
  } finally {
    await session.endSession();
  }
};

/** Test hook: forces re-detection against a new connection. */
export const resetTransactionSupport = () => {
  transactionsSupported = null;
};
