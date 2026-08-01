import mongoose from "mongoose";

/**
 * Coerces an id for use inside an aggregation pipeline.
 *
 * Mongoose casts query filters against the schema, so `find({ userId })` works
 * whether the id is a string or an ObjectId. Aggregation pipelines get no such
 * treatment: `$match: { userId: "65f..." }` compares a string against an
 * ObjectId field, matches nothing, and returns an empty result with no error.
 *
 * That silence is the danger — an aggregation that quietly returns nothing
 * looks exactly like a user who has no data, so a daily cap stops applying or a
 * taste profile comes back blank and nothing anywhere reports a problem.
 */
export const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));

export default toObjectId;
