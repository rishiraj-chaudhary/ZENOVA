import mongoose from "mongoose";

/**
 * One remembered exchange.
 *
 * A short summary of a turn-pair rather than the transcript, with the mood the
 * person was in when they said it. That last field is the one that makes
 * retrieval useful rather than merely possible: when someone is low, what they
 * said *the last time they were low* is far more relevant than what they said
 * last Tuesday about a concert.
 *
 * The embedding is stored on the document and compared in process. Atlas Vector
 * Search is the right call only if the whole pipeline runs on Atlas — an
 * Atlas-only dependency is invisible until it fails in one environment — and a
 * cosine over one person's few hundred memories is genuinely adequate here.
 */
const memoryItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: "AgentRun", default: null },

  summary: { type: String, required: true, maxlength: 400 },
  embedding: { type: [Number], default: [] },

  /** What the person was feeling at the time, for context-matched retrieval. */
  moodAtTime: { type: String, default: null },
  moodValence: { type: Number, default: null, min: 1, max: 5 },

  createdAt: { type: Date, default: Date.now },
});

memoryItemSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("MemoryItem", memoryItemSchema);
