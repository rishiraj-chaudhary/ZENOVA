// import React, { useContext, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import SpotifyPlayer from '../components/SpotifyPlayer';
// import AuthContext from '../context/AuthContext';

// const Playlists = () => {
    
//     const [playlists, setPlaylists] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [newPlaylistName, setNewPlaylistName] = useState('');
//     const [expandedPlaylist, setExpandedPlaylist] = useState(null);
//     const { user } = useContext(AuthContext);
//     const location = useLocation();
    

//     const getAuthHeaders = () => {
//         const token = sessionStorage.getItem('token');
//         console.log('Token retrieved from sessionStorage:', token);
        
//         if (!token) {
//             console.error("No authentication token found!");
//             return { 'Content-Type': 'application/json' };
//         }
        
//         const headers = { 
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//         };
        
//         console.log('Generated auth headers:', headers);
//         return headers;
//     };

//     useEffect(() => {
//         fetchPlaylists();
//     }, [location.pathname]); // Refresh when route changes

//     const fetchPlaylists = async () => {
//         if (!user) {
//             setLoading(false);
//             setError("User not authenticated. Please log in.");
//             return;
//         }
    
//         setLoading(true);
//         try {
//             const response = await fetch('http://localhost:3000/api/playlists/my-playlists', {
//                 headers: {
//                     ...getAuthHeaders(),
//                     'Cache-Control': 'no-cache, no-store, must-revalidate',
//                     'Pragma': 'no-cache',
//                     'Expires': '0'
//                 }
//             });
    
//             if (!response.ok) {
//                 throw new Error(`HTTP error! Status: ${response.status}`);
//             }
    
//             const data = await response.json();
//             console.log("Received playlists for user:", user._id, data);
//             setPlaylists(data);
//             setLoading(false);
//         } catch (error) {
//             console.error("Error fetching playlists:", error);
//             setError("Failed to load playlists. Please try again.");
//             setLoading(false);
//         }
//     };

//     const createPlaylist = async () => {
//         if (!newPlaylistName.trim()) {
//             alert("Please enter a playlists name");
//             return;
//         }

//         try {
//             const response = await fetch('http://localhost:3000/api/playlists/create', {
//                 method: 'POST',
//                 headers: getAuthHeaders(),
//                 body: JSON.stringify({ userId: user._id, name: newPlaylistName })
//             });

//             if (!response.ok) {
//                 throw new Error("Failed to create playlists");
//             }

//             setNewPlaylistName('');
//             fetchPlaylists();
//         } catch (error) {
//             console.error("Error creating playlists:", error);
//             alert("Failed to create playlists. Please try again.");
//         }
//     };

//     // Extract Spotify track ID from URL
//     const extractSpotifyTrackId = (spotifyUri) => {
//         if (!spotifyUri) return null;
//         const matches = spotifyUri.match(/track\/([a-zA-Z0-9]+)/);
//         return matches ? matches[1] : null;
//     };

//     // Toggle expand/collapse playlists
//     const toggleExpandPlaylist = (playlistId) => {
//         setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
//     };

//     return (
//         <div className="flex flex-col h-screen bg-[#181818] text-white sticky top-0 z-50">
//             <div className="bg-[#1e1e1e] p-4 flex items-center border-b border-[#333] shadow-md sticky top-0 z-50">
//                 <div className="w-10 h-10 bg-[#e94c36] rounded-full flex items-center justify-center text-white font-bold mr-3">
//                     <i className="fa-solid fa-music"></i>
//                 </div>
//                 <h1 className="text-xl font-semibold text-white">Your Playlists</h1>
//                 <div className="ml-auto">
//                     <button className="w-9 h-9 rounded-full bg-white text-[#181818] flex items-center justify-center shadow-md">
//                         <i className="fa-solid fa-moon"></i>
//                     </button>
//                 </div>
//             </div>

//             <div className="flex space-x-2 mt-4">
//             <input
//                 type="text"
//                 value={newPlaylistName}
//                 onChange={(e) => setNewPlaylistName(e.target.value)}
//                 placeholder="New playlists name"
//                 className="flex-grow p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-[#e94c36] outline-none"
//             />
//             <button
//                 onClick={createPlaylist}
//                 className="bg-[#e94c36] hover:bg-[#ff6347] text-white font-semibold px-4 py-2 rounded-lg shadow transition-all"
//             >
//                 Create
//             </button>
//         </div>

//             {/* Playlists Content */}
//             <div className="flex-grow overflow-y-auto p-4">
//                 {loading ? (
//                     <div className="flex justify-center items-center h-full">
//                         <div className="text-gray-400">Loading playlists...</div>
//                     </div>
//                 ) : error ? (
//                     <div className="bg-[#444] text-white p-4 rounded-lg text-center">
//                         {error}
//                     </div>
//                 ) : playlists.length === 0 ? (
//                     <div className="bg-[#1e1e1e] p-4 rounded-lg text-center">
//                         <p className="text-gray-400">No playlists found. Create your first playlists above!</p>
//                     </div>
//                 ) : (
//                     <div className="space-y-6">
//                         {playlists.map((playlists) => (
//                             <div key={playlists._id} className="bg-[#1e1e1e] rounded-lg overflow-hidden shadow-lg">
//                                 <div 
//                                     className="p-4 bg-[#252525] border-b border-[#333] flex justify-between items-center cursor-pointer"
//                                     onClick={() => toggleExpandPlaylist(playlists._id)}
//                                 >
//                                     <h3 className="text-xl font-bold text-white">{playlists.name}</h3>
//                                     <div className="flex items-center">
//                                         <span className="text-sm text-gray-400 mr-3">
//                                             {playlists.songs?.length || 0} songs
//                                         </span>
//                                         <i className={`fa-solid ${expandedPlaylist === playlists._id ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400`}></i>
//                                     </div>
//                                 </div>

//                                 {expandedPlaylist === playlists._id && (
//                                     <>
//                                         {playlists.songs && playlists.songs.length > 0 ? (
//                                             <ul className="divide-y divide-[#333]">
//                                                 {playlists.songs.map((song) => {
//                                                     const spotifyTrackId = extractSpotifyTrackId(song.spotifyUri);
                                                    
//                                                     return (
//                                                         <li key={song.musicId} className="p-4 hover:bg-[#252525] transition-colors">
//                                                             <div className="flex items-center mb-2">
//                                                                 {song.albumArt ? (
//                                                                     <img 
//                                                                         src={song.albumArt} 
//                                                                         alt={`${song.title} album art`}
//                                                                         className="w-12 h-12 rounded mr-3 object-cover" 
//                                                                     />
//                                                                 ) : (
//                                                                     <div className="w-12 h-12 bg-[#333] rounded flex items-center justify-center mr-3">
//                                                                         <span className="text-xs"><i className="fa-solid fa-music"></i></span>
//                                                                     </div>
//                                                                 )}
//                                                                 <div className="flex-1">
//                                                                     <p className="font-semibold text-white">{song.title}</p>
//                                                                     <p className="text-sm text-gray-400">{song.artist}</p>
//                                                                 </div>
//                                                             </div>
                                                            
//                                                             {/* Spotify Player Integration */}
//                                                             {spotifyTrackId && (
//                                                                 <div className="mt-2 mb-2">
//                                                                     <SpotifyPlayer 
//                                                                         trackId={spotifyTrackId}
//                                                                         title={song.title}
//                                                                         artist={song.artist}
//                                                                         albumArt={song.albumArt}
//                                                                     />
//                                                                 </div>
//                                                             )}
                                                            
//                                                             <div className="flex mt-2">
//                                                                 {song.spotifyUri && (
//                                                                     <a 
//                                                                         href={song.spotifyUri} 
//                                                                         target="_blank" 
//                                                                         rel="noopener noreferrer" 
//                                                                         className="bg-[#1DB954] text-white px-3 py-1 rounded text-xs flex items-center mr-2"
//                                                                     >
//                                                                         <i className="fa-brands fa-spotify mr-1"></i> Open in Spotify
//                                                                     </a>
//                                                                 )}
//                                                                 {song.previewUrl && !spotifyTrackId && (
//                                                                     <audio 
//                                                                         src={song.previewUrl} 
//                                                                         controls 
//                                                                         className="h-8 w-full max-w-xs"
//                                                                     ></audio>
//                                                                 )}
//                                                             </div>
//                                                         </li>
//                                                     );
//                                                 })}
//                                             </ul>
//                                         ) : (
//                                             <div className="p-4 text-center text-gray-400">
//                                                 This playlists is empty. Add songs from recommendations!
//                                             </div>
//                                         )}
//                                     </>
//                                 )}
//                             </div>
//                         ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default Playlists;

// import React, { useContext, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import SpotifyPlayer from '../components/SpotifyPlayer';
// import AuthContext from '../context/AuthContext';

// const Playlists = () => {
//     const [playlists, setPlaylists] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [newPlaylistName, setNewPlaylistName] = useState('');
//     const [expandedPlaylist, setExpandedPlaylist] = useState(null);
//     const [deletingSongs, setDeletingSongs] = useState({});
//     const { user } = useContext(AuthContext);
//     const location = useLocation();

//     // Helper to get auth headers
//     const getAuthHeaders = () => {
//         const token = sessionStorage.getItem('token');
//         if (!token) {
//             console.error("No authentication token found!");
//             return { 'Content-Type': 'application/json' };
//         }
//         return { 
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//         };
//     };

//     // Fetch playlists on mount or route change
//     useEffect(() => {
//         fetchPlaylists();
//     }, [location.pathname]);

//     const fetchPlaylists = async () => {
//         if (!user) {
//             setLoading(false);
//             setError("User not authenticated. Please log in.");
//             return;
//         }
//         setLoading(true);
//         try {
//             const response = await fetch('http://localhost:3000/api/playlists/my-playlists', {
//                 headers: {
//                     ...getAuthHeaders(),
//                     'Cache-Control': 'no-cache, no-store, must-revalidate',
//                     'Pragma': 'no-cache',
//                     'Expires': '0'
//                 }
//             });
//             if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
//             const data = await response.json();
//             setPlaylists(data);
//             setLoading(false);
//         } catch (error) {
//             console.error("Error fetching playlists:", error);
//             setError("Failed to load playlists. Please try again.");
//             setLoading(false);
//         }
//     };

//     // Create a new playlist
//     const createPlaylist = async () => {
//         if (!newPlaylistName.trim()) {
//             alert("Please enter a playlist name");
//             return;
//         }
//         try {
//             const response = await fetch('http://localhost:3000/api/playlists/create', {
//                 method: 'POST',
//                 headers: getAuthHeaders(),
//                 body: JSON.stringify({ userId: user._id, name: newPlaylistName })
//             });
//             if (!response.ok) throw new Error("Failed to create playlist");
//             setNewPlaylistName('');
//             fetchPlaylists();
//         } catch (error) {
//             console.error("Error creating playlist:", error);
//             alert("Failed to create playlist. Please try again.");
//         }
//     };

//     // Extract Spotify track ID from URL
//     const extractSpotifyTrackId = (spotifyUri) => {
//         if (!spotifyUri) return null;
//         const matches = spotifyUri.match(/(?:track\/|:track:)([a-zA-Z0-9]+)/);
//         return matches ? matches[1] : null;
//     };

//     // Delete Song from playlist with modern animation effect
//     const handleDeleteSong = async (songId, playlistId) => {
//         if (window.confirm('Are you sure you want to delete this song from this playlist?')) {
//             try {
//                 // Mark this song as being deleted to trigger animation
//                 setDeletingSongs(prev => ({ ...prev, [songId]: true }));
                
//                 // Wait for animation to play before making API call
//                 setTimeout(async () => {
//                     const response = await fetch('http://localhost:3000/api/playlists/removeSong', {
//                         method: 'POST',
//                         headers: getAuthHeaders(),
//                         body: JSON.stringify({ playlistId, songId })
//                     });
                    
//                     if (!response.ok) {
//                         throw new Error('Failed to delete song!');
//                     }
                    
//                     // Wait for animation to complete before refreshing
//                     setTimeout(() => {
//                         // Reset deleting state and refresh playlists
//                         setDeletingSongs(prev => {
//                             const newState = { ...prev };
//                             delete newState[songId];
//                             return newState;
//                         });
//                         fetchPlaylists();
//                     }, 500); // Match the animation duration
//                 }, 50);
//             } catch (err) {
//                 console.error("Error deleting song:", err);
//                 alert("Failed to delete song");
//                 setDeletingSongs(prev => {
//                     const newState = { ...prev };
//                     delete newState[songId];
//                     return newState;
//                 });
//             }
//         }
//     };

//     // Toggle expand/collapse playlists
//     const toggleExpandPlaylist = (playlistId) => {
//         setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
//     };

//     return (
//         <div className="flex flex-col h-screen bg-[#181818] text-white sticky top-0 z-50">
//             {/* Modern animations for item removal */}
//             <style jsx>{`
//                 .song-item {
//                     transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
//                     overflow: hidden;
//                 }
                
//                 .deleting-song {
//                     transform: translateX(10%);
//                     opacity: 0;
//                     max-height: 0;
//                     margin-top: 0;
//                     margin-bottom: 0;
//                     padding-top: 0;
//                     padding-bottom: 0;
//                     border-color: transparent;
//                 }
                
//                 /* Add a subtle highlight effect before removal */
//                 @keyframes highlight {
//                     0% { background-color: transparent; }
//                     30% { background-color: rgba(233, 76, 54, 0.2); }
//                     100% { background-color: transparent; }
//                 }
                
//                 .highlight-delete {
//                     animation: highlight 0.3s ease-out;
//                 }
//             `}</style>

//             {/* Header */}
//             <div className="bg-[#1e1e1e] p-4 flex items-center border-b border-[#333] shadow-md sticky top-0 z-50">
//                 <div className="w-10 h-10 bg-[#e94c36] rounded-full flex items-center justify-center text-white font-bold mr-3">
//                     <i className="fa-solid fa-music"></i>
//                 </div>
//                 <h1 className="text-xl font-semibold text-white">Your Playlists</h1>
//                 <div className="ml-auto">
//                     <button className="w-9 h-9 rounded-full bg-white text-[#181818] flex items-center justify-center shadow-md">
//                         <i className="fa-solid fa-moon"></i>
//                     </button>
//                 </div>
//             </div>

//             {/* Playlist creation */}
//             <div className="flex space-x-2 mt-4 px-4">
//                 <input
//                     type="text"
//                     value={newPlaylistName}
//                     onChange={(e) => setNewPlaylistName(e.target.value)}
//                     placeholder="New playlist name"
//                     className="flex-grow p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-[#e94c36] outline-none"
//                 />
//                 <button
//                     onClick={createPlaylist}
//                     className="bg-[#e94c36] hover:bg-[#ff6347] text-white font-semibold px-4 py-2 rounded-lg shadow transition-all"
//                 >
//                     Create
//                 </button>
//             </div>

//             {/* Playlists Content */}
//             <div className="flex-grow overflow-y-auto p-4">
//                 {loading ? (
//                     <div className="flex justify-center items-center h-full">
//                         <div className="text-gray-400">Loading playlists...</div>
//                     </div>
//                 ) : error ? (
//                     <div className="bg-[#444] text-white p-4 rounded-lg text-center">
//                         {error}
//                     </div>
//                 ) : playlists.length === 0 ? (
//                     <div className="bg-[#1e1e1e] p-4 rounded-lg text-center">
//                         <p className="text-gray-400">No playlists found. Create your first playlist above!</p>
//                     </div>
//                 ) : (
//                     <div className="space-y-6">
//                         {playlists.map((playlist) => (
//                             <div key={playlist._id} className="bg-[#1e1e1e] rounded-lg overflow-hidden shadow-lg">
//                                 <div 
//                                     className="p-4 bg-[#252525] border-b border-[#333] flex justify-between items-center cursor-pointer"
//                                     onClick={() => toggleExpandPlaylist(playlist._id)}
//                                 >
//                                     <h3 className="text-xl font-bold text-white">{playlist.name}</h3>
//                                     <div className="flex items-center">
//                                         <span className="text-sm text-gray-400 mr-3">
//                                             {playlist.songs?.length || 0} songs
//                                         </span>
//                                         <i className={`fa-solid ${expandedPlaylist === playlist._id ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400`}></i>
//                                     </div>
//                                 </div>

//                                 {expandedPlaylist === playlist._id && (
//                                     <>
//                                         {playlist.songs && playlist.songs.length > 0 ? (
//                                             <ul className="divide-y divide-[#333]">
//                                                 {playlist.songs.map((song) => {
//                                                     const spotifyTrackId = extractSpotifyTrackId(song.spotifyUri || song.audioUrl);
//                                                     return (
//                                                         <li 
//                                                             key={song.musicId} 
//                                                             className={`song-item p-4 hover:bg-[#252525] ${deletingSongs[song.musicId] ? 'deleting-song highlight-delete' : ''}`}
//                                                         >
//                                                             {/* Delete this song from playlist */}
//                                                             <div className="flex mt-2">
//                                                                 <button 
//                                                                     className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs flex items-center ml-2 transition-all duration-300 hover:scale-105" 
//                                                                     onClick={() => handleDeleteSong(song.musicId, playlist._id)}
//                                                                     disabled={deletingSongs[song.musicId]}
//                                                                 >
//                                                                     <i className='fa-solid fa-trash mr-1'></i>Remove
//                                                                 </button>
//                                                             </div>
//                                                             {/* Spotify Player Integration */}
//                                                             {spotifyTrackId && (
//                                                                 <div className="mt-2 mb-2">
//                                                                     <SpotifyPlayer 
//                                                                         trackId={spotifyTrackId}
//                                                                         title={song.title}
//                                                                         artist={song.artist}
//                                                                         albumArt={song.albumArt}
//                                                                     />
//                                                                 </div>
//                                                             )}
//                                                             <div className="flex mt-2">
//                                                                 {song.spotifyUri && (
//                                                                     <a 
//                                                                         href={song.spotifyUri} 
//                                                                         target="_blank" 
//                                                                         rel="noopener noreferrer" 
//                                                                         className="bg-[#1DB954] text-white px-3 py-1 rounded text-xs flex items-center mr-2 transition-all duration-300 hover:bg-[#1ed760]"
//                                                                     >
//                                                                         <i className="fa-brands fa-spotify mr-1"></i> Open in Spotify
//                                                                     </a>
//                                                                 )}
//                                                                 {song.previewUrl && !spotifyTrackId && (
//                                                                     <audio 
//                                                                         src={song.previewUrl} 
//                                                                         controls 
//                                                                         className="h-8 w-full max-w-xs"
//                                                                     ></audio>
//                                                                 )}
//                                                             </div>
//                                                         </li>
//                                                     );
//                                                 })}
//                                             </ul>
//                                         ) : (
//                                             <div className="p-4 text-center text-gray-400">
//                                                 This playlist is empty. Add songs from recommendations!
//                                             </div>
//                                         )}
//                                     </>
//                                 )}
//                             </div>
//                         ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default Playlists;


// import React, { useContext, useEffect, useRef, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import SpotifyPlayer from '../components/SpotifyPlayer';
// import AuthContext from '../context/AuthContext';

// const Playlists = () => {
//     const [playlists, setPlaylists] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [newPlaylistName, setNewPlaylistName] = useState('');
//     const [expandedPlaylist, setExpandedPlaylist] = useState(null);
//     const [deletingSongs, setDeletingSongs] = useState({});

//     // Add a new ref for transcript storage
//     const transcriptRef = useRef('');
    
//     // Voice recognition states
//     const [isListening, setIsListening] = useState(false);
//     const [transcript, setTranscript] = useState('');
//     const [voiceLoading, setVoiceLoading] = useState(false);
//     const [voiceError, setVoiceError] = useState(null);
//     const [voiceFeedback, setVoiceFeedback] = useState('');
    
//     const { user } = useContext(AuthContext);
//     const location = useLocation();
    
//     // Use ref for the speech recognition instance
//     const recognitionRef = useRef(null);

//     // Helper to get auth headers
//     const getAuthHeaders = () => {
//         const token = sessionStorage.getItem('token');
//         if (!token) {
//             console.error("No authentication token found!");
//             return { 'Content-Type': 'application/json' };
//         }
//         return { 
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//         };
//     };
//      // Create a new playlist
//      const createPlaylist = async () => {
//         if (!newPlaylistName.trim()) {
//             alert("Please enter a playlist name");
//             return;
//         }
//         try {
//             const response = await fetch('http://localhost:3000/api/playlists/create', {
//                 method: 'POST',
//                 headers: getAuthHeaders(),
//                 body: JSON.stringify({ userId: user._id, name: newPlaylistName })
//             });
//             if (!response.ok) throw new Error("Failed to create playlist");
//             setNewPlaylistName('');
//             fetchPlaylists();
//         } catch (error) {
//             console.error("Error creating playlist:", error);
//             alert("Failed to create playlist. Please try again.");
//         }
//     };

//     // // Fetch playlists on mount or route change
//     // useEffect(() => {
//     //     fetchPlaylists();
        
//     //     // Initialize speech recognition
//     //     if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
//     //         setVoiceError('Speech recognition is not supported in your browser. Try Chrome or Edge.');
//     //         return;
//     //     }
        
//     //     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     //     recognitionRef.current = new SpeechRecognition();
//     //     recognitionRef.current.continuous = false;
//     //     recognitionRef.current.interimResults = false;
//     //     recognitionRef.current.lang = 'en-US';
        
//     //     // Set up event handlers
//     //     recognitionRef.current.onstart = () => {
//     //         setIsListening(true);
//     //         setVoiceFeedback('Listening... Speak now');
//     //     };
        
//     //     recognitionRef.current.onresult = (event) => {
//     //         const command = event.results[0][0].transcript;
//     //         setTranscript(command);
//     //         setVoiceFeedback(`Command received: "${command}"`);
//     //         // Store the command in a ref to ensure it's available in onend
//     //         transcript.current = command;
//     //     };
        
//     //     recognitionRef.current.onerror = (event) => {
//     //         setVoiceError(`Error recognizing your voice: ${event.error}`);
//     //         setIsListening(false);
//     //         setVoiceFeedback('');
//     //     };
        
//     //     recognitionRef.current.onend = () => {
//     //         setIsListening(false);
//     //         if (transcript) {
//     //             setVoiceFeedback('Processing your request...');
//     //             createPlaylistFromVoice(transcript.current);
//     //         } else {
//     //             setVoiceFeedback('No speech was detected. Please try again.');
//     //         }
//     //     };
        
//     //     // Cleanup
//     //     return () => {
//     //         if (recognitionRef.current) {
//     //             recognitionRef.current.stop();
//     //         }
//     //     };
//     // }, [location.pathname]);

   
    
//     // // Create playlist from voice command
//     // const createPlaylistFromVoice = async (command) => {
//     //     try {
//     //         setVoiceLoading(true);
            
//     //         const response = await fetch('http://localhost:3000/api/playlists/create-from-voice', {
//     //             method: 'POST',
//     //             headers: getAuthHeaders(),
//     //             body: JSON.stringify({ command })
//     //         });
            
//     //         if (!response.ok) {
//     //             throw new Error(`Failed to create playlist: ${response.statusText}`);
//     //         }
            
//     //         const result = await response.json();
            
//     //         // Refresh playlists to include the new one
//     //         await fetchPlaylists();
            
//     //         setVoiceFeedback(`Successfully created playlist: "${result.playlist.name}"`);
//     //         setVoiceLoading(false);
//     //         setTranscript('');
//     //     } catch (err) {
//     //         setVoiceError('Failed to create playlist: ' + (err.response?.data?.message || err.message));
//     //         setVoiceLoading(false);
//     //         setVoiceFeedback('');
//     //         console.error(err);
//     //     }
//     // };
    
//     // // Start voice recognition
//     // const startListening = () => {
//     //     setTranscript('');
//     //     setVoiceError(null);
        
//     //     try {
//     //         recognitionRef.current.start();
//     //     } catch (err) {
//     //         console.error('Speech recognition error:', err);
//     //         setVoiceError('Could not start speech recognition. Please try again.');
//     //     }
//     // };
//     // Speech recognition implementation fixes
//     // Add a new ref for transcript storage

//     // Stop voice recognition

//     // Add a new ref for transcript storage

// useEffect(() => {
//     fetchPlaylists();
    
//     // Initialize speech recognition
//     if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
//         setVoiceError('Speech recognition is not supported in your browser. Try Chrome or Edge.');
//         return;
//     }
    
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     recognitionRef.current = new SpeechRecognition();
//     recognitionRef.current.continuous = false;
//     recognitionRef.current.interimResults = false;
//     recognitionRef.current.lang = 'en-US';
    
//     // Set up event handlers
//     recognitionRef.current.onstart = () => {
//         console.log("Speech recognition started"); // Debug log
//         setIsListening(true);
//         setVoiceFeedback('Listening... Speak now');
//         setVoiceError(null);
//     };
    
//     recognitionRef.current.onresult = (event) => {
//         const transcriptText = event.results[0][0].transcript;
//         console.log("Received transcript:", transcriptText); // Debug log
        
//         // Store in both state and ref
//         setTranscript(transcriptText);
//         transcriptRef.current = transcriptText; // Store in ref for immediate access
//         setVoiceFeedback(`Command received: "${transcriptText}"`);
//     };
    
//     recognitionRef.current.onerror = (event) => {
//         console.error("Speech recognition error:", event.error); // Debug log
//         setVoiceError(`Error recognizing your voice: ${event.error}`);
//         setIsListening(false);
//         setVoiceFeedback('');
//     };
    
//     recognitionRef.current.onend = () => {
//         console.log("Speech recognition ended, transcript:", transcriptRef.current); // Debug log using ref
//         setIsListening(false);
        
//         // Fix: Add additional debugging
//         const currentTranscript = transcriptRef.current;
//         console.log("Final transcript value before processing:", currentTranscript);
        
//         // Use the ref instead of state and do extra validation
//         if (currentTranscript && currentTranscript.trim() !== '') {
//             console.log("Processing transcript:", currentTranscript);
//             setVoiceFeedback('Processing your request...');
//             // Important: Need to pass a direct string, not the ref object
//             createPlaylistFromVoice(currentTranscript);
//         } else {
//             console.log("No transcript detected");
//             setVoiceFeedback('No speech was detected. Please try again.');
//         }
//     };
    
//     // Cleanup
//     return () => {
//         if (recognitionRef.current) {
//             recognitionRef.current.abort();
//         }
//     };
// }, [location.pathname]); // Keep this dependency

// // Fixed createPlaylistFromVoice with better error handling
// const createPlaylistFromVoice = async (command) => {
//     console.log("createPlaylistFromVoice called with command:", command);
    
//     if (!command || command.trim() === '') {
//         console.error("Empty command received in createPlaylistFromVoice");
//         setVoiceError('No command detected');
//         setVoiceLoading(false);
//         return;
//     }
    
//     try {
//         console.log("Creating playlist with command:", command); // Debug log
//         setVoiceLoading(true);
        
//         const authHeaders = getAuthHeaders();
//         console.log("Auth headers prepared:", Object.keys(authHeaders)); // Log headers (without values)
        
//         const response = await fetch('http://localhost:3000/api/playlists/create-from-voice', {
//             method: 'POST',
//             headers: authHeaders,
//             body: JSON.stringify({ command, userId: user?._id }) // Add userId explicitly
//         });
        
//         console.log("API response status:", response.status); // Debug log
        
//         if (!response.ok) {
//             const errorText = await response.text();
//             console.error("Error response:", errorText);
            
//             let errorData = {};
//             try {
//                 errorData = JSON.parse(errorText);
//             } catch (e) {
//                 console.error("Failed to parse error response as JSON");
//             }
            
//             throw new Error(errorData.message || `Failed to create playlist: ${response.statusText}`);
//         }
        
//         const result = await response.json();
//         console.log("API response data:", result); // Debug log
        
//         // Refresh playlists to include the new one
//         await fetchPlaylists();
        
//         setVoiceFeedback(`Successfully created playlist: "${result.playlist?.name || 'New playlist'}"`);
//         setVoiceLoading(false);
//         setTranscript('');
//         transcriptRef.current = '';
//     } catch (err) {
//         console.error("Error in createPlaylistFromVoice:", err);
//         setVoiceError('Failed to create playlist: ' + (err.message || 'Unknown error'));
//         setVoiceLoading(false);
//         setVoiceFeedback('');
//     }
// };

// // Start voice recognition with a better API
// const startListening = () => {
//     // Reset states
//     setTranscript('');
//     transcriptRef.current = ''; // Also clear the ref
//     setVoiceError(null);
//     setVoiceFeedback('');
    
//     // Ensure we have permission (helps on some browsers)
//     if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
//         navigator.mediaDevices.getUserMedia({ audio: true })
//             .then(() => {
//                 console.log("Microphone permission granted"); // Debug log
//                 try {
//                     recognitionRef.current.start();
//                     console.log("Recognition started"); // Debug log
//                 } catch (err) {
//                     console.error('Speech recognition error:', err);
//                     setVoiceError('Could not start speech recognition. Please try again.');
//                 }
//             })
//             .catch(err => {
//                 console.error('Error accessing microphone:', err);
//                 setVoiceError('Microphone access denied. Please allow microphone access to use voice commands.');
//             });
//     } else {
//         try {
//             recognitionRef.current.start();
//         } catch (err) {
//             console.error('Speech recognition error:', err);
//             setVoiceError('Could not start speech recognition. Please try again.');
//         }
//     }
// };
//     const stopListening = () => {
//         if (recognitionRef.current) {
//             recognitionRef.current.stop();
//         }
//     };

//     // Extract Spotify track ID from URL
//     const extractSpotifyTrackId = (spotifyUri) => {
//         if (!spotifyUri) return null;
//         const matches = spotifyUri.match(/(?:track\/|:track:)([a-zA-Z0-9]+)/);
//         return matches ? matches[1] : null;
//     };

//     // Delete Song from playlist with modern animation effect
//     const handleDeleteSong = async (songId, playlistId) => {
//         if (window.confirm('Are you sure you want to delete this song from this playlist?')) {
//             try {
//                 // Mark this song as being deleted to trigger animation
//                 setDeletingSongs(prev => ({ ...prev, [songId]: true }));
                
//                 // Wait for animation to play before making API call
//                 setTimeout(async () => {
//                     const response = await fetch('http://localhost:3000/api/playlists/removeSong', {
//                         method: 'POST',
//                         headers: getAuthHeaders(),
//                         body: JSON.stringify({ playlistId, songId })
//                     });
                    
//                     if (!response.ok) {
//                         throw new Error('Failed to delete song!');
//                     }
                    
//                     // Wait for animation to complete before refreshing
//                     setTimeout(() => {
//                         // Reset deleting state and refresh playlists
//                         setDeletingSongs(prev => {
//                             const newState = { ...prev };
//                             delete newState[songId];
//                             return newState;
//                         });
//                         fetchPlaylists();
//                     }, 500); // Match the animation duration
//                 }, 50);
//             } catch (err) {
//                 console.error("Error deleting song:", err);
//                 alert("Failed to delete song");
//                 setDeletingSongs(prev => {
//                     const newState = { ...prev };
//                     delete newState[songId];
//                     return newState;
//                 });
//             }
//         }
//     };

//     // Toggle expand/collapse playlists
//     const toggleExpandPlaylist = (playlistId) => {
//         setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
//     };

//     return (
//         <div className="flex flex-col h-screen bg-[#181818] text-white sticky top-0 z-50">
//             {/* Modern animations for item removal */}
//             <style jsx>{`
//                 .song-item {
//                     transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
//                     overflow: hidden;
//                 }
                
//                 .deleting-song {
//                     transform: translateX(10%);
//                     opacity: 0;
//                     max-height: 0;
//                     margin-top: 0;
//                     margin-bottom: 0;
//                     padding-top: 0;
//                     padding-bottom: 0;
//                     border-color: transparent;
//                 }
                
//                 /* Add a subtle highlight effect before removal */
//                 @keyframes highlight {
//                     0% { background-color: transparent; }
//                     30% { background-color: rgba(233, 76, 54, 0.2); }
//                     100% { background-color: transparent; }
//                 }
                
//                 .highlight-delete {
//                     animation: highlight 0.3s ease-out;
//                 }
                
//                 /* Voice button animations */
//                 @keyframes pulse {
//                     0% { transform: scale(1); }
//                     50% { transform: scale(1.05); }
//                     100% { transform: scale(1); }
//                 }
                
//                 .voice-button.listening {
//                     animation: pulse 1.5s infinite;
//                     background-color: #e94c36;
//                 }
//             `}</style>

//             {/* Header */}
//             <div className="bg-[#1e1e1e] p-4 flex items-center border-b border-[#333] shadow-md sticky top-0 z-50">
//                 <div className="w-10 h-10 bg-[#e94c36] rounded-full flex items-center justify-center text-white font-bold mr-3">
//                     <i className="fa-solid fa-music"></i>
//                 </div>
//                 <h1 className="text-xl font-semibold text-white">Your Playlists</h1>
//                 <div className="ml-auto">
//                     <button className="w-9 h-9 rounded-full bg-white text-[#181818] flex items-center justify-center shadow-md">
//                         <i className="fa-solid fa-moon"></i>
//                     </button>
//                 </div>
//             </div>

//             {/* Playlist creation section */}
//             <div className="bg-[#1e1e1e] p-4 rounded-lg mt-4 mx-4 shadow-lg">
//                 <h2 className="text-lg font-semibold mb-3">Create New Playlist</h2>
                
//                 {/* Text input creation */}
//                 <div className="flex space-x-2 mb-4">
//                     <input
//                         type="text"
//                         value={newPlaylistName}
//                         onChange={(e) => setNewPlaylistName(e.target.value)}
//                         placeholder="New playlist name"
//                         className="flex-grow p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-[#e94c36] outline-none"
//                     />
//                     <button
//                         onClick={createPlaylist}
//                         className="bg-[#e94c36] hover:bg-[#ff6347] text-white font-semibold px-4 py-2 rounded-lg shadow transition-all"
//                     >
//                         Create
//                     </button>
//                 </div>
                
//                 {/* Voice command section */}
//                 <div className="mt-4 border-t border-[#333] pt-4">
//                     <h3 className="text-md font-medium mb-2">Create with Voice Command</h3>
//                     <p className="text-sm text-gray-400 mb-3">
//                         Click the button and say something like "Create a playlist for my road trip" or "Make a workout playlist"
//                     </p>
                    
//                     <div className="flex items-center">
//                         <button 
//                             onClick={isListening ? stopListening : startListening}
//                             className={`voice-button bg-[#2c2c2c] hover:bg-[#3c3c3c] text-white font-medium px-4 py-3 rounded-lg shadow transition-all flex items-center ${isListening ? 'listening' : ''}`}
//                             disabled={voiceLoading}
//                         >
//                             <i className="fa-solid fa-microphone mr-2"></i>
//                             {isListening ? 'Listening...' : 'Create Playlist with Voice'}
//                         </button>
//                     </div>
                    
//                     {voiceFeedback && (
//                         <div className="mt-3 p-3 bg-[#252525] rounded-lg text-sm">
//                             {voiceFeedback}
//                         </div>
//                     )}
                    
//                     {voiceError && (
//                         <div className="mt-3 p-3 bg-[#3d1a1a] text-red-300 rounded-lg text-sm">
//                             {voiceError}
//                         </div>
//                     )}
                    
//                     {voiceLoading && (
//                         <div className="mt-3 p-3 bg-[#252525] rounded-lg text-sm flex items-center">
//                             <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
//                             Creating your playlist...
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {/* Playlists Content */}
//             <div className="flex-grow overflow-y-auto p-4">
//                 {loading ? (
//                     <div className="flex justify-center items-center h-full">
//                         <div className="text-gray-400">Loading playlists...</div>
//                     </div>
//                 ) : error ? (
//                     <div className="bg-[#444] text-white p-4 rounded-lg text-center">
//                         {error}
//                     </div>
//                 ) : playlists.length === 0 ? (
//                     <div className="bg-[#1e1e1e] p-4 rounded-lg text-center">
//                         <p className="text-gray-400">No playlists found. Create your first playlist above!</p>
//                     </div>
//                 ) : (
//                     <div className="space-y-6">
//                         {playlists.map((playlist) => (
//                             <div key={playlist._id} className="bg-[#1e1e1e] rounded-lg overflow-hidden shadow-lg">
//                                 <div 
//                                     className="p-4 bg-[#252525] border-b border-[#333] flex justify-between items-center cursor-pointer"
//                                     onClick={() => toggleExpandPlaylist(playlist._id)}
//                                 >
//                                     <h3 className="text-xl font-bold text-white">{playlist.name}</h3>
//                                     <div className="flex items-center">
//                                         <span className="text-sm text-gray-400 mr-3">
//                                             {playlist.songs?.length || 0} songs
//                                         </span>
//                                         <i className={`fa-solid ${expandedPlaylist === playlist._id ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400`}></i>
//                                     </div>
//                                 </div>
                                
//                                 {expandedPlaylist === playlist._id && (
//                                     <>
//                                         {playlist.songs && playlist.songs.length > 0 ? (
//                                             <ul className="divide-y divide-[#333]">
//                                                 {playlist.songs.map((song) => {
//                                                     const spotifyTrackId = extractSpotifyTrackId(song.spotifyUri || song.audioUrl);
//                                                     return (
//                                                         <li 
//                                                             key={song.musicId} 
//                                                             className={`song-item p-4 hover:bg-[#252525] ${deletingSongs[song.musicId] ? 'deleting-song highlight-delete' : ''}`}
//                                                         >
//                                                             {/* Delete this song from playlist */}
//                                                             <div className="flex mt-2">
//                                                                 <button 
//                                                                     className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs flex items-center ml-2 transition-all duration-300 hover:scale-105" 
//                                                                     onClick={() => handleDeleteSong(song.musicId, playlist._id)}
//                                                                     disabled={deletingSongs[song.musicId]}
//                                                                 >
//                                                                     <i className='fa-solid fa-trash mr-1'></i>Remove
//                                                                 </button>
//                                                             </div>
//                                                             {/* Spotify Player Integration */}
//                                                             {spotifyTrackId && (
//                                                                 <div className="mt-2 mb-2">
//                                                                     <SpotifyPlayer 
//                                                                         trackId={spotifyTrackId}
//                                                                         title={song.title}
//                                                                         artist={song.artist}
//                                                                         albumArt={song.albumArt}
//                                                                     />
//                                                                 </div>
//                                                             )}
//                                                             <div className="flex mt-2">
//                                                                 {song.spotifyUri && (
//                                                                     <a 
//                                                                         href={song.spotifyUri} 
//                                                                         target="_blank" 
//                                                                         rel="noopener noreferrer" 
//                                                                         className="bg-[#1DB954] text-white px-3 py-1 rounded text-xs flex items-center mr-2 transition-all duration-300 hover:bg-[#1ed760]"
//                                                                     >
//                                                                         <i className="fa-brands fa-spotify mr-1"></i> Open in Spotify
//                                                                     </a>
//                                                                 )}
//                                                                 {song.previewUrl && !spotifyTrackId && (
//                                                                     <audio 
//                                                                         src={song.previewUrl} 
//                                                                         controls 
//                                                                         className="h-8 w-full max-w-xs"
//                                                                     ></audio>
//                                                                 )}
//                                                             </div>
//                                                         </li>
//                                                     );
//                                                 })}
//                                             </ul>
//                                         ) : (
//                                             <div className="p-4 text-center text-gray-400">
//                                                 This playlist is empty. Add songs from recommendations!
//                                             </div>
//                                         )}
//                                     </>
//                                 )}
//                             </div>
//                         ))}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default Playlists;

import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CollaboratorsList from '../components/CollaboratorsList';
import PlaylistInvitation from '../components/PlaylistInvitation';
import PresenceIndicator from '../components/PresenceIndicator';
import SpotifyPlayer from '../components/SpotifyPlayer';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
const Playlists = () => {
    //Collaboration states and hooks
    const {socket,connected,joinPlaylist,leavePlaylist}=useSocket();
    const [activeCollaborations,setActiveCollaborations]=useState([]);


    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [expandedPlaylist, setExpandedPlaylist] = useState(null);
    const [deletingSongs, setDeletingSongs] = useState({});
    // Voice recognition states
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [voiceError, setVoiceError] = useState(null);
    const [voiceFeedback, setVoiceFeedback] = useState('');
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const recognitionRef = useRef(null);
    const transcriptRef = useRef('');

    // --- Helper: Auth Headers ---
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token') || ''}`
    });

    // --- Fetch Playlists ---
    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3000/api/playlists/my-playlists', {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error(`Failed to load playlists: ${response.status}`);
            const data = await response.json();
            setPlaylists(data);
            setError(null);
        } catch (err) {
            setError('Failed to load playlists. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaylists();
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceError('Speech recognition is not supported in your browser. Try Chrome or Edge.');
            return;
        }
        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (err) {}
            }
        };
    }, [location.pathname]);

    useEffect(() => {
        // Auto-join collaboration sessions for playlists when the owner expands them
        if (socket && connected && user && playlists.length > 0) {
            playlists.forEach(playlist => {
                if (playlist.isOwner && expandedPlaylist === playlist._id && 
                    !activeCollaborations.includes(playlist._id)) {
                    joinCollaborativeSession(playlist._id);
                }
            });
        }
    }, [socket, connected, user, playlists, expandedPlaylist]);

    // Auto-join collaborative sessions for playlists where the user is a collaborator
    useEffect(()=>{
        if(socket && connected && user && playlists.length>0){
            playlists.forEach(playlist=>{
                if(playlist.isCollaborator && expandedPlaylist===playlist._id){
                    joinCollaborativeSession(playlist._id);
                }
            });
        }
    },[socket,connected,user,playlists,expandedPlaylist]);

    //Join playlist room
    // Join collaborative session
const joinCollaborativeSession = async (playlistId) => {
    if (socket && user && connected) {
        try {
            // First, join the Socket.io room for real-time updates
            joinPlaylist(playlistId);
            setActiveCollaborations(prev => [...prev, playlistId]);
            sessionStorage.setItem('activeCollaborations',JSON.stringify(activeCollaborations));
            // Then, check if the user is already a collaborator
            const response = await fetch(`http://localhost:3000/api/playlists/${playlistId}/collaborators`, {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const isAlreadyCollaborator = data.collaborators.some(
                    collaborator => collaborator._id === user._id
                );
                
                // If not a collaborator, add them using the invite by username endpoint
                if (!isAlreadyCollaborator) {
                    // Use the current user's name to add themselves as a collaborator
                    // This assumes the user is the owner or has permission to add collaborators
                    const inviteResponse = await fetch('http://localhost:3000/api/playlists/invite/username', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ 
                            playlistId, 
                            username: user.name 
                        })
                    });
                    
                    if (!inviteResponse.ok) {
                        console.log('Could not add user as collaborator, but Socket.io connection established');
                    }
                }
            }
        } catch (err) {
            console.error('Error joining collaborative session:', err);
            // Even if adding as collaborator fails, keep the Socket.io connection
        }
    }
};

    //Leave playlist room 
    const leaveCollaborativeSession=(playlistId)=>{
        if(socket && connected){
            leavePlaylist(playlistId);
            setActiveCollaborations(prev=>prev.filter(id => id!==playlistId));
            sessionStorage.setItem('activeCollaborations',JSON.stringify(activeCollaborations));
        }
    }
    //Listen for socket events
    useEffect(()=>{
        if(!socket){
            return;
        }
        const handleSongAdded=(data)=>{
            console.log('Song added: ',data);
            fetchPlaylists();//refresh the playlist to show new playlist
        }
        const handleSongRemoved=(data)=>{
            console.log('Song removed: ',data);
            fetchPlaylists();//refresh the playlist to show new playlist
        }
        const handleSongsReordered=(data)=>{
            console.log('Songs reordered: ',data);
            fetchPlaylists();//refresh the playlist to show new playlist
        }

        const handleCollaboratorAdded=(data)=>{
            console.log('Collaborator added:',data);
            fetchPlaylists();//refresh playlists to show new collaborator
        }

         const handleInvitationAccepted = (data) => {
            console.log('Invitation accepted event received:', data);
            // Refresh playlists when someone accepts an invitation
            fetchPlaylists();
        };
        const handlePlaylistUpdated = (data) => {
            console.log('Playlist updated event received:', data);
            // Refresh playlists for any general updates
            fetchPlaylists();
        };


        const handleCollaboratorRemoved=(data)=>{
            console.log('Collaborator removed:',data);
            if(data.removedCollaborator && data.removedCollaborator.userId === user._id){
                console.log('The current user was removed from the playlist since the user lost access');
            }
            fetchPlaylists();
        }
        socket.on('invitation_accepted', handleInvitationAccepted);
        socket.on('playlist_updated', handlePlaylistUpdated);
        socket.on('song_added',handleSongAdded);
        socket.on('song_removed',handleSongRemoved);
        socket.on('songs_reordered',handleSongsReordered);
        socket.on('collaborator_added',handleCollaboratorAdded);
        socket.on('collaborator_removed',handleCollaboratorRemoved);

        //clean up
        return ()=>{
            socket.off('invitation_accepted', handleInvitationAccepted);
            socket.off('playlist_updated', handlePlaylistUpdated);
            socket.off('song_added',handleSongAdded);
            socket.off('song_removed',handleSongRemoved);
            socket.off('songs_reordered',handleSongsReordered);
            socket.off('collaborator_added',handleCollaboratorAdded);
            socket.off('collaborator_removed',handleCollaboratorRemoved);
        }
    },[socket,fetchPlaylists]);

    // Load active collaborations from sessionStorage on component mount
    useEffect(() => {
        // Load active collaborations from sessionStorage
        const storedCollaborations = sessionStorage.getItem('activeCollaborations');
        if (storedCollaborations) {
            try {
                const parsedCollaborations = JSON.parse(storedCollaborations);
                setActiveCollaborations(parsedCollaborations);
                
                // Rejoin all active collaborations
                if (socket && connected && user) {
                    parsedCollaborations.forEach(playlistId => {
                        joinPlaylist(playlistId);
                    });
                }
            } catch (err) {
                console.error('Error parsing stored collaborations:', err);
            }
        }
    }, [socket, connected, user]);


    // --- Speech Recognition ---
    const initSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onstart = () => {
            setIsListening(true);
            setVoiceFeedback('Listening... Speak now');
            setVoiceError(null);
        };
        recognition.onresult = (event) => {
            const transcriptText = event.results[0][0].transcript;
            setTranscript(transcriptText);
            transcriptRef.current = transcriptText;
            setVoiceFeedback(`Command received: "${transcriptText}"`);
            if (transcriptText && transcriptText.trim() !== '') {
                setTimeout(() => {
                    createPlaylistFromVoice(transcriptText);
                }, 500);
            }
        };
        recognition.onerror = (event) => {
            setVoiceError(`Error recognizing your voice: ${event.error}`);
            setIsListening(false);
            setVoiceFeedback('');
        };
        recognition.onend = () => {
            setIsListening(false);
            if (!transcriptRef.current || transcriptRef.current.trim() === '') {
                setVoiceFeedback('No speech was detected. Please try again.');
            }
        };
        return recognition;
    };

    const startListening = () => {
        setTranscript('');
        transcriptRef.current = '';
        setVoiceError(null);
        setVoiceFeedback('');
        try {
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (err) {}
            }
            recognitionRef.current = initSpeechRecognition();
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                        try { recognitionRef.current.start(); } catch (err) {
                            setVoiceError('Could not start speech recognition. Please try again.');
                        }
                    })
                    .catch(err => {
                        setVoiceError('Microphone access denied. Please allow microphone access to use voice commands.');
                    });
            } else {
                recognitionRef.current.start();
            }
        } catch (err) {
            setVoiceError('Could not initialize speech recognition. Please try again.');
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (err) {}
        }
    };

    const createPlaylistFromVoice = async (command) => {
        if (!command || command.trim() === '') {
            setVoiceError('No command detected');
            setVoiceLoading(false);
            return;
        }
        try {
            setVoiceLoading(true);
            setVoiceFeedback('Processing your request...');

            // Get chat history from sessionStorage
            const savedMessages = JSON.parse(
                sessionStorage.getItem(`chat_messages_${user?._id}`) || '[]'
            );
            
            // Prepare conversation history (last 10 messages)
            const conversationHistory = savedMessages
                .filter(m => m.sender === 'user' || m.sender === 'assistant')
                .slice(-10)
                .map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
                }));
        
            // Modified payload with conversationHistory
            const payload = { 
                command, 
                userId: user?._id,
                conversationHistory // This was missing
            };
            console.log('Sending voice command request:', payload);
            const response = await fetch('http://localhost:3000/api/playlists/create-from-voice', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            // Log the response status
            console.log('Response status:', response.status);
            if (!response.ok) {
                let errorMessage = `Failed to create playlist: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {}
                throw new Error(errorMessage);
            }
            const result = await response.json();
            console.log('Successfully created playlist:', result);
            await fetchPlaylists();
            setVoiceFeedback(`Successfully created playlist: "${result.playlist?.name || 'New playlist'}"`);
            setVoiceLoading(false);
            setTranscript('');
            transcriptRef.current = '';
        } catch (err) {
            console.error('Voice command error:', err);
            setVoiceError('Failed to create playlist: ' + (err.message || 'Unknown error'));
            setVoiceLoading(false);
            setVoiceFeedback('');
        }
    };

    // --- Playlist CRUD ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        try {
            const response = await fetch('http://localhost:3000/api/playlists/create', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name: newPlaylistName })
            });
            if (!response.ok) throw new Error('Failed to create playlist');
            setNewPlaylistName('');
            await fetchPlaylists();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeletePlaylist = async (playlistId) => {
        try {
            await fetch(`http://localhost:3000/api/playlists/delete/${playlistId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            await fetchPlaylists();
        } catch (err) {
            setError('Failed to delete playlist');
        }
    };

    const handleDeleteSong = async (playlistId, musicId) => {
        try {
            console.log('Trying to remove');
            setDeletingSongs(prev => ({ ...prev, [musicId]: true }));
            await fetch(`http://localhost:3000/api/playlists/removesong`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ playlistId, musicId })
            });
            
            //Emit socket event to notify others users
            if(socket && connected && activeCollaborations.includes(playlistId)){
                socket.emit('remove_song',{
                    playlistId,
                    songId:musicId,
                    userId:user._id,
                    username:user.name
                });
            }
            await fetchPlaylists(); 
        } catch (err) {
            setError('Failed to delete song');
        } finally {
            setDeletingSongs(prev => ({ ...prev, [musicId]: false }));
        }
    };

    // Extract Spotify track ID from URI
    const extractSpotifyTrackId = (spotifyUri) => {
        if (!spotifyUri) return null;
        const matches = spotifyUri.match(/(?:track\/|:track:)([a-zA-Z0-9]+)/);
        return matches ? matches[1] : null;
    };

    // Toggle expand/collapse playlist
    const toggleExpandPlaylist = (playlistId) => {
        setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
    };

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
                                            {playlist.songs.map((song) => {
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
                                                        </div>

                                                        {/* Middle Section: Spotify Player (full width if present) */}
                                                        {spotifyTrackId && (
                                                            <div className="w-full">
                                                                <SpotifyPlayer
                                                                    trackId={spotifyTrackId}
                                                                    title={song.title}
                                                                    artist={song.artist}
                                                                    albumArt={song.albumArt}
                                                                    // Ensure your SpotifyPlayer component itself is designed to expand to w-full
                                                                    // For example, its root element or iframe should have width: 100%
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
                                                            {song.audioUrl && ( // YouTube button
                                                                <a
                                                                    href={song.audioUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-3 py-1 rounded-md font-medium flex items-center bg-red-600 text-white shadow-sm hover:scale-105 transition-all duration-300 hover:bg-red-700"
                                                                >
                                                                    <i className="fa-brands fa-youtube mr-1"></i> YouTube
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
