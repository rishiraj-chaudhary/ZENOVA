import mongoose from "mongoose";

/**
 * The structured model of a person, promoted from repeated evidence.
 *
 * Every entry carries confidence, where it came from, and when it was last
 * confirmed — which is the honest answer to "how does it avoid inventing a
 * personality". It does not infer from one remark: promotion needs two
 * independent episodic items agreeing. And a belief that stops being
 * reconfirmed decays out of the context budget rather than being asserted
 * forever.
 */
const beliefSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 200 },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },

    /** The episodic items this was drawn from, so a user can see the evidence. */
    sourceMemoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MemoryItem" }],

    firstSeen: { type: Date, default: Date.now },
    lastConfirmed: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userModelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  recurringStressors: { type: [beliefSchema], default: [] },
  copingStrategiesThatWorked: { type: [beliefSchema], default: [] },
  /** Things they have said they do not want. Weighted heavily; rarely decays. */
  avoid: { type: [beliefSchema], default: [] },

  communicationStyle: { type: beliefSchema, default: null },

  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("UserModel", userModelSchema);
