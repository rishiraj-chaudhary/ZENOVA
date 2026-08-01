const SDK_SRC = "https://open.spotify.com/embed/iframe-api/v1";

let loader = null;

/**
 * Loads Spotify's Embed iFrame API once and resolves with the controller
 * factory.
 *
 * This is the piece autoplay was missing. A plain `<iframe src=".../embed/track/ID">`
 * posts no usable messages to its parent, so the old listener — waiting on a
 * `playback_update` frame from open.spotify.com — could never fire, and a
 * finished track never advanced to the next one. Only the iFrame API emits
 * those events, and only a controller can start playback programmatically.
 *
 * Spotify calls a global `onSpotifyIframeApiReady` exactly once, so the promise
 * is memoised and every player shares it.
 */
export const loadSpotifyIframeApi = () => {
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) {
      resolve(window.SpotifyIframeApi);
      return;
    }

    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      resolve(api);
    };

    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => {
      // Reset so a later mount can retry rather than waiting on a dead promise.
      loader = null;
      reject(new Error("Spotify embed API failed to load"));
    };

    document.head.appendChild(script);
  });

  return loader;
};

/** How close to the end counts as finished, in milliseconds. */
const END_TOLERANCE_MS = 1500;

/** A track has to get at least this far in before its reset means "ended". */
const PLAYED_ENOUGH = 0.5;

/**
 * Decides whether a playback update means the track finished.
 *
 * Spotify reports the end in one of two ways depending on client and track:
 * the position walks up to the duration, or playback pauses and the position
 * snaps back to zero. Only the second needs guarding — a user who pauses and
 * drags back to the start would otherwise look identical to a finished track,
 * so it only counts once the track has actually played most of the way.
 */
export const isTrackFinished = ({ position, duration, isPaused }, furthestPlayed) => {
  if (!duration || duration <= 0) return false;

  const reachedEnd = position > 0 && duration - position <= END_TOLERANCE_MS;
  const resetAfterPlaying =
    isPaused && position === 0 && furthestPlayed / duration >= PLAYED_ENOUGH;

  return reachedEnd || resetAfterPlaying;
};
