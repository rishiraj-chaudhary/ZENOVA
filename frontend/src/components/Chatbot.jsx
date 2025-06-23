// import { faShuffle } from "@fortawesome/free-solid-svg-icons";
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import axios from 'axios';
// import { useContext, useEffect, useRef, useState } from 'react';
// import AuthContext from '../context/AuthContext';
// import { useSocket } from "../context/SocketContext";
// import RecommendationCard from './RecommendationCard';
// function Chatbot() {
//   // Context and state
//   const { user } = useContext(AuthContext);
//   const {socket,connected}=useSocket();
//   const userId = user?._id;
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState('');
//   const [mood, setMood] = useState(null);
//   const [recommendations, setRecommendations] = useState([]);
//   const [playlists, setPlaylists] = useState([]);
//   const [showPlaylistModal, setShowPlaylistModal] = useState(false);
//   const [selectedSongId, setSelectedSongId] = useState(null);
//   const [newPlaylistName, setNewPlaylistName] = useState('');
//   const [isListening, setIsListening] = useState(false);
//   //Autoplay feature states
//   const [currentPlayingIndex,setCurrentPlayingIndex]=useState(null);
//   const [autoplayEnabled,setAutoplayEnabled]=useState(false);

//   // Refs
//   const messagesEndRef = useRef(null);
//   const observerRef = useRef(null);
//   const isAtBottomRef = useRef(true);
//   const recognitionRef = useRef(null);

//   // --- Resizable panel state ---
//   const [chatWidth, setChatWidth] = useState(500); // px
//   const isDraggingRef = useRef(false);

//   // Authentication header helper
//   const getAuthHeader = () => {
//     const token = sessionStorage.getItem('token');
//     if (!token) {
//       console.error("No authentication token found!");
//       return { 'Content-Type': 'application/json' };
//     }
//     return { 
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     };
//   };

//   // Load messages from sessionStorage when component mounts
//   useEffect(() => {
//     if (user) {
//       const savedMessagesString = sessionStorage.getItem(`chat_messages_${user._id}`);
//       let savedMessages = [];
//       try {
//         if (savedMessagesString) {
//           savedMessages = JSON.parse(savedMessagesString);
//         }
//         if (savedMessages.length === 0) {
//           const welcomeMessage = {
//             text: "Hi! I'm ZENOVA, your music therapy assistant. How are you feeling today? I can recommend some music based on your mood and preferences.",
//             sender: 'assistant'
//           };
//           setMessages([welcomeMessage]);
//           sessionStorage.setItem(`chat_messages_${user._id}`, JSON.stringify([welcomeMessage]));
//         } else {
//           setMessages(savedMessages);
//         }
//         const savedRecommendations = sessionStorage.getItem(`recommendations_${user._id}`);
//         if (savedRecommendations) {
//           try {
//             setRecommendations(JSON.parse(savedRecommendations));
//           } catch (error) {
//             console.error('Error parsing saved recommendations:', error);
//           }
//         }
//         const savedMood = sessionStorage.getItem(`mood_${user._id}`);
//         if (savedMood) {
//           setMood(savedMood);
//         }
//       } catch (error) {
//         console.error('Error handling messages:', error);
//         const welcomeMessage = {
//           text: "Hi! I'm ZENOVA, your music therapy assistant. How are you feeling today? I can recommend some music based on your mood and preferences.",
//           sender: 'assistant'
//         };
//         setMessages([welcomeMessage]);
//       }
//     } else {
//       setMessages([]);
//       setRecommendations([]);
//       setMood(null);
//     }
//   }, [user]);

//   // Save messages to sessionStorage whenever they change
//   useEffect(() => {
//     if (user && messages.length > 0) {
//       sessionStorage.setItem(`chat_messages_${user._id}`, JSON.stringify(messages));
//     }
//   }, [messages, user]);
  
//   // Save recommendations to sessionStorage whenever they change
//   useEffect(() => {
//     if (user && recommendations.length > 0) {
//       sessionStorage.setItem(`recommendations_${user._id}`, JSON.stringify(recommendations));
//       if (mood) {
//         sessionStorage.setItem(`mood_${user._id}`, mood);
//       }
//     }
//   }, [recommendations, mood, user]);

//   // Voice recognition setup
//   useEffect(() => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (SpeechRecognition) {
//       recognitionRef.current = new SpeechRecognition();
//       recognitionRef.current.continuous = false;
//       recognitionRef.current.interimResults = false;
//       recognitionRef.current.lang = 'en-US';
//       recognitionRef.current.onresult = (event) => {
//         const transcript = event.results[0][0].transcript;
//         setInput(transcript);
//       };
//       recognitionRef.current.onend = () => {
//         setIsListening(false);
//       };
//     } else {
//       console.warn('Speech Recognition not supported in this browser.');
//     }
//   }, []);

//   // Set up scroll observer
//   useEffect(() => {
//     observerRef.current = new IntersectionObserver(
//       ([entry]) => { isAtBottomRef.current = entry.isIntersecting; },
//       { threshold: 0.1 }
//     );
//     if (messagesEndRef.current) observerRef.current.observe(messagesEndRef.current);
//     return () => observerRef.current?.disconnect();
//   }, []);

//   // Auto-scroll to bottom when messages update
//   useEffect(() => {
//     if (isAtBottomRef.current && messagesEndRef.current) {
//       messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
//     }
//   }, [messages]);

//   // --- Resizer logic ---
//   useEffect(() => {
//     const handleMouseMove = (e) => {
//       if (!isDraggingRef.current) return;
//       const min = 320;
//       const max = Math.max(window.innerWidth * 0.7, min);
//       let newWidth = e.clientX;
//       if (newWidth < min) newWidth = min;
//       if (newWidth > max) newWidth = max;
//       setChatWidth(newWidth);
//     };
//     const handleMouseUp = () => {
//       isDraggingRef.current = false;
//       document.body.style.cursor = '';
//     };
//     window.addEventListener('mousemove', handleMouseMove);
//     window.addEventListener('mouseup', handleMouseUp);
//     return () => {
//       window.removeEventListener('mousemove', handleMouseMove);
//       window.removeEventListener('mouseup', handleMouseUp);
//     };
//   }, []);
//   const startDragging = (e) => {
//     isDraggingRef.current = true;
//     document.body.style.cursor = 'col-resize';
//   };

//   const handleVoiceInput = () => {
//     if (recognitionRef.current) {
//       setIsListening(true);
//       recognitionRef.current.start();
//     }
//   };

//   // Fetch user playlists
//   const fetchPlaylists = async () => {
//     if (!userId) return;
//     try {
//       const response = await fetch(`http://localhost:3000/api/playlists/my-playlists`, {
//         headers: getAuthHeader()
//       });
//       if (response.ok) setPlaylists(await response.json());
//     } catch (error) {
//       console.error("Error fetching playlists:", error);
//     }
//   };
//   //Autoplay Feature
//     const handleTrackEnded = (index) => {
//       console.log('Track ended called with index:', index);
//       console.log('Autoplay conditions:', {
//         autoplayEnabled,
//         index,
//         recommendationsLength: recommendations.length
//       });
  
//       if (autoplayEnabled && index !== null && index < recommendations.length - 1) {
//         const nextIndex = index + 1;
//         console.log(`Attempting to play next track: ${nextIndex}`);
        
//         // Use a slight delay to ensure smooth transition
//         setTimeout(() => {
//           setCurrentPlayingIndex(nextIndex);
//         }, 500);
//       } else {
//         console.log('Autoplay not triggered due to conditions');
//       }
//     };

//   const startPlayingTrack=(index)=>{
//     setCurrentPlayingIndex(index);
//     // Get the current track's duration in milliseconds
//   const currentTrack = recommendations[index];
//   if (currentTrack && currentTrack.duration && autoplayEnabled) {
//     // Add a small buffer (e.g., 500ms) to ensure the track completes
//     const timeoutDuration = currentTrack.duration + 500;
    
//     // Clear any existing timeout
//     if (autoplayTimeoutRef.current) {
//       clearTimeout(autoplayTimeoutRef.current);
//     }
    
//     // Set a new timeout to play the next track
//     autoplayTimeoutRef.current = setTimeout(() => {
//       if (index < recommendations.length - 1) {
//         setCurrentPlayingIndex(index + 1);
//       }
//     }, timeoutDuration);
//   }
//   }
//   const extractSpotifyTrackId = (spotifyString) => {
//     if (!spotifyString) return null;
    
//     try {
//       // Handle URI format (spotify:track:xyz)
//       let matches = spotifyString.match(/spotify:track:([a-zA-Z0-9]+)/);
//       if (matches && matches[1]) return matches[1];
      
//       // Handle URL format with query parameters (https://open.spotify.com/track/xyz?si=abc)
//       matches = spotifyString.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?|$)/);
//       if (matches && matches[1]) return matches[1];
      
//       // Handle direct ID (if already extracted)
//       if (/^[a-zA-Z0-9]{22}$/.test(spotifyString)) return spotifyString;
      
//       return null;
//     } catch (error) {
//       console.error("Error extracting Spotify track ID:", error);
//       return null;
//     }
//   };
  

//   // Mood color mapping based on medical research
//   const moodColors = {
//     happy: {
//       primary: '#FFD700',
//       secondary: '#FFA500',
//       accent: '#FF6B6B',
//       background: '#FFF5E6',
//       text: '#2C3E50'
//     },
//     sad: {
//       primary: '#3498DB',
//       secondary: '#2980B9',
//       accent: '#1ABC9C',
//       background: '#E8F4F8',
//       text: '#2C3E50'
//     },
//     angry: {
//       primary: '#E74C3C',
//       secondary: '#C0392B',
//       accent: '#F39C12',
//       background: '#FDF2F0',
//       text: '#2C3E50'
//     },
//     calm: {
//       primary: '#2ECC71',
//       secondary: '#27AE60',
//       accent: '#3498DB',
//       background: '#E8F8F5',
//       text: '#2C3E50'
//     },
//     anxious: {
//       primary: '#9B59B6',
//       secondary: '#8E44AD',
//       accent: '#3498DB',
//       background: '#F5EEF8',
//       text: '#2C3E50'
//     },
//     stressed: {
//       primary: '#1ABC9C',
//       secondary: '#16A085',
//       accent: '#3498DB',
//       background: '#E8F8F5',
//       text: '#2C3E50'
//     },
//     default: {
//       primary: '#3b82f6',
//       secondary: '#2563eb',
//       accent: '#1DB954',
//       background: '#181818',
//       text: '#FFFFFF'
//     }
//   };

//   const getMoodColors = () => {
//     return moodColors[mood?.toLowerCase()] || moodColors.default;
//   };

//   // Handle sending a message
//   const handleSendMessage = async () => {
//     if (!input.trim()) return;
//     if (!userId || userId.length !== 24) {
//       setMessages(prev => [...prev, { text: 'Authentication error, please try again later.', sender: 'system' }]);
//       return;
//     }
//     const userMessage = { text: input, sender: 'user' };
//     setMessages(prev => [...prev, userMessage]);
//     setInput('');
//     try {
//       const conversationHistory = messages.slice(-10);
//       const response = await axios.post('http://localhost:3000/api/music/recommend/recommendations', {
//         userId,
//         message: input,
//         conversationHistory
//       });
//       setMessages(prev => [...prev, { 
//         text: response.data.response, 
//         sender: 'assistant' 
//       }]);
//       if (response.data.recommendations && response.data.recommendations.length > 0) {
//         setRecommendations(response.data.recommendations);
//       }
//       if (response.data.detectedMood) {
//         setMood(response.data.detectedMood);
//       }
//     } catch (error) {
//       console.error("Error getting recommendations:", error);
//       setMessages(prev => [...prev, { 
//         text: 'Sorry, I encountered an error. Please try again.', 
//         sender: 'system' 
//       }]);
//     }
//   };

//   // Playlist management
//   const handleAddToPlaylist = async (songId) => {
//     if (!userId) {
//       alert("User not authenticated. Please log in.");
//       return;
//     }
//     setSelectedSongId(songId);
//     await fetchPlaylists();
//     setShowPlaylistModal(true);
//   };

//   const createNewPlaylist = async () => {
//     if (!newPlaylistName.trim()) {
//       alert("Please enter a playlist name");
//       return;
//     }
//     try {
//       const response = await fetch('http://localhost:3000/api/playlists/create', {
//         method: 'POST',
//         headers: getAuthHeader(),
//         body: JSON.stringify({ userId, name: newPlaylistName })
//       });
//       if (!response.ok) throw new Error("Failed to create playlist.");
//       const newPlaylist = await response.json();
//       setPlaylists(prev => [...prev, newPlaylist]);
//       setNewPlaylistName('');
//       return newPlaylist._id;
//     } catch (err) {
//       console.error("Error creating playlist:", err);
//       alert("Failed to create playlist. Please try again.");
//       return null;
//     }
//   };

//   const addSongToPlaylist = async (playlistId) => {
//     if (!selectedSongId || !playlistId) return;
//     try {
//       const response = await fetch('http://localhost:3000/api/playlists/addsong', {
//         method: "POST",
//         headers: getAuthHeader(),
//         body: JSON.stringify({ playlistId, songId: selectedSongId })
//       });
//       if (!response.ok) throw new Error("Failed to add song to playlist");
//       const songToAdd=recommendations.find(song=> song.musicId===selectedSongId);

//       //emit ads_song event to backend
//       if(socket && connected){
//         socket.emit('add_song',{
//           playlistId,
//           song:songToAdd,
//           userId:user._id,
//           username:user.name
//         });
//       }
//       alert("Song added to playlist successfully!");
//       setShowPlaylistModal(false);
//       setSelectedSongId(null);
//       await fetchPlaylists();
//     } catch (err) {
//       console.error("Error adding song:", err);
//       alert("Failed to add song. Please try again.");
//     }
//   };

//   const handleAddToNewPlaylist = async () => {
//     const newPlaylistId = await createNewPlaylist();
//     if (newPlaylistId) await addSongToPlaylist(newPlaylistId);
//   };

//   const renderRecommendations = () => {
//     return recommendations.map((song, index) => (
//       <RecommendationCard
//         key={index}
//         song={song}
//         moodColors={getMoodColors()}
//         onAddToPlaylist={handleAddToPlaylist}
//         isCurrentlyPlaying={index === currentPlayingIndex}
//         autoplayEnabled={autoplayEnabled}
//         onTrackEnded={()=> handleTrackEnded(index)}
//         onPlay={()=> startPlayingTrack(index)}
//       />
//     ));
//   };
//   const handleShuffle=()=>{
//     const shuffled=[...recommendations];
//     for(let i=shuffled.length-1;i>0;i--){
//       let j=Math.floor(Math.random()*(i+1));
//       [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
//     }
//     setRecommendations(shuffled);
//   }
  
  

//   return (
//     <div className="sticky top-0 z-40 flex flex-col h-screen bg-[#181818] text-white">
//       {/* Header */}
//       <div className="bg-[#1e1e1e] shadow-md p-3 flex items-center border-b border-[#333]">
//         <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
//           <span className="font-bold text-xs text-white"><i className="fa-solid fa-music"></i></span>
//         </div>
//         <h1 className="text-xl font-semibold text-white">YOUR MUSIC</h1>
        
//         <div className="ml-auto">
//           <button className="w-8 h-8 rounded-full bg-white text-[#181818] flex items-center justify-center">
//             <span><i className="fa-solid fa-moon"></i></span>
//           </button>
//         </div>
//       </div>
//       {/* Main content area - side by side layout with draggable divider */}
//       <div className="flex flex-grow overflow-hidden relative">
//         {/* Chat Messages - Left side */}
//         <div
//           className="flex flex-col h-full overflow-hidden"
//           style={{
//             width: chatWidth,
//             minWidth: 320,
//             maxWidth: '70vw',
//             transition: isDraggingRef.current ? 'none' : 'width 0.15s',
//             background: '#181818'
//           }}
//         >
//           <div className="flex-grow overflow-y-auto p-4 space-y-4">
//             {messages.map((msg, index) => (
//               <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
//                 <div className={`max-w-md p-3 rounded-lg ${
//                   msg.sender === 'user' ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]' :
//                   msg.sender === 'ai' ? 'bg-blue-500 text-white' : 'bg-[#444] text-white'
//                 }`}>
//                   {msg.text}
//                 </div>
//               </div>
//             ))}
//             <div ref={messagesEndRef}></div>
//           </div>
//           {/* Input & Voice Button */}
//           <div className="p-4 border-t border-[#333] bg-[#1e1e1e]">
//             <div className="flex">
//               <input
//                 type="text"
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
//                 placeholder="Type your message or use the mic..."
//                 className="flex-grow p-2 rounded-l bg-[#2a2a2a] text-white placeholder-gray-400 focus:outline-none"
//               />
//               <button
//                 onClick={handleVoiceInput}
//                 className={`px-4 bg-blue-600 text-white rounded-r hover:bg-blue-700 transition duration-200 ${
//                   isListening ? 'animate-pulse' : ''
//                 }`}
//                 title="Click to speak"
//               >
//                 <i className="fa-solid fa-microphone"></i>
//               </button>
//             </div>
//             {isListening && (
//               <p className="text-center text-sm text-blue-400 animate-pulse mt-1">
//                 Listening...
//               </p>
//             )}
//           </div>
//         </div>
//         {/* Draggable Divider */}
//         <div
//           onMouseDown={startDragging}
//           className={`w-2 cursor-col-resize bg-[#222] hover:bg-blue-600 transition-colors duration-150`}
//           style={{
//             zIndex: 10,
//             userSelect: 'none'
//           }}
//         />
//         {/* Recommendations section - Right side */}
//         {recommendations.length > 0 && (
//           <div
//             className="flex flex-col border-l border-[#333] overflow-hidden"
//             style={{
//               width: `calc(100% - ${chatWidth + 8}px)`, // 8px for divider
//               minWidth: 220,
//               backgroundColor: getMoodColors().background
//             }}
//           >
//             <div className="p-3 border-b border-[#333] shadow-md flex items-center justify-between">
//               <h3 className="font-bold text-lg" style={{ color: getMoodColors().text }}>
//                 Recommendations
//               </h3>
              
//              <div className='flex items-center gap-4'>
//               <span className="text-lg font-bold" style={{ color: getMoodColors().accent }}>
//                 {recommendations.length} songs
//               </span>
//               <div className='flex items-center gap-2'> 
//                   <button 
//                     className={`px-3 py-1 rounded text-xs font-medium flex items-center ${
//                       autoplayEnabled ? 'bg-green-500' : 'bg-gray-600'
//                     }`}
//                     onClick={() => setAutoplayEnabled(!autoplayEnabled)}
//                     title={autoplayEnabled ? "Disable autoplay" : "Enable autoplay"}
//                   >
//                     <i className={`fa-solid fa-forward-step mr-1`}></i>
//                     Autoplay: {autoplayEnabled ? "ON" : "OFF"}
//                   </button>
//               </div> 
//               <div className='text-white-400 hover:text-green-500 transition-transform duration-300 hover:scale-130' onClick={handleShuffle}>
//               <FontAwesomeIcon icon={faShuffle} />
//               </div>
//               </div>
//             </div>

          
//           <div className="overflow-y-auto flex-grow p-3">
//             {renderRecommendations()}
//           </div>
            
//           </div>
          
//         )}
//       </div>
//       {/* Playlist Modal */}
//       {showPlaylistModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-[#252525] p-6 rounded-lg w-80 max-w-md">
//             <h3 className="text-xl font-semibold mb-4">Select a playlist</h3>
//             {playlists.length > 0 ? (
//               <div className="mb-4 max-h-60 overflow-y-auto">
//                 <h4 className="text-gray-300 mb-2">Your playlists:</h4>
//                 <ul className="space-y-2">
//                   {playlists.map((playlist) => (
//                     <li key={playlist._id} className="flex justify-between items-center">
//                       <span>{playlist.name} ({playlist.songs?.length || 0} songs)</span>
//                       <button
//                         onClick={() => addSongToPlaylist(playlist._id)}
//                         className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
//                       >
//                         Add
//                       </button>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             ) : (
//               <p className="mb-4 text-gray-400">You do not have any playlists yet.</p>
//             )}
//             <div className="border-t border-gray-600 pt-4 mt-4">
//               <h4 className="text-gray-300 mb-2">Create new playlist</h4>
//               <div className="flex space-x-2">
//                 <input
//                   type="text"
//                   value={newPlaylistName}
//                   onChange={(e) => setNewPlaylistName(e.target.value)}
//                   placeholder="Enter playlist name"
//                   className="flex-grow p-2 border border-[#444] rounded bg-[#333] text-white focus:outline-none"
//                 />
//                 <button
//                   onClick={handleAddToNewPlaylist}
//                   className="bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600"
//                 >
//                   Create & add
//                 </button>
//               </div>
//             </div>
//             <div className="mt-6">
//               <button
//                 onClick={() => setShowPlaylistModal(false)}
//                 className="w-full bg-gray-700 text-white py-2 rounded hover:bg-gray-600 transition"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default Chatbot;


import { faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import { useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { useSocket } from "../context/SocketContext";
import RecommendationCard from './RecommendationCard';

function Chatbot() {
  // Context and state
  const { user } = useContext(AuthContext);
  const {socket,connected}=useSocket();
  const userId = user?._id;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  //Autoplay feature states
  const [currentPlayingIndex,setCurrentPlayingIndex]=useState(null);
  const [autoplayEnabled,setAutoplayEnabled]=useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const observerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const recognitionRef = useRef(null);
  const autoplayTimeoutRef = useRef(null);

  // --- Resizable panel state ---
  const [chatWidth, setChatWidth] = useState(500); // px
  const isDraggingRef = useRef(false);

  // Authentication header helper
  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      console.error("No authentication token found!");
      return { 'Content-Type': 'application/json' };
    }
    return { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load messages from sessionStorage when component mounts
  useEffect(() => {
    if (user) {
      const savedMessagesString = sessionStorage.getItem(`chat_messages_${user._id}`);
      let savedMessages = [];
      try {
        if (savedMessagesString) {
          savedMessages = JSON.parse(savedMessagesString);
        }
        if (savedMessages.length === 0) {
          const welcomeMessage = {
            text: "Hi! I'm ZENOVA, your music therapy assistant. How are you feeling today? I can recommend some music based on your mood and preferences.",
            sender: 'assistant'
          };
          setMessages([welcomeMessage]);
          sessionStorage.setItem(`chat_messages_${user._id}`, JSON.stringify([welcomeMessage]));
        } else {
          setMessages(savedMessages);
        }
        const savedRecommendations = sessionStorage.getItem(`recommendations_${user._id}`);
        if (savedRecommendations) {
          try {
            setRecommendations(JSON.parse(savedRecommendations));
          } catch (error) {
            console.error('Error parsing saved recommendations:', error);
          }
        }
        const savedMood = sessionStorage.getItem(`mood_${user._id}`);
        if (savedMood) {
          setMood(savedMood);
        }
      } catch (error) {
        console.error('Error handling messages:', error);
        const welcomeMessage = {
          text: "Hi! I'm ZENOVA, your music therapy assistant. How are you feeling today? I can recommend some music based on your mood and preferences.",
          sender: 'assistant'
        };
        setMessages([welcomeMessage]);
      }
    } else {
      setMessages([]);
      setRecommendations([]);
      setMood(null);
    }
  }, [user]);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (user && messages.length > 0) {
      sessionStorage.setItem(`chat_messages_${user._id}`, JSON.stringify(messages));
    }
  }, [messages, user]);
  
  // Save recommendations to sessionStorage whenever they change
  useEffect(() => {
    if (user && recommendations.length > 0) {
      sessionStorage.setItem(`recommendations_${user._id}`, JSON.stringify(recommendations));
      if (mood) {
        sessionStorage.setItem(`mood_${user._id}`, mood);
      }
    }
  }, [recommendations, mood, user]);

  // Voice recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      console.warn('Speech Recognition not supported in this browser.');
    }
  }, []);

  // Set up scroll observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => { isAtBottomRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    if (messagesEndRef.current) observerRef.current.observe(messagesEndRef.current);
    return () => observerRef.current?.disconnect();
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- Resizer logic ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const min = 320;
      const max = Math.max(window.innerWidth * 0.7, min);
      let newWidth = e.clientX;
      if (newWidth < min) newWidth = min;
      if (newWidth > max) newWidth = max;
      setChatWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDragging = (e) => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleVoiceInput = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // Fetch user playlists
  const fetchPlaylists = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/playlists/my-playlists`, {
        headers: getAuthHeader()
      });
      if (response.ok) setPlaylists(await response.json());
    } catch (error) {
      console.error("Error fetching playlists:", error);
    }
  };

  //Autoplay Feature
  const handleTrackEnded = (index) => {
    console.log('Track ended called with index:', index);
    console.log('Autoplay conditions:', {
      autoplayEnabled,
      index,
      recommendationsLength: recommendations.length
    });

    if (autoplayEnabled && index !== null && index < recommendations.length - 1) {
      const nextIndex = index + 1;
      console.log(`Attempting to play next track: ${nextIndex}`);
      
      // Use a slight delay to ensure smooth transition
      setTimeout(() => {
        setCurrentPlayingIndex(nextIndex);
      }, 500);
    } else {
      console.log('Autoplay not triggered due to conditions');
    }
  };

  const startPlayingTrack=(index)=>{
    setCurrentPlayingIndex(index);
    // Get the current track's duration in milliseconds
    const currentTrack = recommendations[index];
    if (currentTrack && currentTrack.duration && autoplayEnabled) {
      // Add a small buffer (e.g., 500ms) to ensure the track completes
      const timeoutDuration = currentTrack.duration + 500;
      
      // Clear any existing timeout
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
      
      // Set a new timeout to play the next track
      autoplayTimeoutRef.current = setTimeout(() => {
        if (index < recommendations.length - 1) {
          setCurrentPlayingIndex(index + 1);
        }
      }, timeoutDuration);
    }
  }

  const extractSpotifyTrackId = (spotifyString) => {
    if (!spotifyString) return null;
    
    try {
      // Handle URI format (spotify:track:xyz)
      let matches = spotifyString.match(/spotify:track:([a-zA-Z0-9]+)/);
      if (matches && matches[1]) return matches[1];
      
      // Handle URL format with query parameters (https://open.spotify.com/track/xyz?si=abc)
      matches = spotifyString.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?|$)/);
      if (matches && matches[1]) return matches[1];
      
      // Handle direct ID (if already extracted)
      if (/^[a-zA-Z0-9]{22}$/.test(spotifyString)) return spotifyString;
      
      return null;
    } catch (error) {
      console.error("Error extracting Spotify track ID:", error);
      return null;
    }
  };

  // Mood color mapping based on medical research
  const moodColors = {
    happy: {
      primary: '#FFD700',
      secondary: '#FFA500',
      accent: '#FF6B6B',
      background: 'rgba(255, 245, 230, 0.05)',
      text: '#E5E7EB'
    },
    sad: {
      primary: '#3498DB',
      secondary: '#2980B9',
      accent: '#1ABC9C',
      background: 'rgba(232, 244, 248, 0.05)',
      text: '#E5E7EB'
    },
    angry: {
      primary: '#E74C3C',
      secondary: '#C0392B',
      accent: '#F39C12',
      background: 'rgba(253, 242, 240, 0.05)',
      text: '#E5E7EB'
    },
    calm: {
      primary: '#2ECC71',
      secondary: '#27AE60',
      accent: '#3498DB',
      background: 'rgba(232, 248, 245, 0.05)',
      text: '#E5E7EB'
    },
    anxious: {
      primary: '#9B59B6',
      secondary: '#8E44AD',
      accent: '#3498DB',
      background: 'rgba(245, 238, 248, 0.05)',
      text: '#E5E7EB'
    },
    stressed: {
      primary: '#1ABC9C',
      secondary: '#16A085',
      accent: '#3498DB',
      background: 'rgba(232, 248, 245, 0.05)',
      text: '#E5E7EB'
    },
    default: {
      primary: '#6366f1',
      secondary: '#4f46e5',
      accent: '#1DB954',
      background: 'rgba(99, 102, 241, 0.05)',
      text: '#E5E7EB'
    }
  };

  const getMoodColors = () => {
    return moodColors[mood?.toLowerCase()] || moodColors.default;
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!userId || userId.length !== 24) {
      setMessages(prev => [...prev, { text: 'Authentication error, please try again later.', sender: 'system' }]);
      return;
    }
    
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    try {
      const conversationHistory = messages.slice(-10);
      const response = await axios.post('http://localhost:3000/api/music/recommend/recommendations', {
        userId,
        message: userMessage.text,
        conversationHistory
      });
      
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { 
          text: response.data.response, 
          sender: 'assistant' 
        }]);
        
        if (response.data.recommendations && response.data.recommendations.length > 0) {
          setRecommendations(response.data.recommendations);
        }
        if (response.data.detectedMood) {
          setMood(response.data.detectedMood);
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error getting recommendations:", error);
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        text: 'Sorry, I encountered an error. Please try again.', 
        sender: 'system' 
      }]);
    }
  };

  // Playlist management
  const handleAddToPlaylist = async (songId) => {
    if (!userId) {
      alert("User not authenticated. Please log in.");
      return;
    }
    setSelectedSongId(songId);
    await fetchPlaylists();
    setShowPlaylistModal(true);
  };

  const createNewPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      alert("Please enter a playlist name");
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/playlists/create', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ userId, name: newPlaylistName })
      });
      if (!response.ok) throw new Error("Failed to create playlist.");
      const newPlaylist = await response.json();
      setPlaylists(prev => [...prev, newPlaylist]);
      setNewPlaylistName('');
      return newPlaylist._id;
    } catch (err) {
      console.error("Error creating playlist:", err);
      alert("Failed to create playlist. Please try again.");
      return null;
    }
  };

  const addSongToPlaylist = async (playlistId) => {
  if (!selectedSongId || !playlistId) return;
  
  try {
    const response = await fetch('http://localhost:3000/api/playlists/addsong', {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ playlistId, songId: selectedSongId })
    });
    
    const data = await response.json();
    
    if (response.status === 409 && data.type === 'duplicate_song') {
      // Song already exists in playlist
      alert(`"${data.songTitle}" by ${data.artist} is already in "${data.playlistName}"`);
      setShowPlaylistModal(false);
      setSelectedSongId(null);
      return;
    }
    
    if (!response.ok) {
      throw new Error(data.message || "Failed to add song to playlist");
    }
    
    const songToAdd = recommendations.find(song => song.musicId === selectedSongId);
    
    // Emit add_song event to backend
    if (socket && connected) {
      socket.emit('add_song', {
        playlistId,
        song: songToAdd,
        userId: user._id,
        username: user.name
      });
    }
    
    // Show success message with song details
    const successMessage = data.addedSong 
      ? `"${data.addedSong.title}" by ${data.addedSong.artist} added successfully!`
      : "Song added to playlist successfully!";
    
    alert(successMessage);
    setShowPlaylistModal(false);
    setSelectedSongId(null);
    await fetchPlaylists();
    
  } catch (err) {
    console.error("Error adding song:", err);
    alert(err.message || "Failed to add song. Please try again.");
  }
};

  const handleAddToNewPlaylist = async () => {
    const newPlaylistId = await createNewPlaylist();
    if (newPlaylistId) await addSongToPlaylist(newPlaylistId);
  };

  const renderRecommendations = () => {
    return recommendations.map((song, index) => (
      <div 
        key={index}
        className="transform transition-all duration-500 ease-out animate-fade-in-up"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <RecommendationCard
          song={song}
          moodColors={getMoodColors()}
          onAddToPlaylist={handleAddToPlaylist}
          isCurrentlyPlaying={index === currentPlayingIndex}
          autoplayEnabled={autoplayEnabled}
          onTrackEnded={()=> handleTrackEnded(index)}
          onPlay={()=> startPlayingTrack(index)}
        />
      </div>
    ));
  };

  const handleShuffle=()=>{
    const shuffled=[...recommendations];
    for(let i=shuffled.length-1;i>0;i--){
      let j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    setRecommendations(shuffled);
  }

  return (
    <div className="sticky top-0 z-40 flex flex-col h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white overflow-hidden">
      {/* Animated Background */}
      {/* <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-green-400 to-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-5 animate-pulse" style={{animationDelay: '1s'}}></div>
      </div> */}

      {/* Header */}
      <div className="relative bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between transition-all duration-300 hover:bg-white/10">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110 hover:rotate-12">
              <i className="fa-solid fa-music text-white text-sm"></i>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-xl font-light tracking-wide text-white">ZENOVA</h1>
            <p className="text-xs text-gray-400">Music Therapy Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {mood && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 transition-all duration-300 hover:bg-white/20">
              {mood}
            </div>
          )}
          <button className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:rotate-12">
            <i className="fa-solid fa-moon text-sm"></i>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-grow overflow-hidden relative">
        {/* Chat Messages - Left side */}
        <div
          className="flex flex-col h-full overflow-hidden relative"
          style={{
            width: chatWidth,
            minWidth: 320,
            maxWidth: '70vw',
            transition: isDraggingRef.current ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`max-w-md p-4 rounded-3xl transition-all duration-300 transform hover:scale-105 ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/25' :
                  msg.sender === 'assistant' 
                    ? 'bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-lg' 
                    : 'bg-red-500/20 border border-red-500/30 text-red-200'
                }`}>
                  <div className="text-sm leading-relaxed">{msg.text}</div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-lg p-4 rounded-3xl">
                  <div className="flex space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-xs text-gray-400 ml-2">ZENOVA is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef}></div>
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white/5 backdrop-blur-xl border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Share your thoughts or feelings..."
                className="w-full p-4 pr-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
              />
              <button
                onClick={isListening ? null : handleVoiceInput}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:scale-110 shadow-lg hover:shadow-purple-500/50'
                }`}
                title={isListening ? "Listening..." : "Click to speak"}
              >
                <i className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'} text-sm`}></i>
              </button>
            </div>
            
            {isListening && (
              <div className="flex items-center justify-center mt-3 space-x-2 animate-fade-in">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                <p className="text-sm text-red-400">Listening for your voice...</p>
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          onMouseDown={startDragging}
          className="w-1 cursor-col-resize bg-gradient-to-b from-purple-500/50 to-indigo-500/50 hover:bg-gradient-to-b hover:from-purple-400 hover:to-indigo-400 transition-all duration-300 relative group"
          style={{ zIndex: 10, userSelect: 'none' }}
        >
          <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Recommendations section - Right side */}
        {recommendations.length > 0 && (
          <div
            className="flex flex-col overflow-hidden relative"
            style={{
              width: `calc(100% - ${chatWidth + 4}px)`,
              minWidth: 220,
              background: `linear-gradient(135deg, ${getMoodColors().background}, rgba(15, 23, 42, 0.8))`
            }}
          >
            {/* Recommendations Header */}
            <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full"></div>
                <div>
                  <h3 className="text-lg font-light text-white tracking-wide">Recommendations</h3>
                  <p className="text-xs text-gray-400">{recommendations.length} curated tracks</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button 
                  className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 ${
                    autoplayEnabled 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25' 
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20'
                  }`}
                  onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                  title={autoplayEnabled ? "Disable autoplay" : "Enable autoplay"}
                >
                  <i className="fa-solid fa-forward-step"></i>
                  <span>Autoplay</span>
                  <div className={`w-2 h-2 rounded-full ${autoplayEnabled ? 'bg-white' : 'bg-gray-400'}`}></div>
                </button>
                
                <button 
                  onClick={handleShuffle}
                  className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:rotate-180"
                  title="Shuffle playlist"
                >
                  <FontAwesomeIcon icon={faShuffle} className="text-sm" />
                </button>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="overflow-y-auto flex-grow p-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {renderRecommendations()}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl w-96 max-w-md shadow-2xl transform animate-scale-in">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-list-music text-white text-sm"></i>
              </div>
              <h3 className="text-xl font-light text-white">Add to Playlist</h3>
            </div>
            
            {playlists.length > 0 ? (
              <div className="mb-6 max-h-60 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                <h4 className="text-gray-300 text-sm font-medium mb-3">Your playlists</h4>
                {playlists.map((playlist) => (
                  <div key={playlist._id} className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
                    <div>
                      <span className="text-white font-medium">{playlist.name}</span>
                      <p className="text-gray-400 text-xs">{playlist.songs?.length || 0} songs</p>
                    </div>
                    <button
                      onClick={() => addSongToPlaylist(playlist._id)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <i className="fa-solid fa-music text-gray-400 text-2xl mb-2"></i>
                <p className="text-gray-400 text-sm">No playlists found</p>
              </div>
            )}
            
            <div className="border-t border-white/10 pt-6 mt-6">
              <h4 className="text-gray-300 text-sm font-medium mb-4">Create new playlist</h4>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name"
                  className="flex-grow p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-300"
                />
                <button
                  onClick={handleAddToNewPlaylist}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-green-500/25 font-medium"
                >
                  Create
                </button>
              </div>
            </div>
            
            <div className="mt-8 flex space-x-3">
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white py-3 rounded-2xl hover:bg-white/20 transition-all duration-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }

        /* Custom scrollbar */
        .scrollbar-thin {
          scrollbar-width: thin;
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 2px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.8);
        }

        /* Smooth transitions for all interactive elements */
        * {
          transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 300ms;
        }
      `}</style>
    </div>
  );
}

export default Chatbot;


