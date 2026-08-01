import { useEffect, useRef, useState } from "react";

/**
 * Playback path for songs with no Spotify track, and for listeners without
 * Spotify Premium.
 *
 * Spotify's embed only plays a short preview for non-Premium accounts, and the
 * Web Playback SDK requires Premium outright — which would leave most students,
 * the stated target user, unable to hear a song at all.
 *
 * Two things are offered, in order of usefulness: a 30-second preview that
 * plays here, and a link out to YouTube for the full track. The preview comes
 * from iTunes because Spotify stopped publishing preview URLs, which is why
 * every song in the catalogue had a dead audio control.
 */
const YouTubeFallback = ({
  title,
  artist,
  albumArt,
  reason,
  watchUrl,
  previewUrl,
  onPreviewEnded,
}) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // A direct link when the resolver found one; a search only as a last resort.
  const isDirectLink = /youtu\.?be/i.test(watchUrl ?? "") && !/results\?/.test(watchUrl ?? "");
  const linkUrl =
    watchUrl && /youtu\.?be/i.test(watchUrl)
      ? watchUrl
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${title} ${artist} official audio`
        )}`;

  // Stop playing if the card is unmounted mid-preview.
  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="rounded-lg bg-slate-800 p-3">
      <div className="mb-2 flex items-center gap-2">
        {albumArt ? (
          <img
            src={albumArt}
            alt=""
            className="h-10 w-10 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-700">
            <i className="fa-solid fa-music text-gray-400" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="truncate text-xs text-gray-400">{artist}</p>
        </div>
      </div>

      <p className="mb-2 text-xs text-gray-400">
        {reason ??
          (previewUrl
            ? "Not on Spotify — here's a 30-second preview, or hear it in full on YouTube."
            : "Not available on Spotify — listen on YouTube instead.")}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {previewUrl && (
          <>
            <button
              type="button"
              onClick={togglePreview}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <i
                className={`fa-solid ${playing ? "fa-pause" : "fa-play"}`}
                aria-hidden="true"
              />
              {playing ? "Pause preview" : "Play 30s preview"}
            </button>

            <audio
              ref={audioRef}
              src={previewUrl}
              preload="none"
              onEnded={() => {
                setPlaying(false);
                onPreviewEnded?.();
              }}
              onPause={() => setPlaying(false)}
            />
          </>
        )}

        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <i className="fa-brands fa-youtube" aria-hidden="true" />
          {isDirectLink ? "Play on YouTube" : "Find on YouTube"}
        </a>
      </div>
    </div>
  );
};

export default YouTubeFallback;
