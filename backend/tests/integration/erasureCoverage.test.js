import { readFileSync } from "fs";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { deleteAccount, exportUserData } from "../../services/privacyService.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

// Importing the app registers every model the running server would register,
// which is what makes the enumeration below meaningful rather than a check of
// whatever this file happens to import.
buildTestApp();

/**
 * Fields that key a document to a person. `Playlist.collaborators` counts:
 * membership is personal data even though the playlist is not solely theirs.
 */
const USER_KEYED = [
  "userId",
  "invitedUserId",
  "invitedByUserId",
  "collaborators",
  "entries.userId",
];

/**
 * Collections that are deliberately not swept, with the reason.
 *
 * Anything added here needs a justification that survives being read out loud
 * to someone exercising their right to erasure.
 */
const EXEMPT = {
  // Catalogue metadata about songs, not about people.
  MusicResource: "no user-keyed field; catalogue only",
  SongEffect:
    "anonymous aggregate — no userId, and individual contributions are not " +
    "recoverable from the running sums",
  Badge: "the badge catalogue itself; UserBadge holds the per-user awards",
  TaskLock: "ephemeral scheduling locks, no user data",
  BaselineCell:
    "counterfactual aggregate — no userId, and an individual's contribution " +
    "is not recoverable from the running sums",
};

const isUserKeyed = (model) => {
  const paths = Object.keys(model.schema.paths);
  return USER_KEYED.some((field) => paths.includes(field));
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("every collection that stores a person is erasable", () => {
  it("sweeps every user-keyed collection in deleteAccount", () => {
    const source = privacySource();

    const escaped = Object.values(mongoose.models)
      .filter(isUserKeyed)
      .map((model) => model.modelName)
      .filter((name) => !EXEMPT[name])
      .filter((name) => !new RegExp(`\\b${name}\\b`).test(source));

    // This is not hypothetical. Before this test existed, deleteAccount left
    // PointAward, RefreshToken, PlaylistInvitation and cached leaderboard rows
    // behind — a user who deleted their account kept a live refresh token and
    // their name on a public board.
    expect(escaped).toEqual([]);
  });

  it("leaves nothing behind for a user who has touched every collection", async () => {
    const userId = new mongoose.Types.ObjectId();

    // Seed one document in every user-keyed collection, using each schema's own
    // required fields, so a new collection is covered the day it is added
    // rather than the day someone remembers to extend this test.
    const seeded = [];
    for (const model of Object.values(mongoose.models)) {
      if (!isUserKeyed(model) || EXEMPT[model.modelName]) continue;

      const doc = await seedFor(model, userId);
      if (doc) seeded.push(model.modelName);
    }

    expect(seeded.length).toBeGreaterThan(3);

    await deleteAccount(userId).catch(() => {
      // The User document itself may not exist; the sweep still has to run.
    });

    const survivors = [];
    for (const model of Object.values(mongoose.models)) {
      if (!isUserKeyed(model) || EXEMPT[model.modelName]) continue;

      const remaining = await model.countDocuments(ownershipFilter(model, userId));
      if (remaining > 0) survivors.push(`${model.modelName} (${remaining})`);
    }

    expect(survivors).toEqual([]);
  });

  it("offers every user-keyed collection in the export", async () => {
    const { default: User } = await import("../../models/user.js");
    const user = await User.create({
      name: "Exportee",
      email: `export-${Date.now()}@example.com`,
      password: "hunter2secure",
    });

    const exported = await exportUserData(user._id);

    // Not a per-collection assertion — the export is a curated document, not a
    // dump — but it must at least acknowledge each family of data.
    for (const key of [
      "account",
      "moodHistory",
      "songFeedback",
      "sessionOutcomes",
      "playlists",
      "progress",
      "badges",
    ]) {
      expect(exported).toHaveProperty(key);
    }
  });
});

/** The erasure source, read once so the regex check is against real code. */
function privacySource() {
  return readFileSync(new URL("../../services/privacyService.js", import.meta.url), "utf8");
}

/** The filter that finds this model's documents for a given person. */
function ownershipFilter(model, userId) {
  const paths = Object.keys(model.schema.paths);
  const clauses = USER_KEYED.filter((field) => paths.includes(field)).map((field) => ({
    [field]: userId,
  }));

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/** Creates one minimal valid document for this model, owned by userId. */
async function seedFor(model, userId) {
  const paths = model.schema.paths;
  const doc = {};

  for (const [name, path] of Object.entries(paths)) {
    if (name === "_id" || name === "__v") continue;

    if (USER_KEYED.includes(name)) {
      doc[name] = path.instance === "Array" ? [userId] : userId;
      continue;
    }

    if (!path.isRequired) continue;

    doc[name] = defaultForPath(path);
  }

  try {
    return await model.create(doc);
  } catch {
    // A model with constraints this generic seeder cannot satisfy is skipped
    // rather than failing the run; the static check above still covers it.
    return null;
  }
}

function defaultForPath(path) {
  switch (path.instance) {
    case "String":
      return path.enumValues?.length ? path.enumValues[0] : "seed";
    case "Number":
      return 1;
    case "Date":
      return new Date();
    case "Boolean":
      return false;
    case "ObjectId":
      return new mongoose.Types.ObjectId();
    case "Array":
      return [];
    default:
      return "seed";
  }
}
