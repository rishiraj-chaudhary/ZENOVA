import { faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import * as musicAPI from "../api/musicAPI.js";
import * as playlistAPI from "../api/playlistAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import useSpeechRecognition from "../hooks/useSpeechRecognition.js";
import CrisisSupport from "./CrisisSupport.jsx";
import RecommendationCard from "./RecommendationCard.jsx";
import SessionCheckIn from "./SessionCheckIn.jsx";

function Chatbot() {
  const { user } = useAuth();
  const { addSong } = useSocket();
  const userId = user?._id;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentPlayingIndex,setCurrentPlayingIndex]=useState(null);
  const [autoplayEnabled,setAutoplayEnabled]=useState(false);
  const [playlistError, setPlaylistError] = useState(null);
  const [support, setSupport] = useState(null);
  const [session, setSession] = useState(null);
  const [checkInPhase, setCheckInPhase] = useState(null);

  const messagesEndRef = useRef(null);
  const observerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const autoplayTimeoutRef = useRef(null);

  const [chatWidth, setChatWidth] = useState(500); // px
  const isDraggingRef = useRef(false);

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

  useEffect(() => {
    if (user && messages.length > 0) {
      sessionStorage.setItem(`chat_messages_${user._id}`, JSON.stringify(messages));
    }
  }, [messages, user]);
  
  useEffect(() => {
    if (user && recommendations.length > 0) {
      sessionStorage.setItem(`recommendations_${user._id}`, JSON.stringify(recommendations));
      if (mood) {
        sessionStorage.setItem(`mood_${user._id}`, mood);
      }
    }
  }, [recommendations, mood, user]);


  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => { isAtBottomRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    if (messagesEndRef.current) observerRef.current.observe(messagesEndRef.current);
    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const startDragging = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const { listening: isListening, start: handleVoiceInput } = useSpeechRecognition({
    onResult: setInput,
  });

  const fetchPlaylists = async () => {
    if (!userId) return;
    try {
      setPlaylists(await playlistAPI.fetchMyPlaylists());
    } catch (error) {
      console.error("Error fetching playlists:", error.message);
    }
  };

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
      
      setTimeout(() => {
        setCurrentPlayingIndex(nextIndex);
      }, 500);
    } else {
      console.log('Autoplay not triggered due to conditions');
    }
  };

  const startPlayingTrack=(index)=>{
    setCurrentPlayingIndex(index);
    const currentTrack = recommendations[index];
    if (currentTrack && currentTrack.duration && autoplayEnabled) {
      const timeoutDuration = currentTrack.duration + 500;
      
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
      
      autoplayTimeoutRef.current = setTimeout(() => {
        if (index < recommendations.length - 1) {
          setCurrentPlayingIndex(index + 1);
        }
      }, timeoutDuration);
    }
  }


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

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!userId) {
      setMessages((prev) => [
        ...prev,
        { text: "Please sign in to get recommendations.", sender: "system" },
      ]);
      return;
    }

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    setSupport(null);

    try {
      const result = await musicAPI.fetchRecommendations({
        message: userMessage.text,
        conversationHistory: messages.slice(-10),
      });

      setIsTyping(false);
      setMessages((prev) => [...prev, { text: result.response, sender: "assistant" }]);

      // Support contacts accompany an elevated-risk reply and replace the reply
      // entirely at crisis level, where the server returns no recommendations.
      if (result.supportResources?.length) {
        setSupport({
          level: result.riskLevel,
          resources: result.supportResources,
          notice: result.emergencyNotice,
        });
      }

      if (result.recommendations?.length) {
        setRecommendations(result.recommendations);
        setSession(result.sessionId ?? null);
        setCheckInPhase(result.sessionId ? "before" : null);
      }
      if (result.detectedMood) setMood(result.detectedMood);
    } catch (error) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { text: `Sorry, I could not get recommendations: ${error.message}`, sender: "system" },
      ]);
    }
  };

  /** Saves every recommendation at once, instead of one modal trip per song. */
  const handleSaveAll = async () => {
    if (!recommendations.length) return;

    setPlaylistError(null);
    setSelectedSongId("__all__");
    await fetchPlaylists();
    setShowPlaylistModal(true);
  };

  const handleAddToPlaylist = async (songId) => {
    if (!userId) return;

    setPlaylistError(null);
    setSelectedSongId(songId);
    await fetchPlaylists();
    setShowPlaylistModal(true);
  };

  const createNewPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setPlaylistError("Please enter a playlist name");
      return null;
    }

    try {
      const created = await playlistAPI.createPlaylist(newPlaylistName);
      setPlaylists((prev) => [...prev, created]);
      setNewPlaylistName("");
      return created._id;
    } catch (error) {
      setPlaylistError(error.message);
      return null;
    }
  };

  const addSongToPlaylist = async (playlistId) => {
    if (!selectedSongId || !playlistId) return;

    const targets =
      selectedSongId === "__all__"
        ? recommendations.map((song) => song.musicId)
        : [selectedSongId];

    try {
      // Settled rather than all: one duplicate song must not abort the rest.
      const results = await Promise.allSettled(
        targets.map((songId) => playlistAPI.addSong({ playlistId, songId }))
      );

      const failures = results.filter((r) => r.status === "rejected");
      const savedCount = results.length - failures.length;

      recommendations
        .filter((song) => targets.includes(song.musicId))
        .forEach((song) => addSong(playlistId, song));

      if (failures.length && savedCount === 0) {
        setPlaylistError(failures[0].reason?.message ?? "Could not save");
        return;
      }

      setPlaylistError(
        failures.length ? `Saved ${savedCount}, skipped ${failures.length} already present` : null
      );
      setShowPlaylistModal(false);
      setSelectedSongId(null);
      await fetchPlaylists();
    } catch (error) {
      setPlaylistError(error.message);
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
          sessionId={session}
          moodAtTime={mood}
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
            
            {support && (
              <CrisisSupport
                level={support.level}
                resources={support.resources}
                notice={support.notice}
                onDismiss={() => setSupport(null)}
              />
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
              {session && checkInPhase && (
                <SessionCheckIn
                  sessionId={session}
                  phase={checkInPhase}
                  onComplete={() => setCheckInPhase(checkInPhase === "before" ? null : null)}
                  onSkip={() => setCheckInPhase(null)}
                />
              )}

              <button
                type="button"
                onClick={handleSaveAll}
                className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <i className="fa-solid fa-bookmark mr-2" aria-hidden="true" />
                Save all {recommendations.length} to a playlist
              </button>

              {renderRecommendations()}

              {session && checkInPhase === null && (
                <SessionCheckIn
                  sessionId={session}
                  phase="after"
                  onComplete={() => setSession(null)}
                  onSkip={() => setSession(null)}
                />
              )}
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

            {playlistError && (
              <p role="alert" className="mb-4 text-sm text-red-300">
                {playlistError}
              </p>
            )}
            
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

