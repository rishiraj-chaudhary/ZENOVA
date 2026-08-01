import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import User from "../../models/user.js";
import {
  authenticateUser,
  findOrCreateSpotifyUser,
  linkSpotifyAccount,
} from "../../services/authService.js";
import { hashPassword } from "../../utils/passwordUtils.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const spotifyProfile = (overrides = {}) => ({
  spotifyId: "spotify-user-1",
  email: "listener@example.com",
  displayName: "Listener",
  ...overrides,
});

describe("signing in with Spotify", () => {
  it("creates a ZENOVA account the first time", async () => {
    const { user, created } = await findOrCreateSpotifyUser(spotifyProfile());

    expect(created).toBe(true);
    expect(user.email).toBe("listener@example.com");
    expect(user.name).toBe("Listener");

    // A Spotify account has no ZENOVA password, and the model must not demand
    // one — inventing a random hash would leave a credential nobody can use.
    const stored = await User.findById(user._id).select("+password");
    expect(stored.password).toBeUndefined();
    expect(stored.spotifyId).toBe("spotify-user-1");
  });

  it("returns the same account on every subsequent sign-in", async () => {
    const first = await findOrCreateSpotifyUser(spotifyProfile());
    const second = await findOrCreateSpotifyUser(spotifyProfile());

    expect(second.created).toBe(false);
    expect(second.user._id.toString()).toBe(first.user._id.toString());
    expect(await User.countDocuments({})).toBe(1);
  });

  it("matches on the Spotify id, not on a changed email", async () => {
    const first = await findOrCreateSpotifyUser(spotifyProfile());

    // People change their Spotify email; it is not the identity.
    const again = await findOrCreateSpotifyUser(
      spotifyProfile({ email: "new-address@example.com" })
    );

    expect(again.user._id.toString()).toBe(first.user._id.toString());
    expect(await User.countDocuments({})).toBe(1);
  });

  it("falls back to the email local part when Spotify sends no display name", async () => {
    const { user } = await findOrCreateSpotifyUser(
      spotifyProfile({ displayName: null })
    );

    expect(user.name).toBe("listener");
  });

  it("refuses when Spotify shares no email", async () => {
    await expect(
      findOrCreateSpotifyUser(spotifyProfile({ email: null }))
    ).rejects.toThrow(/email/i);

    expect(await User.countDocuments({})).toBe(0);
  });

  it("will not hand over an existing password account that shares the email", async () => {
    await User.create({
      name: "Original",
      email: "listener@example.com",
      password: await hashPassword("hunter2secure"),
    });

    // ZENOVA does not verify addresses at registration, so auto-linking by
    // email would be a pre-hijacking hole: register with someone else's
    // address, wait for them to sign in with Spotify, receive their account.
    await expect(findOrCreateSpotifyUser(spotifyProfile())).rejects.toThrow(
      /already uses that email/i
    );

    const original = await User.findOne({ email: "listener@example.com" });
    expect(original.spotifyId).toBeUndefined();
    expect(original.name).toBe("Original");
  });

  it("lets a signed-in user attach Spotify to their own account", async () => {
    const account = await User.create({
      name: "Original",
      email: "listener@example.com",
      password: await hashPassword("hunter2secure"),
    });

    const { user } = await linkSpotifyAccount({
      userId: account._id,
      spotifyId: "spotify-user-1",
    });

    expect(user._id.toString()).toBe(account._id.toString());

    // And from then on that Spotify account signs into it.
    const signedIn = await findOrCreateSpotifyUser(spotifyProfile());
    expect(signedIn.created).toBe(false);
    expect(signedIn.user._id.toString()).toBe(account._id.toString());
  });

  it("refuses to link a Spotify account already claimed by someone else", async () => {
    const owner = await User.create({
      name: "Owner",
      email: "owner@example.com",
      spotifyId: "spotify-user-1",
    });
    const other = await User.create({
      name: "Other",
      email: "other@example.com",
      password: await hashPassword("hunter2secure"),
    });

    await expect(
      linkSpotifyAccount({ userId: other._id, spotifyId: "spotify-user-1" })
    ).rejects.toThrow(/already linked/i);

    expect((await User.findById(owner._id)).spotifyId).toBe("spotify-user-1");
    expect((await User.findById(other._id)).spotifyId).toBeUndefined();
  });

  it("does not let a passwordless account be signed into with a password", async () => {
    const { user } = await findOrCreateSpotifyUser(spotifyProfile());

    // A missing hash must be a rejection, not a comparison against undefined.
    await expect(
      authenticateUser({ email: user.email, password: "anything" })
    ).rejects.toThrow(/invalid credentials/i);
  });

  it("keeps the unique index off password accounts, which all lack a spotifyId", async () => {
    await User.create({
      name: "One",
      email: "one@example.com",
      password: await hashPassword("hunter2secure"),
    });

    // A non-sparse unique index would reject the second null.
    await expect(
      User.create({
        name: "Two",
        email: "two@example.com",
        password: await hashPassword("hunter2secure"),
      })
    ).resolves.toBeTruthy();
  });
});
