import { describe, expect, it } from "vitest";
import {
  CRISIS_RESOURCES,
  EMERGENCY_NOTICE,
  MAX_AGE_DAYS,
  getCrisisResources,
  isVerificationStale,
  verificationAgeDays,
} from "../../config/crisisResources.js";

describe("crisis resource registry", () => {
  it("is not overdue for re-verification", () => {
    // Fails once the numbers are older than the review window. A stale helpline
    // is worse than none, so this is a hard gate rather than a reminder.
    expect(isVerificationStale()).toBe(
      false,
      `Helpline numbers were verified ${verificationAgeDays()} days ago (limit ${MAX_AGE_DAYS}). ` +
        "Re-check each against its operator and update VERIFIED_ON."
    );
  });

  it.each(Object.entries(CRISIS_RESOURCES))(
    "%s entries are complete and dialable",
    (region, resources) => {
      expect(resources.length).toBeGreaterThan(0);

      resources.forEach((resource) => {
        expect(resource.name, `${region} entry missing name`).toBeTruthy();
        expect(resource.contact, `${resource.name} missing contact`).toBeTruthy();
        expect(resource.description, `${resource.name} missing description`).toBeTruthy();
        // The UI renders these as links, so an unusable scheme is a dead end.
        expect(resource.url).toMatch(/^(tel:|sms:|https:)/);
      });
    }
  );

  it("always returns resources, whatever the region", () => {
    expect(getCrisisResources("IN").length).toBeGreaterThan(0);
    expect(getCrisisResources("in").length).toBeGreaterThan(0);
    expect(getCrisisResources("ZZ").length).toBeGreaterThan(0);
    expect(getCrisisResources(undefined).length).toBeGreaterThan(0);
    expect(getCrisisResources(null).length).toBeGreaterThan(0);
  });

  it("includes an emergency notice", () => {
    expect(EMERGENCY_NOTICE).toMatch(/emergency/i);
  });
});
