import mongoose from "mongoose";

/**
 * The conversation, held server-side.
 *
 * The browser used to post the whole history back on every turn, which meant a
 * user could rewrite what they had previously said and what the assistant had
 * previously replied. The untrusted-content boundary does not help there: the
 * content arrives *inside* the region the model is told to treat as a real
 * transcript, so an edited history is indistinguishable from a true one.
 *
 * Capped, because a conversation is a rolling window and an unbounded array in
 * a document is a document that eventually stops loading.
 */
const MAX_TURNS = 40;

const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    at: { type: Date, default: Date.now },
    /** The run that produced an assistant turn, so a reply is traceable. */
    runId: { type: mongoose.Schema.Types.ObjectId, ref: "AgentRun", default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  turns: { type: [turnSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

conversationSchema.statics.appendTurn = function appendTurn(userId, turn) {
  return this.findOneAndUpdate(
    { userId },
    {
      $push: { turns: { $each: [turn], $slice: -MAX_TURNS } },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export { MAX_TURNS };
export default mongoose.model("Conversation", conversationSchema);
