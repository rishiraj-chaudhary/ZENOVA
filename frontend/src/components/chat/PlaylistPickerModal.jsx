import { useEffect, useRef } from "react";

/**
 * Chooses a destination playlist, or creates one.
 *
 * Closes on Escape and moves focus into the dialog on open, neither of which
 * the previous inline markup did.
 */
const PlaylistPickerModal = ({
  playlists,
  newPlaylistName,
  onNewPlaylistNameChange,
  onSelect,
  onCreate,
  onClose,
  error,
  songCount,
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-picker-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-6 shadow-2xl focus:outline-none"
      >
        <h2 id="playlist-picker-title" className="text-xl font-light text-white">
          {songCount > 1 ? `Save ${songCount} songs to…` : "Add to playlist"}
        </h2>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {playlists.length > 0 ? (
          <ul className="my-5 max-h-60 space-y-2 overflow-y-auto">
            {playlists.map((playlist) => (
              <li key={playlist._id}>
                <button
                  type="button"
                  onClick={() => onSelect(playlist._id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <span>
                    <span className="block font-medium text-white">{playlist.name}</span>
                    <span className="block text-xs text-gray-400">
                      {playlist.songs?.length ?? 0} songs
                    </span>
                  </span>
                  <i className="fa-solid fa-plus text-indigo-300" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="my-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400">
            No playlists yet — create one below.
          </p>
        )}

        <div className="border-t border-white/10 pt-5">
          <label htmlFor="new-playlist" className="text-sm text-gray-300">
            Create a new playlist
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="new-playlist"
              value={newPlaylistName}
              onChange={(event) => onNewPlaylistNameChange(event.target.value)}
              placeholder="Playlist name"
              className="flex-grow rounded-2xl border border-white/20 bg-white/10 p-3 text-white placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
            />
            <button
              type="button"
              onClick={onCreate}
              className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 font-medium text-white transition-transform hover:scale-105"
            >
              Create
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl border border-white/20 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PlaylistPickerModal;
