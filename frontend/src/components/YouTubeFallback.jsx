/**
 * Playback path for songs with no Spotify track, and for listeners without
 * Spotify Premium.
 *
 * Spotify's embed only plays a short preview for non-Premium accounts, and the
 * Web Playback SDK requires Premium outright — which would leave most students,
 * the stated target user, unable to hear a full song. A YouTube search link is
 * the honest fallback until a video id can be resolved server-side.
 */
const YouTubeFallback = ({ title, artist, albumArt, reason }) => {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${title} ${artist} official audio`
  )}`;

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
        {reason ?? "Not available on Spotify — listen on YouTube instead."}
      </p>

      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
      >
        <i className="fa-brands fa-youtube" aria-hidden="true" />
        Play on YouTube
      </a>
    </div>
  );
};

export default YouTubeFallback;
