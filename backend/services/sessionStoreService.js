import mongoose from "mongoose";
import logger from "../utils/logger.js";

/** Where connect-mongo keeps sessions — must match the store config in server.js. */
const SESSION_COLLECTION = "sessions";

/**
 * Destroys every express session belonging to a user.
 *
 * "Sign out on all devices" revoked refresh tokens and stopped there, but
 * authMiddleware accepts an established session as credentials in its own
 * right, so every other device stayed fully signed in while the response said
 * they had been signed out. That is the one promise a security control of this
 * kind has to keep.
 *
 * connect-mongo stores the session payload as a JSON string, so the user id is
 * matched textually rather than with a field query.
 */
export const destroySessionsForUser = async (userId) => {
  if (!userId) return 0;

  try {
    const { deletedCount } = await mongoose.connection
      .collection(SESSION_COLLECTION)
      .deleteMany({ session: { $regex: userId.toString() } });

    logger.info("sessions destroyed", { count: deletedCount });
    return deletedCount;
  } catch (error) {
    // Never fail the sign-out itself; the refresh tokens are already revoked.
    logger.error("could not destroy sessions", { detail: error.message });
    return 0;
  }
};

export default destroySessionsForUser;
