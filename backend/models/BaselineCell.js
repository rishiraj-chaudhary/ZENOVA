import mongoose from "mongoose";

/**
 * What mood change looks like *without* a good recommendation.
 *
 * The ledger records that someone rated 2, listened, and rated 4, and credits
 * the whole +2 to the song. But a person who feels awful enough to open a
 * wellbeing app is at a low point, and low points are followed by recovery
 * whether or not anything intervenes. Regression to the mean, natural recovery
 * and the demand effect of having chosen to do something about it all push the
 * delta up.
 *
 * This is the counterfactual: the same cell — starting mood, hour, weekday —
 * measured from sessions where the recommendation carried no signal, plus
 * check-in pairs where nothing was listened to at all. `lift = delta - baseline`
 * is then an estimate of what the *song* did, rather than what the day did.
 *
 * Running sums, updated with atomic `$inc`, exactly like SongEffect — so
 * concurrent sessions cannot lose an observation.
 */
const baselineCellSchema = new mongoose.Schema({
  startingMood: { type: Number, required: true, min: 1, max: 5 },

  /** In the user's own timezone; a baseline keyed to UTC hours is meaningless. */
  hourOfDay: { type: Number, required: true, min: 0, max: 23 },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },

  /**
   * Where the observation came from.
   *
   * `randomized` is the control arm and is the only unbiased source.
   * `no_listen` is check-in pairs with no session between them — a free
   * observational control, weaker because nobody assigned it, and labelled so
   * it can never be silently averaged into the randomized estimate.
   */
  source: {
    type: String,
    enum: ["randomized", "no_listen"],
    required: true,
  },

  observations: { type: Number, default: 0 },
  sumDelta: { type: Number, default: 0 },
  sumSquaredDelta: { type: Number, default: 0 },

  updatedAt: { type: Date, default: Date.now },
});

baselineCellSchema.index(
  { startingMood: 1, hourOfDay: 1, dayOfWeek: 1, source: 1 },
  { unique: true }
);

export default mongoose.model("BaselineCell", baselineCellSchema);
