import { useCallback, useEffect, useState } from "react";
import CollaboratorsList from "../components/CollaboratorsList.jsx";
import InvitationsInbox from "../components/InvitationsInbox.jsx";
import PlaylistInvitation from "../components/PlaylistInvitation.jsx";
import PresenceIndicator from "../components/PresenceIndicator.jsx";
import SpotifyPlayer from "../components/SpotifyPlayer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import usePlaylists from "../hooks/usePlaylists.js";
import useSpeechRecognition from "../hooks/useSpeechRecognition.js";
import { extractSpotifyTrackId } from "../utils/spotify.js";

const CHAT_HISTORY_LIMIT = 10;

/** Recent chat turns give the voice command the same context the chatbot has. */
const readConversationHistory = (userId) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`chat_messages_${userId}`) ?? "[]");
    return saved
      .filter((message) => message.sender === "user" || message.sender === "assistant")
      .slice(-CHAT_HISTORY_LIMIT)
      .map((message) => ({ sender: message.sender, text: message.text }));
  } catch {
    return [];
  }
};

/** The link's destination, not an assumption about it. */
const isYouTubeLink = (url = "") => /youtu\.?be/i.test(url);

const Playlists = () => {
  const { user } = useAuth();
  const { connected, joinPlaylist, leavePlaylist } = useSocket();
  const {
    playlists,
    loading,
    error,
    refresh,
    createPlaylist,
    createPlaylistFromVoice,
    deletePlaylist,
    removeSong,
    reorderSongs,
  } = usePlaylists();

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);
  const [deletingSongs, setDeletingSongs] = useState({});
  const [activeCollaborations, setActiveCollaborations] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [voiceCommandError, setVoiceCommandError] = useState(null);

  const runVoiceCommand = useCallback(
    async (command) => {
      if (!command?.trim()) return;

      setVoiceLoading(true);
      setVoiceCommandError(null);
      setVoiceFeedback("Processing your request…");

      try {
        const { playlist } = await createPlaylistFromVoice({
          command,
          conversationHistory: readConversationHistory(user?._id),
        });
        setVoiceFeedback(`Created playlist: "${playlist.name}"`);
      } catch (commandError) {
        setVoiceCommandError(commandError.message);
        setVoiceFeedback("");
      } finally {
        setVoiceLoading(false);
      }
    },
    [createPlaylistFromVoice, user]
  );

  const {
    listening: isListening,
    transcript,
    error: speechError,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({ onResult: runVoiceCommand });

  const voiceError = voiceCommandError ?? speechError;

  const joinCollaborativeSession = useCallback(
    (playlistId) => {
      if (!connected) return;

      joinPlaylist(playlistId);
      setActiveCollaborations((current) =>
        current.includes(playlistId) ? current : [...current, playlistId]
      );
    },
    [connected, joinPlaylist]
  );

  const leaveCollaborativeSession = useCallback(
    (playlistId) => {
      if (!connected) return;

      leavePlaylist(playlistId);
      setActiveCollaborations((current) => current.filter((id) => id !== playlistId));
    },
    [connected, leavePlaylist]
  );

  // Joins the room for whichever playlist is open, and leaves the previous one.
  useEffect(() => {
    if (!connected || !expandedPlaylist) return undefined;

    joinCollaborativeSession(expandedPlaylist);
    return () => leaveCollaborativeSession(expandedPlaylist);
  }, [connected, expandedPlaylist, joinCollaborativeSession, leaveCollaborativeSession]);

  // Opens the playlist a user just accepted an invitation to.
  useEffect(() => {
    const pendingExpand = sessionStorage.getItem("expandPlaylist");
    if (pendingExpand) {
      sessionStorage.removeItem("expandPlaylist");
      setExpandedPlaylist(pendingExpand);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      await createPlaylist(newPlaylistName);
      setNewPlaylistName("");
    } catch {
      // usePlaylists already surfaced the message through `error`.
    }
  };

  const handleDeletePlaylist = (playlistId) => deletePlaylist(playlistId).catch(() => {});

  const handleDeleteSong = async (playlistId, musicId) => {
    setDeletingSongs((current) => ({ ...current, [musicId]: true }));

    try {
      await removeSong({ playlistId, musicId });
    } catch {
      // usePlaylists already surfaced the message through `error`.
    } finally {
      setDeletingSongs((current) => ({ ...current, [musicId]: false }));
    }
  };

  /**
   * Moves a song one place up or down and saves the result.
   *
   * Buttons rather than drag-and-drop: the rows embed Spotify iframes, which
   * swallow HTML5 drag events, and dragging is unusable on touch anyway.
   */
  const handleMoveSong = async (playlist, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= playlist.songs.length) return;

    const musicIds = playlist.songs.map((song) => song.musicId ?? song._id);
    [musicIds[index], musicIds[target]] = [musicIds[target], musicIds[index]];

    try {
      await reorderSongs({ playlistId: playlist._id, musicIds });
    } catch {
      // usePlaylists already surfaced the message through `error`.
    }
  };

  const toggleExpandPlaylist = (playlistId) =>
    setExpandedPlaylist((current) => (current === playlistId ? null : playlistId));

   return (
    <div className="sticky top-0 z-40 flex flex-col h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white overflow-hidden font-sans relative">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-36 -right-36 w-72 h-72 bg-gradient-to-r from-purple-500 to-fuchsia-600 rounded-full mix-blend-multiply filter blur-3xl opacity-7 animate-pulse-slow"></div>
            <div className="absolute -bottom-36 -left-36 w-72 h-72 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-7 animate-pulse-slow" style={{animationDelay: '2.5s'}}></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-3 animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>
        </div>

        {/* Animations and Custom Scrollbar Styles */}
        <style>{`
            .song-item {
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                overflow: hidden;
            }
            .deleting-song {
                transform: translateX(5%);
                opacity: 0;
                max-height: 0;
                margin-top: 0;
                margin-bottom: 0;
                padding-top: 0;
                padding-bottom: 0;
                border-color: transparent;
            }
            @keyframes highlight {
                0% { background-color: transparent; }
                30% { background-color: rgba(233, 76, 54, 0.2); }
                100% { background-color: transparent; }
            }
            .highlight-delete {
                animation: highlight 0.3s ease-out;
            }

            @keyframes fade-in-up {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .animate-fade-in-up {
                animation: fade-in-up 0.6s ease-out forwards;
            }

            @keyframes fade-in {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            .animate-fade-in {
                animation: fade-in 0.4s ease-out forwards;
            }

            @keyframes scale-in {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            .animate-scale-in {
                animation: scale-in 0.4s ease-out forwards;
            }

            @keyframes pulse-slow {
                0%, 100% { transform: scale(1); opacity: 0.07; }
                50% { transform: scale(1.03); opacity: 0.1; }
            }
            .animate-pulse-slow {
                animation: pulse-slow 5s ease-in-out infinite alternate;
            }

            .scrollbar-thin {
                scrollbar-width: thin;
                scrollbar-color: rgba(109, 40, 217, 0.6) transparent;
            }
            .scrollbar-thin::-webkit-scrollbar {
                width: 6px;
            }
            .scrollbar-thin::-webkit-scrollbar-track {
                background: transparent;
            }
            .scrollbar-thin::-webkit-scrollbar-thumb {
                background-color: rgba(109, 40, 217, 0.6);
                border-radius: 3px;
                border: 1px solid transparent;
                background-clip: padding-box;
            }
            .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                background-color: rgba(139, 92, 252, 0.7);
            }
        `}</style>

        {/* Header */}
        <div className="relative bg-white/5 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between transition-all duration-300 hover:bg-white/10 shadow-md">
            <div className="flex items-center space-x-3">
                <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110 hover:rotate-[5deg] ring-1 ring-purple-500/20">
                        <i className="fa-solid fa-music text-white text-sm"></i>
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse-slow border border-slate-900"></div>
                </div>
                <div>
                    <h1 className="text-xl font-semibold tracking-wide text-white">Your <span className="font-medium text-purple-300">Playlists</span></h1>
                    <p className="text-xs text-gray-400 font-light">Manage your music collections</p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <button className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 flex items-center justify-center transition-all duration-300 hover:bg-white/15 hover:scale-105 shadow-sm">
                    <i className="fa-solid fa-user text-xs"></i>
                </button>
            </div>
        </div>

        {/* Voice Controls */}
        <div className="mt-5 px-4 max-w-7xl mx-auto w-full">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-md border border-purple-700/20 rounded-2xl shadow-lg p-5 mb-5 animate-fade-in-up">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <i className="fa-solid fa-microphone-alt text-purple-400 mr-2 text-sm"></i> Voice Commands
                </h3>
                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={voiceLoading}
                    className={`flex items-center justify-center w-full md:w-auto ${
                        isListening
                            ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30 ring-1 ring-red-400/50'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:scale-103 shadow-md hover:shadow-purple-500/30 ring-1 ring-transparent hover:ring-purple-400/30'
                    } font-semibold rounded-lg px-4 py-2 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isListening ? (
                        <>
                            <i className="fa-solid fa-stop mr-2 text-xs"></i>
                            Stop Listening
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-microphone mr-2 text-xs"></i>
                            {voiceLoading ? 'Processing...' : 'Start Voice Command'}
                        </>
                    )}
                </button>
                <div className="mt-3 space-y-2">
                    {voiceFeedback && (
                        <div className="p-3 bg-white/10 text-green-300 rounded-md border border-white/15 animate-fade-in text-xs">
                            <i className="fa-solid fa-check-circle mr-1 text-green-400 text-xs"></i> {voiceFeedback}
                        </div>
                    )}
                    {voiceError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-md animate-fade-in text-xs">
                            <i className="fa-solid fa-exclamation-triangle mr-1 text-red-300 text-xs"></i> {voiceError}
                        </div>
                    )}
                    {transcript && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-200 rounded-md animate-fade-in text-xs">
                            <strong className="text-white/80 font-semibold">Command:</strong> {transcript}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Playlist creation */}
        <div className="flex space-x-3 mt-3 px-4 max-w-7xl mx-auto w-full animate-fade-in-up" style={{animationDelay: '200ms'}}>
            <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name..."
                className="flex-grow p-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all duration-300 text-sm shadow-inner"
            />
            <button
                onClick={handleSubmit}
                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:scale-103 transition-all duration-300 shadow-md hover:shadow-green-500/20 font-semibold text-sm"
            >
                <i className="fa-solid fa-plus mr-1 text-xs"></i> Create
            </button>
        </div>

        {/* Error display */}
        {error && (
            <div className="m-4 bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-md text-center animate-fade-in shadow-md max-w-7xl mx-auto w-full text-xs">
                <i className="fa-solid fa-exclamation-circle text-sm mb-1 text-red-300"></i>
                {error}
            </div>
        )}

        {/* Playlists Content */}
        <div className="flex-grow overflow-y-auto py-4 scrollbar-thin">
            <div className="md:mx-6 md:max-w-6xl md:mx-auto px-4 md:px-0">
                <InvitationsInbox onAccepted={refresh} />
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center h-full text-gray-400">
                    <i className="fa-solid fa-compact-disc fa-spin text-4xl mb-2 text-purple-400"></i>
                    <p className="text-sm">Loading playlists...</p>
                </div>
            ) : playlists.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-lg text-center animate-fade-in shadow-md max-w-md mx-auto my-4">
                    <i className="fa-solid fa-headphones text-gray-400 text-3xl mb-2"></i>
                    <p className="text-gray-300 text-sm font-light">No playlists found. Create one to start listening!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {playlists.map((playlist, index) => (
                        <div key={playlist._id}
                            className="bg-gradient-to-br from-slate-800/50 to-gray-800/50 backdrop-blur-md rounded-md md:rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:scale-[1.005] animate-fade-in-up border-y border-white/5 md:border md:mx-6 md:max-w-6xl md:mx-auto"
                            style={{animationDelay: `${150 + index * 75}ms`}}
                        >
                            {/* Decorative top border */}
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 opacity-60"></div>

                            <div
                                className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center cursor-pointer group"
                                onClick={() => toggleExpandPlaylist(playlist._id)}
                            >
                                <h3 className="text-lg font-semibold text-white tracking-wide">{playlist.name}</h3>
                                <div className="flex items-center space-x-3">
                                    <span className="text-xs text-gray-400 font-light">
                                        {playlist.songs?.length || 0} songs
                                    </span>
                                    <i className={`fa-solid ${expandedPlaylist === playlist._id ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400 text-sm transform transition-transform duration-300 group-hover:scale-125`}></i>
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDeletePlaylist(playlist._id); }}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs transition-all shadow-sm hover:scale-105"
                                    >
                                        <i className="fa-solid fa-trash-alt mr-1 text-[0.7rem]"></i>Delete
                                    </button>
                                </div>
                            </div>
                            {expandedPlaylist === playlist._id && (
                                <>
                                {/* Collaboration UI */}
                                <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5 text-xs">
                                    <h4 className="font-medium text-gray-300 flex items-center">
                                        <i className="fa-solid fa-people-group mr-2 text-purple-400 text-sm"></i>Collaboration
                                    </h4>
                                    {activeCollaborations.includes(playlist._id) ? (
                                        <div className="flex items-center">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                                            <span className="text-green-400 font-medium">Active</span>
                                            <button onClick={()=> leaveCollaborativeSession(playlist._id)} className="ml-2 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/15 text-white/70 transition-all shadow-sm">
                                                Leave
                                            </button>
                                        </div>
                                    ):(
                                        <button onClick={()=> joinCollaborativeSession(playlist._id)} className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-3 py-1.5 rounded-md flex items-center shadow-sm hover:scale-105 font-semibold">
                                            <i className="fa-solid fa-users mr-1 text-[0.7rem]"></i> Join
                                        </button>
                                    )}
                                </div>
                                {activeCollaborations.includes(playlist._id) && (
                                    <PresenceIndicator playlistId={playlist._id}/>
                                )}
                                <PlaylistInvitation playlistId={playlist._id} playlistName={playlist.name} isOwner={playlist.isOwner !==false}/>
                                <CollaboratorsList
                                    playlistId={playlist._id}
                                    isOwner={playlist.isOwner !== false}
                                />
                                    {playlist.songs && playlist.songs.length > 0 ? (
                                        <ul className="divide-y divide-white/5 p-3">
                                            {playlist.songs.map((song, songIndex) => {
                                                const spotifyTrackId = extractSpotifyTrackId(song.spotifyUri || song.audioUrl);
                                                return (
                                                    <li
                                                        key={song._id || song.musicId}
                                                        className={`song-item p-3 hover:bg-white/5 rounded-md transition-all duration-300 transform hover:scale-[1.005] ${deletingSongs?.[song._id || song.musicId] ? 'deleting-song highlight-delete' : ''} flex flex-col space-y-3`} // Changed to flex-col to stack elements
                                                    >
                                                        {/* Top Section: Song Info (Album Art, Title, Artist) */}
                                                        <div className="flex items-center w-full">
                                                            {song.albumArt ? (
                                                                <img
                                                                    src={song.albumArt}
                                                                    alt={`${song.title} album art`}
                                                                    className="w-10 h-10 rounded-md mr-3 object-cover shadow-sm"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center mr-3 shadow-sm">
                                                                    <span className="text-gray-400 text-base"><i className="fa-solid fa-compact-disc"></i></span>
                                                                </div>
                                                            )}
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="font-semibold text-white text-sm truncate">{song.title}</p>
                                                                <p className="text-gray-400 font-light text-xs truncate">{song.artist}</p>
                                                            </div>

                                                            {playlist.songs.length > 1 && (
                                                                <div className="flex flex-col ml-2 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`Move ${song.title} up`}
                                                                        disabled={songIndex === 0}
                                                                        onClick={() => handleMoveSong(playlist, songIndex, -1)}
                                                                        className="text-gray-400 hover:text-white disabled:opacity-25 disabled:hover:text-gray-400 px-1"
                                                                    >
                                                                        <i className="fa-solid fa-chevron-up text-[0.65rem]"></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`Move ${song.title} down`}
                                                                        disabled={songIndex === playlist.songs.length - 1}
                                                                        onClick={() => handleMoveSong(playlist, songIndex, 1)}
                                                                        className="text-gray-400 hover:text-white disabled:opacity-25 disabled:hover:text-gray-400 px-1"
                                                                    >
                                                                        <i className="fa-solid fa-chevron-down text-[0.65rem]"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Middle Section: Spotify Player (full width if present) */}
                                                        {spotifyTrackId && (
                                                            <div className="w-full">
                                                                <SpotifyPlayer
                                                                    trackId={spotifyTrackId}
                                                                    title={song.title}
                                                                    artist={song.artist}
                                                                    albumArt={song.albumArt}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Bottom Section: Action Buttons (Spotify, YouTube, Preview, Remove) */}
                                                        <div className="flex flex-wrap justify-end gap-2 w-full text-xs mt-auto">
                                                            {song.spotifyUri && ( // Always show Spotify button if it's there
                                                                <a
                                                                    href={song.spotifyUri}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="bg-[#1DB954] text-white px-3 py-1 rounded-md flex items-center transition-all duration-300 hover:bg-[#1ed760] shadow-sm hover:scale-105 font-semibold"
                                                                >
                                                                    <i className="fa-brands fa-spotify mr-1"></i> Spotify
                                                                </a>
                                                            )}
                                                            {/* Labelled by where the link actually goes. This was hardcoded
                                                                as "YouTube" while pointing at audioUrl, which the
                                                                recommendation pipeline fills with a Spotify URL for most
                                                                songs — a red YouTube button that opened Spotify. It is also
                                                                hidden when it would just duplicate the Spotify button above. */}
                                                            {song.audioUrl && song.audioUrl !== song.spotifyUri && (
                                                                <a
                                                                    href={song.audioUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`px-3 py-1 rounded-md font-medium flex items-center text-white shadow-sm hover:scale-105 transition-all duration-300 ${isYouTubeLink(song.audioUrl) ? "bg-red-600 hover:bg-red-700" : "bg-slate-600 hover:bg-slate-700"}`}
                                                                >
                                                                    <i className={`fa-brands ${isYouTubeLink(song.audioUrl) ? "fa-youtube" : "fa-spotify"} mr-1`}></i>
                                                                    {isYouTubeLink(song.audioUrl) ? "YouTube" : "Listen"}
                                                                </a>
                                                            )}
                                                            {song.previewUrl && ( // Preview Audio
                                                                <audio
                                                                    src={song.previewUrl}
                                                                    controls
                                                                    className="h-8 w-full max-w-[200px] bg-white/10 rounded-md"
                                                                ></audio>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteSong(playlist._id, song.musicId)}
                                                                disabled={deletingSongs?.[song._id || song.musicId]}
                                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md shadow-sm hover:scale-105 transition-all"
                                                            >
                                                                <i className='fa-solid fa-trash-alt mr-1'></i> Remove
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="p-4 text-center text-gray-400 bg-white/5 rounded-b-md">
                                            <i className="fa-solid fa-face-sad-tear text-2xl mb-2 text-purple-300"></i>
                                            <p className="font-light text-sm">This playlist is empty.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);
};

export default Playlists;
