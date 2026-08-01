import { faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import RecommendationCard from "../RecommendationCard.jsx";
import SessionCheckIn from "../SessionCheckIn.jsx";

const RecommendationPanel = ({
  recommendations,
  curated,
  moodColors,
  mood,
  sessionId,
  checkInPhase,
  autoplayEnabled,
  currentPlayingIndex,
  onToggleAutoplay,
  onShuffle,
  onSaveAll,
  onAddToPlaylist,
  onTrackEnded,
  onPlay,
  hasListened,
  onBeforeRated,
  onAfterRated,
}) => (
  <aside className="flex h-full flex-col border-l border-white/10 bg-white/5">
    {curated && (
      <p className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
        Personalised picks aren&apos;t available right now, so these are general
        suggestions rather than a response to what you said.
      </p>
    )}

    <div className="flex items-center justify-between border-b border-white/10 p-4">
      <h2 className="font-light text-white">
        {curated ? "General suggestions" : "Recommendations"}
        <span className="ml-2 text-xs text-gray-400">{recommendations.length}</span>
      </h2>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleAutoplay}
          aria-pressed={autoplayEnabled}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
            autoplayEnabled
              ? "border-transparent bg-indigo-500 text-white"
              : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          <i className="fa-solid fa-forward-step" aria-hidden="true" />
          Autoplay
        </button>

        <button
          type="button"
          onClick={onShuffle}
          aria-label="Shuffle recommendations"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20"
        >
          <FontAwesomeIcon icon={faShuffle} className="text-sm" />
        </button>
      </div>
    </div>

    <div className="flex-grow space-y-4 overflow-y-auto p-4">
      {sessionId && checkInPhase === "before" && (
        <SessionCheckIn
          sessionId={sessionId}
          phase="before"
          onComplete={onBeforeRated}
          onSkip={onBeforeRated}
        />
      )}

      <button
        type="button"
        onClick={onSaveAll}
        className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <i className="fa-solid fa-bookmark mr-2" aria-hidden="true" />
        Save all {recommendations.length} to a playlist
      </button>

      {/* Asked only once a track has been played, so the rating reflects
          something actually heard rather than a screen that was looked at. */}
      {sessionId && checkInPhase === "listening" && hasListened && (
        <SessionCheckIn
          sessionId={sessionId}
          phase="after"
          onComplete={onAfterRated}
          onSkip={onAfterRated}
        />
      )}

      {recommendations.map((song, index) => (
        <RecommendationCard
          key={song.musicId ?? `${song.title}-${index}`}
          index={index}
          song={song}
          moodColors={moodColors}
          sessionId={sessionId}
          moodAtTime={mood}
          onAddToPlaylist={onAddToPlaylist}
          isCurrentlyPlaying={index === currentPlayingIndex}
          autoplayEnabled={autoplayEnabled}
          onTrackEnded={() => onTrackEnded(index)}
          onPlay={() => onPlay(index)}
        />
      ))}
    </div>
  </aside>
);

export default RecommendationPanel;
