import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import Gamification from "../../models/Gamification.js";
import MoodEntry from "../../models/MoodEntry.js";
import User from "../../models/user.js";
import { buildMoodInsights } from "../../services/moodInsightsService.js";
import { updateStreak } from "../../services/pointsService.js";
import { dayKey } from "../../utils/dayKey.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

const IST = "Asia/Kolkata"; // UTC+5:30 — no DST, so the arithmetic is stable.

let counter = 0;
const registerUser = async (timeZone) => {
  counter += 1;
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({
      name: `Zoned-${counter}`,
      email: `tz-${counter}-${Date.now()}@example.com`,
      password: "hunter2secure",
      ...(timeZone ? { timeZone } : {}),
    });
  return body.user;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("capturing the user's timezone", () => {
  it("stores what the browser sent", async () => {
    const user = await registerUser(IST);

    expect(user.timeZone).toBe(IST);
    expect((await User.findById(user._id)).timeZone).toBe(IST);
  });

  it("falls back to UTC when none is sent", async () => {
    expect((await registerUser()).timeZone).toBe("UTC");
  });

  it("refuses a zone the platform does not recognise", async () => {
    const user = await registerUser("Mars/Olympus_Mons");

    // Anything else would throw inside Intl on every later day calculation.
    expect(user.timeZone).toBe("UTC");
  });
});

describe("streaks roll over at the user's midnight", () => {
  /**
   * 22:00 UTC is 03:30 the *next* day in India. A check-in then and another the
   * following UTC evening are two distinct Indian days but one UTC day — so a
   * UTC-keyed streak refuses to advance.
   */
  const lateEveningUtc = new Date("2026-03-10T22:00:00.000Z");

  it("treats an Indian-morning visit as a new day", () => {
    const previous = dayKey(new Date("2026-03-10T10:00:00.000Z"), IST); // 15:30 IST, 10 Mar
    const next = dayKey(lateEveningUtc, IST); // 03:30 IST, 11 Mar

    expect(previous).toBe("2026-03-10");
    expect(next).toBe("2026-03-11");
  });

  it("would have counted the same visits as one UTC day", () => {
    // The bug, stated as an assertion: both fall on 10 March in UTC, so a
    // streak keyed to UTC never advanced for a user in a positive offset.
    expect(dayKey(new Date("2026-03-10T10:00:00.000Z"), "UTC")).toBe("2026-03-10");
    expect(dayKey(lateEveningUtc, "UTC")).toBe("2026-03-10");
  });

  it("advances the streak using the caller's zone", async () => {
    const user = await registerUser(IST);
    const yesterdayInIst = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000), IST);

    await Gamification.create({
      userId: user._id,
      currentStreak: 4,
      lastActivityDay: yesterdayInIst,
    });

    expect(await updateStreak(user._id, null, { timeZone: IST })).toBe(5);
  });
});

describe("insights bucket by the user's clock", () => {
  /**
   * Insights only look back `periodDays`, so the instants have to be recent.
   * Built relative to now, at a chosen UTC wall-clock time, and the expected
   * labels are derived with Intl rather than hardcoded — a fixed date would
   * have made these tests expire.
   */
  const recentAt = (daysAgo, utcHour) => {
    const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    at.setUTCHours(utcHour, 0, 0, 0);
    return at;
  };

  const weekdayIn = (date, timeZone) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(date);

  const seed = async (userId, at, count = 6) => {
    for (let i = 0; i < count; i += 1) {
      await MoodEntry.create({
        userId,
        mood: "low",
        intensity: 2,
        source: "check-in",
        recordedAt: at,
      });
    }
  };

  it("files a late-evening Indian check-in under evening, not afternoon", async () => {
    const user = await registerUser(IST);

    // 15:00 UTC is 20:30 IST — "afternoon" by the server's clock, evening by
    // the user's, and the statistic is about the user's day.
    await seed(user._id, recentAt(3, 15));

    const utcView = await buildMoodInsights(user._id, { timeZone: "UTC" });
    const istView = await buildMoodInsights(user._id, { timeZone: IST });

    expect(Object.keys(utcView.moodByTimeOfDay)).toContain("afternoon");
    expect(Object.keys(istView.moodByTimeOfDay)).toContain("evening");
  });

  it("assigns the day of week in the user's zone", async () => {
    const user = await registerUser(IST);

    // 23:00 UTC is 04:30 the next day in India, so the two zones disagree
    // about which weekday this check-in belongs to.
    const at = recentAt(3, 23);
    await seed(user._id, at);

    const utcView = await buildMoodInsights(user._id, { timeZone: "UTC" });
    const istView = await buildMoodInsights(user._id, { timeZone: IST });

    expect(utcView.moodByDayOfWeek.hardest).toBe(weekdayIn(at, "UTC"));
    expect(istView.moodByDayOfWeek.hardest).toBe(weekdayIn(at, IST));
    expect(utcView.moodByDayOfWeek.hardest).not.toBe(istView.moodByDayOfWeek.hardest);
  });

  it("puts the chart series on the same day the statistics use", async () => {
    const user = await registerUser(IST);
    const at = recentAt(3, 23);
    await seed(user._id, at, 1);

    const istView = await buildMoodInsights(user._id, { timeZone: IST });

    // The chart bucketed by UTC date while the weekday came from the server's
    // clock, so the two axes could disagree about which day a point belonged to.
    expect(istView.series.map((point) => point.date)).toContain(dayKey(at, IST));
    expect(dayKey(at, IST)).not.toBe(dayKey(at, "UTC"));
  });
});
