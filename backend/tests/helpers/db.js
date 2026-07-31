import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let memoryServer;

export const connectTestDb = async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());

  /**
   * Mongoose builds indexes when a model is first compiled, against whichever
   * connection existed then. Each test file connects to its own fresh in-memory
   * server, so by the second file the models are already compiled and their
   * indexes are never created on the new database.
   *
   * Without the unique index on Gamification.userId, concurrent upserts insert
   * duplicate documents instead of conflicting — which is exactly what the
   * concurrency tests exist to catch. Building indexes explicitly makes the
   * test database match production.
   */
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );
};

export const disconnectTestDb = async () => {
  await mongoose.disconnect();
  await memoryServer?.stop();
};

/** Empties every collection so each test starts from a known state. */
export const clearTestDb = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
};
