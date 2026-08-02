import crypto from "crypto";
import mongoose from "mongoose";
import config from "../config/environment.js";

/**
 * A plan the person writes while calm, shown back to them at a hard moment.
 *
 * The evidence-based pattern (Stanley–Brown safety planning) is that a plan
 * authored by the person themselves — their own warning signs, their own coping
 * steps, their own people — is far more use in a crisis than a generic helpline
 * card. This does not replace the helplines; it goes above them.
 *
 * Three rules hold for this collection and nothing else in the codebase needs
 * all three:
 *  - Encrypted at rest. It names real people and real methods of coping.
 *  - Never sent to the model. Not summarised, not embedded, not in context.
 *  - Rendered verbatim. Their words, not a paraphrase — a rewritten coping step
 *    is no longer the thing they agreed would help.
 */
const ALGORITHM = "aes-256-gcm";

/** Derived from the session secret so there is no new key to manage or lose. */
const keyFor = () =>
  crypto.createHash("sha256").update(`safety-plan:${config.session.secret}`).digest();

export const encrypt = (plaintext) => {
  if (!plaintext) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFor(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
};

export const decrypt = (payload) => {
  if (!payload) return null;

  try {
    const [iv, tag, data] = payload.split(".");
    const decipher = crypto.createDecipheriv(ALGORITHM, keyFor(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // A plan that cannot be decrypted must read as absent, never as garbage on
    // a screen someone is looking at in a bad moment.
    return null;
  }
};

const safetyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  /** Ciphertext. Each is a newline-separated list the user wrote. */
  warningSigns: { type: String, default: null },
  copingSteps: { type: String, default: null },
  peopleWhoHelp: { type: String, default: null },
  reasonsToStay: { type: String, default: null },
  safeEnvironment: { type: String, default: null },

  updatedAt: { type: Date, default: Date.now },
});

export const PLAN_FIELDS = [
  "warningSigns",
  "copingSteps",
  "peopleWhoHelp",
  "reasonsToStay",
  "safeEnvironment",
];

export default mongoose.model("SafetyPlan", safetyPlanSchema);
