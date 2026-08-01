import { useEffect, useRef, useState } from "react";
import { extractSpotifyTrackId } from "../utils/spotify.js";
import { isTrackFinished, loadSpotifyIframeApi } from "../utils/spotifyIframeApi.js";
import YouTubeFallback from "./YouTubeFallback.jsx";

/**
 * Spotify embed player driven by the Embed iFrame API.
 *
 * The previous version rendered a bare `<iframe>` and listened for
 * `playback_update` messages on `window`. A bare embed iframe never sends
 * those — they come from the iFrame API, which was never loaded — so the
 * track-end callback could not fire and autoplay never advanced past the first
 * song. `&autoplay=1` on the iframe URL did not help either: browsers block
 * autoplay in a cross-origin frame, so the next track just sat there.
 *
 * With a controller the end of a track is observable, and the next one can be
 * started programmatically — allowed, because the user's first play was a real
 * gesture on this page.
 */
function SpotifyPlayer({
  trackId,
  title,
  artist,
  albumArt,
  previewUrl,
  onTrackEnded,
  autoplayEnabled,
  isCurrentlyPlaying,
}) {
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);

  const hostRef = useRef(null);
  const controllerRef = useRef(null);
  const endedRef = useRef(false);
  const furthestPlayedRef = useRef(0);

  // Read through refs inside the listener, so a changed handler identity does
  // not tear the controller down and rebuild it mid-song.
  const onTrackEndedRef = useRef(onTrackEnded);
  const autoplayRef = useRef(autoplayEnabled);
  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
    autoplayRef.current = autoplayEnabled;
  }, [onTrackEnded, autoplayEnabled]);

  const validatedTrackId = extractSpotifyTrackId(trackId);

  useEffect(() => {
    if (!validatedTrackId || !hostRef.current) return undefined;

    let disposed = false;
    endedRef.current = false;
    furthestPlayedRef.current = 0;

    loadSpotifyIframeApi()
      .then((api) => {
        if (disposed || !hostRef.current) return;

        api.createController(
          hostRef.current,
          { uri: `spotify:track:${validatedTrackId}`, width: "100%", height: 152 },
          (controller) => {
            if (disposed) {
              controller.destroy();
              return;
            }

            controllerRef.current = controller;
            setReady(true);

            controller.addListener("playback_update", ({ data }) => {
              furthestPlayedRef.current = Math.max(
                furthestPlayedRef.current,
                data.position ?? 0
              );

              if (endedRef.current) return;
              if (!isTrackFinished(data, furthestPlayedRef.current)) return;

              endedRef.current = true;
              if (autoplayRef.current) onTrackEndedRef.current?.();
            });
          }
        );
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });

    return () => {
      disposed = true;
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
      setReady(false);
    };
  }, [validatedTrackId]);

  // Starts this track when the list hands it the turn.
  useEffect(() => {
    if (!ready || !isCurrentlyPlaying) return;

    endedRef.current = false;
    furthestPlayedRef.current = 0;
    controllerRef.current?.play?.();
  }, [ready, isCurrentlyPlaying]);

  if (!validatedTrackId || unavailable) {
    return (
      <YouTubeFallback
        title={title}
        artist={artist}
        albumArt={albumArt}
        previewUrl={previewUrl}
        reason={unavailable ? "The Spotify player didn't load." : undefined}
        autoPlay={isCurrentlyPlaying}
        onPreviewEnded={autoplayEnabled ? onTrackEnded : undefined}
      />
    );
  }

  return (
    <div className="spotify-player relative min-h-[152px]">
      {/* The controller replaces this node with its own iframe. */}
      <div ref={hostRef} />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-800/70">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-green-500" />
        </div>
      )}
    </div>
  );
}

export default SpotifyPlayer;
