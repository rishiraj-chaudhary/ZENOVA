import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as privacyAPI from "../api/privacyAPI.js";
import { updateConsent, updatePreferences } from "../api/userAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { clearStoredAuth } from "../utils/authStorage.js";

const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

const Section = ({ title, description, children, danger = false }) => (
  <section
    className={`rounded-3xl border p-6 ${
      danger ? "border-red-500/30 bg-red-950/10" : "border-white/10 bg-white/5"
    }`}
  >
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Settings = () => {
  const { user, logout, applyConsent } = useAuth();
  const navigate = useNavigate();

  const [consent, setConsent] = useState(user?.consent?.moodTracking ?? false);
  const [preferences, setPreferences] = useState(user?.preferences?.join(", ") ?? "");
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action, successMessage) => {
    setBusy(true);
    setStatus(null);

    try {
      await action();
      setStatus({ type: "success", message: successMessage });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleConsentChange = (enabled) => {
    setConsent(enabled);
    run(
      async () => {
        await updateConsent(enabled);
        // Everything gated on consent — the daily check-in card most visibly —
        // reads it from the auth context, which was never updated. Turning
        // mood tracking on did nothing until the page was reloaded.
        applyConsent(enabled);
      },
      enabled ? "Mood tracking is on" : "Mood tracking is off — nothing new will be saved"
    );
  };

  const handleDeleteAccount = async () => {
    await run(async () => {
      await privacyAPI.deleteAccount();
      clearStoredAuth();
    }, "Account deleted");

    navigate("/");
  };

  return (
    <main className="min-h-viewport bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-gray-400">{user?.email}</p>
        </header>

        {status && (
          <p
            role="status"
            className={`rounded-2xl p-3 text-sm ${
              status.type === "error"
                ? "bg-red-500/10 text-red-300"
                : "bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {status.message}
          </p>
        )}

        <Section
          title="Music preferences"
          description="Genres and moods that shape your recommendations."
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="preferences" className="sr-only">
              Music preferences
            </label>
            <input
              id="preferences"
              value={preferences}
              onChange={(event) => setPreferences(event.target.value)}
              placeholder="lo-fi, indie, ambient"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 p-3 text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    updatePreferences(
                      preferences.split(",").map((p) => p.trim()).filter(Boolean)
                    ),
                  "Preferences saved"
                )
              }
              className="rounded-xl bg-indigo-500 px-5 py-3 font-medium transition-colors hover:bg-indigo-400 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </Section>

        <Section
          title="Mood tracking"
          description="Your check-ins are health data. They are only stored while this is on."
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => handleConsentChange(event.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-500"
            />
            <span className="text-sm text-gray-300">
              Save my mood check-ins
              <span className="mt-1 block text-xs text-gray-500">
                Turning this off stops new entries immediately. Existing history stays
                until you delete it below.
              </span>
            </span>
          </label>
        </Section>

        <Section
          title="Your data"
          description="Download everything we hold about you, or remove it."
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(privacyAPI.downloadMyData, "Download started")}
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <i className="fa-solid fa-download mr-2" aria-hidden="true" />
              Export my data
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(privacyAPI.deleteWellbeingData, "Mood and listening history deleted")
              }
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              Delete mood &amp; listening history
            </button>
          </div>
        </Section>

        <Section
          danger
          title="Delete account"
          description="Permanent. Removes your account, playlists you own, and all history."
        >
          <label htmlFor="confirm-delete" className="text-sm text-gray-400">
            Type <code className="text-red-300">{DELETE_CONFIRMATION}</code> to confirm
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 p-3 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            />
            <button
              type="button"
              disabled={busy || confirmText !== DELETE_CONFIRMATION}
              onClick={handleDeleteAccount}
              className="rounded-xl bg-red-600 px-5 py-3 font-medium transition-colors hover:bg-red-500 disabled:opacity-40"
            >
              Delete forever
            </button>
          </div>
        </Section>

        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
          className="w-full rounded-xl border border-white/15 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5"
        >
          Log out
        </button>
      </div>
    </main>
  );
};

export default Settings;
