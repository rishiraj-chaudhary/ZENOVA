/**
 * Checks that the numbers the assistant stated are numbers it was actually told.
 *
 * This is the most distinctive control in the system, and it is distinctive
 * because of what ZENOVA is: the claims are values from its own database, so
 * verification is arithmetic rather than an opinion. Most groundedness checking
 * asks a second model whether the first was right. This re-derives the value.
 *
 * The contract: any sentence containing a number about the user's own history
 * carries a `[ref:N]` marker naming the step whose output it came from. The
 * verifier pulls that step's recorded result and looks for the number in it.
 */

/** Numbers that are almost never claims — small counts, years, list positions. */
const isTrivial = (value) => Number.isInteger(value) && Math.abs(value) <= 1;

const REF_PATTERN = /\[ref:(\d+)\]/g;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

/** Every number anywhere inside a recorded tool result. */
export const numbersIn = (value, found = new Set(), depth = 0) => {
  if (depth > 8 || value == null) return found;

  if (typeof value === "number") {
    found.add(Number(value.toFixed(2)));
    return found;
  }

  if (typeof value === "string") {
    for (const match of value.match(NUMBER_PATTERN) ?? []) {
      found.add(Number(Number.parseFloat(match).toFixed(2)));
    }
    return found;
  }

  if (typeof value === "object") {
    for (const child of Object.values(value)) numbersIn(child, found, depth + 1);
  }

  return found;
};

/**
 * Splits a response into sentences carrying a reference, and checks each.
 *
 * A sentence with a number and no reference is unverifiable, which is itself a
 * finding — the model was asked to cite and did not.
 */
export const verifyClaims = (response, stepsByIndex) => {
  const sentences = response
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const claims = [];

  for (const sentence of sentences) {
    const numbers = (sentence.replace(REF_PATTERN, "").match(NUMBER_PATTERN) ?? [])
      .map((raw) => Number(Number.parseFloat(raw).toFixed(2)))
      .filter((value) => !isTrivial(value));

    if (numbers.length === 0) continue;

    const refs = [...sentence.matchAll(REF_PATTERN)].map((match) => Number(match[1]));

    if (refs.length === 0) {
      claims.push({ sentence, verified: false, reason: "no reference given" });
      continue;
    }

    const available = new Set();
    for (const ref of refs) {
      const step = stepsByIndex.get(ref);
      if (step) numbersIn(step.output, available);
    }

    const unsupported = numbers.filter((value) => !available.has(value));

    claims.push({
      sentence,
      verified: unsupported.length === 0,
      reason: unsupported.length ? `not in the cited result: ${unsupported.join(", ")}` : null,
      unsupported,
    });
  }

  const verified = claims.filter((claim) => claim.verified).length;

  return {
    claims,
    total: claims.length,
    verified,
    // Null rather than 1 when there was nothing to check: a response with no
    // numeric claims is not 100% verified, it is unverified and fine.
    rate: claims.length === 0 ? null : verified / claims.length,
  };
};

/** Removes the citation markers before the text reaches a person. */
export const stripReferences = (response) => response.replace(REF_PATTERN, "").replace(/\s{2,}/g, " ").trim();

/** Drops sentences the verifier could not support, rather than asserting them. */
export const stripUnverified = (response, result) => {
  const bad = new Set(result.claims.filter((claim) => !claim.verified).map((c) => c.sentence));
  if (bad.size === 0) return stripReferences(response);

  const kept = response
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !bad.has(sentence));

  return stripReferences(kept.join(" "));
};
