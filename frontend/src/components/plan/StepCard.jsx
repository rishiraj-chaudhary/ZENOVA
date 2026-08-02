import { useEffect, useState } from "react";
import * as planAPI from "../../api/planAPI.js";
import * as wellbeingAPI from "../../api/wellbeingAPI.js";
import { extractSpotifyTrackId } from "../../utils/spotify.js";
import MoodScale from "../MoodScale.jsx";
import SpotifyPlayer from "../SpotifyPlayer.jsx";

/**
 * Today's step, done here.
 *
 * The plan used to describe the work and then send the person to the chat to
 * organise it themselves — which is handing the job back. This runs the whole
 * thing: what to do and why, the songs already chosen from what has measured
 * well for them, the before-rating, the listening, and the after-rating.
 */
const EVIDENCE_NOTE = {
  established: "measured to help",
  provisional: "early signal",
  exploring: "a test — we don't know yet",
  unmeasured: "not measured yet",
};

const StepCard = ({ step, onDone }) => {
  const [guidance, setGuidance] = useState(null);
  const [phase, setPhase] = useState("brief");
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!step) return;

    setPhase("brief");
    setSessionId(null);
    setError(null);

    planAPI
      .fetchStepGuidance(step._id)
      .then((result) => setGuidance(result.guidance))
      .catch((loadError) => setError(loadError.message));
  }, [step]);

  const begin = async (moodBefore) => {
    setBusy(true);
    try {
      const result = await planAPI.beginStep({ stepId: step._id, moodBefore });
      setSessionId(result.sessionId);
      setPhase("listening");
    } catch (beginError) {
      setError(beginError.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async (moodAfter) => {
    setBusy(true);
    try {
      await wellbeingAPI.completeSession({ sessionId, moodAfter });
      setPhase("done");
      onDone?.();
    } catch (finishError) {
      setError(finishError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!step || !guidance) return null;

  if (guidance.kind === "rest") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-medium text-white">{guidance.title}</p>
        <p className="mt-1 text-sm text-gray-400">{guidance.purpose}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">Today</p>
      <h2 className="mt-1 text-lg font-semibold text-white">{guidance.title}</h2>
      <p className="mt-1 text-sm text-gray-400">{guidance.purpose}</p>

      {phase === "brief" && (
        <>
          {/* What to actually do, not where to go and do it. */}
          <ul className="mt-4 space-y-1.5">
            {guidance.howTo.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-gray-300">
                <span className="text-gray-600" aria-hidden="true">
                  ·
                </span>
                {line}
              </li>
            ))}
          </ul>

          {guidance.songs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                What&apos;s queued
              </p>
              <ul className="mt-2 space-y-1.5">
                {guidance.songs.map((song) => (
                  <li key={song.musicId} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="text-gray-200">{song.title}</span>
                    <span className="text-gray-500">{song.artist}</span>
                    {/* An exploration pick is never presented as a considered one. */}
                    <span className="ml-auto shrink-0 text-[0.65rem] text-gray-500">
                      {EVIDENCE_NOTE[song.evidence] ?? ""}
                      {song.sessions > 0 && ` · ${song.sessions} sessions`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-xl bg-black/20 p-4">
            <p className="text-center text-sm text-gray-300">
              First — how are you right now?
            </p>
            <div className="mt-3">
              <MoodScale
                value={null}
                onChange={begin}
                name="plan-before"
                disabled={busy}
                legend="How are you feeling before this session?"
              />
            </div>
          </div>
        </>
      )}

      {phase === "listening" && (
        <>
          <div className="mt-4 space-y-3">
            {guidance.songs.slice(0, 2).map((song) => {
              const trackId = extractSpotifyTrackId(song.spotifyUri);
              return trackId ? (
                <SpotifyPlayer
                  key={song.musicId}
                  trackId={trackId}
                  title={song.title}
                  artist={song.artist}
                  albumArt={song.albumArt}
                  previewUrl={song.previewUrl}
                />
              ) : null;
            })}
          </div>

          <div className="mt-5 rounded-xl bg-black/20 p-4">
            <p className="text-center text-sm text-gray-300">
              When you&apos;re done — how are you now?
            </p>
            <div className="mt-3">
              <MoodScale
                value={null}
                onChange={finish}
                name="plan-after"
                disabled={busy}
                legend="How are you feeling after this session?"
              />
            </div>
          </div>
        </>
      )}

      {phase === "done" && (
        <p className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Recorded. That&apos;s what makes the next suggestion better than this one.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
};

export default StepCard;
