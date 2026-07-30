import { useCallback, useEffect, useState } from "react";
import * as playlistAPI from "../api/playlistAPI.js";
import useSocketEvents from "./useSocketEvents.js";

/** Any of these means another collaborator changed a playlist we can see. */
const COLLABORATION_EVENTS = [
  "song_added",
  "song_removed",
  "songs_reordered",
  "collaborator_added",
  "collaborator_removed",
  "invitation_accepted",
  "playlist_updated",
];

/**
 * Owns the playlist collection: loading, mutating, and staying in sync with
 * realtime collaboration events.
 *
 * Keeping this out of the page means Playlist.jsx no longer mixes data fetching,
 * socket wiring and rendering in one 1,900-line component.
 */
const usePlaylists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setPlaylists(await playlistAPI.fetchMyPlaylists());
      setError(null);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useSocketEvents(
    Object.fromEntries(COLLABORATION_EVENTS.map((event) => [event, refresh]))
  );

  /** Runs a mutation, then reloads so local state matches the server. */
  const mutate = useCallback(
    async (operation) => {
      try {
        const result = await operation();
        await refresh();
        return result;
      } catch (mutationError) {
        setError(mutationError.message);
        throw mutationError;
      }
    },
    [refresh]
  );

  return {
    playlists,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
    refresh,
    createPlaylist: useCallback(
      (name) => mutate(() => playlistAPI.createPlaylist(name)),
      [mutate]
    ),
    createPlaylistFromVoice: useCallback(
      (payload) => mutate(() => playlistAPI.createPlaylistFromVoice(payload)),
      [mutate]
    ),
    deletePlaylist: useCallback(
      (playlistId) => mutate(() => playlistAPI.deletePlaylist(playlistId)),
      [mutate]
    ),
    removeSong: useCallback(
      (payload) => mutate(() => playlistAPI.removeSong(payload)),
      [mutate]
    ),
  };
};

export default usePlaylists;
