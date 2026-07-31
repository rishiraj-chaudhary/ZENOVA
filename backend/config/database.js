import mongoose from "mongoose";
import logger from "../utils/logger.js";
import config from "./environment.js";

const connectDB = async () => {
  mongoose.set("strictQuery", true);

  // Index builds are triggered lazily and asynchronously by autoIndex, leaving a
  // window at startup where unique constraints are not yet enforced. Several
  // writes depend on those constraints for correctness — concurrent upserts on
  // Gamification insert duplicates rather than conflicting when the unique index
  // on userId is missing — so indexes are built explicitly before serving.
  mongoose.set("autoIndex", false);

  await mongoose.connect(config.mongoUri);
  logger.info("MongoDB connected");

  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );
  logger.info("indexes ensured", { models: Object.keys(mongoose.models).length });
};

export default connectDB;
