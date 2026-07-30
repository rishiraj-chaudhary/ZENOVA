import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let memoryServer;

export const connectTestDb = async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
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
