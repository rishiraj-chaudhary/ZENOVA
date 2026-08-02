import SafetyPlan, { PLAN_FIELDS, decrypt, encrypt } from "../models/SafetyPlan.js";

/**
 * Reading and writing the plan.
 *
 * Everything crosses the encryption boundary here, so no caller ever holds
 * ciphertext and no caller ever accidentally persists plaintext.
 */
const MAX_FIELD_LENGTH = 2000;

export const savePlan = async (userId, fields) => {
  const update = { updatedAt: new Date() };

  for (const field of PLAN_FIELDS) {
    if (!(field in fields)) continue;

    const value = typeof fields[field] === "string" ? fields[field].trim() : "";
    update[field] = value ? encrypt(value.slice(0, MAX_FIELD_LENGTH)) : null;
  }

  await SafetyPlan.findOneAndUpdate({ userId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  return getPlan(userId);
};

export const getPlan = async (userId) => {
  const plan = await SafetyPlan.findOne({ userId }).lean();
  if (!plan) return null;

  const decrypted = Object.fromEntries(
    PLAN_FIELDS.map((field) => [field, decrypt(plan[field])])
  );

  const hasContent = Object.values(decrypted).some(Boolean);

  return hasContent ? { ...decrypted, updatedAt: plan.updatedAt } : null;
};

export const deletePlan = (userId) => SafetyPlan.deleteOne({ userId });

/**
 * What to show at an elevated or crisis moment.
 *
 * The plan first, verbatim, then the helplines. If there is no plan the
 * helplines stand alone exactly as before — this is strictly additive, and a
 * missing plan must never make the response worse than it was.
 */
export const planForCrisis = async (userId) => {
  const plan = await getPlan(userId);
  if (!plan) return null;

  return {
    // Only the parts they filled in. Empty headings in a crisis are noise.
    sections: [
      { heading: "You said these are your warning signs", body: plan.warningSigns },
      { heading: "Things you said help", body: plan.copingSteps },
      { heading: "People you said you could reach", body: plan.peopleWhoHelp },
      { heading: "Your reasons to stay", body: plan.reasonsToStay },
      { heading: "Making things safer", body: plan.safeEnvironment },
    ].filter((section) => section.body),
    writtenAt: plan.updatedAt,
  };
};
