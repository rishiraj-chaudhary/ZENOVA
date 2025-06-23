// import React, { useEffect, useState } from 'react';

// const SpotifyPlayer = ({ trackId, title, artist, albumArt }) => {
//   const [isLoading, setIsLoading] = useState(true);
//   const [embedUrl, setEmbedUrl] = useState(null);
//   const [playerError, setPlayerError] = useState(null);

//   useEffect(() => {
//     if (!trackId) {
//       console.log("No track ID provided");
//       return;
//     }
//     console.log("Fetching embed URL for track ID:", trackId);
//     const fetchEmbedUrl = async () => {
//       try {
//         // Use the getSpotifyEmbed endpoint from your musicController
//         const url = `http://localhost:3000/api/music/recommend/spotify/embed/${trackId}`;
//         console.log("Fetching from URL:", url);
//         const response = await fetch(`http://localhost:3000/api/music/recommend/spotify/embed/${trackId}`);
        
//         if (!response.ok) {
//           throw new Error(`Failed to get embed URL: ${response.status}`);
//         }
        
//         const data = await response.json();
//         setEmbedUrl(data.embedUrl);
//       } catch (error) {
//         console.error("Error fetching Spotify embed URL:", error);
//         setPlayerError("Unable to load Spotify player");
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchEmbedUrl();
//   }, [trackId]);

//   if (!trackId) {
//     return (
//       <div className="flex items-center p-2 bg-[#252525] rounded-md">
//         <div className="text-gray-400 text-sm">
//           No Spotify track available
//         </div>
//       </div>
//     );
//   }

//   if (isLoading) {
//     return (
//       <div className="flex justify-center items-center h-20 bg-[#1e1e1e] rounded-md">
//         <div className="text-gray-400">Loading player...</div>
//       </div>
//     );
//   }

//   if (playerError) {
//     return (
//       <div className="flex items-center p-2 bg-[#252525] rounded-md">
//         <div className="text-red-400 text-sm">{playerError}</div>
//       </div>
//     );
//   }

//   return (
//     <div className="spotify-player-container rounded-md overflow-hidden">
//       <iframe 
//         src={embedUrl}
//         width="100%" 
//         height="80" 
//         frameBorder="0" 
//         allowTransparency="true" 
//         allow="encrypted-media"
//         title={`${title} by ${artist}`}
//       ></iframe>
//     </div>
//   );
// };

// export default SpotifyPlayer;



///CURRENT

// import React, { useEffect, useState } from 'react';

// function SpotifyPlayer({ trackId, title, artist }) {
//   const [playerLoaded, setPlayerLoaded] = useState(false);
//   const [playerError, setPlayerError] = useState(false);
//   const [loadAttempts, setLoadAttempts] = useState(0);

//   // Reset player states when trackId changes
//   useEffect(() => {
//     setPlayerLoaded(false);
//     setPlayerError(false);
//     setLoadAttempts(0);
//   }, [trackId]);

//   if (!trackId) {
//     return (
//       <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
//         <p>No Spotify preview available for "{title}" by {artist}</p>
//       </div>
//     );
//   }

//   // Use the newer Spotify embed format with proper parameters
//   const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

//   const handlePlayerLoad = () => {
//     setPlayerLoaded(true);
//   };

//   const handlePlayerError = () => {
//     setPlayerError(true);
//     // Try refreshing the player once
//     if (loadAttempts < 1) {
//       setTimeout(() => {
//         setLoadAttempts(loadAttempts + 1);
//         setPlayerError(false);
//       }, 1000);
//     }
//   };

//   return (
//     <div className="spotify-player relative">
//       {playerError && loadAttempts >= 1 ? (
//         <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
//           <p>Spotify player failed to load. <a 
//             href={`https://open.spotify.com/track/${trackId}`}
//             target="_blank" 
//             rel="noopener noreferrer"
//             className="text-green-400 hover:underline"
//           >
//             Open in Spotify
//           </a></p>
//         </div>
//       ) : (
//         <>
//           <iframe
//             src={embedUrl}
//             width="100%"
//             height="152"
//             frameBorder="0"
//             allowFullScreen={true}
//             allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
//             loading="lazy"
//             onLoad={handlePlayerLoad}
//             onError={handlePlayerError}
//             title={`${title} by ${artist}`}
//           ></iframe>
  
          
//           {!playerLoaded && loadAttempts < 1 && (
//             <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70">
//               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }

// export default SpotifyPlayer;

///////////////////////////////--------------------------////////////////////
// import React, { useEffect, useState } from 'react';

// /**
//  * SpotifyPlayer component that handles displaying a Spotify embed player
//  * with improved error handling and ID extraction
//  */
// function SpotifyPlayer({ trackId, title, artist, albumArt ,onTrackEnded,autoplayEnabled,isCurrentlyPlaying}) {
//   const [playerLoaded, setPlayerLoaded] = useState(false);
//   const [playerError, setPlayerError] = useState(false);
//   const [loadAttempts, setLoadAttempts] = useState(0);
//   const [validatedTrackId, setValidatedTrackId] = useState(null);
  
//   // Extract and validate track ID when component mounts or trackId changes
//   useEffect(() => {
//     setPlayerLoaded(false);
//     setPlayerError(false);
//     setLoadAttempts(0);
    
//     // Try to extract a valid track ID
//     const extractedId = extractSpotifyTrackId(trackId);
//     setValidatedTrackId(extractedId);
    
//     // Log for debugging
//     console.log(`SpotifyPlayer for "${title}": Input ID = ${trackId}, Validated ID = ${extractedId}`);
//   }, [trackId, title]);


//   //Message event listener for spotify messages
//   useEffect(()=>{
//     const handleSpotifyMessage=(event)=>{
//       //only process spotify messages
//       console.log("Received message from:", event.origin);
//       if(event.origin!=="https://open.spotify.com"){
//         return;
//       }
//       // Log raw data for debugging
//       console.log("Raw event.data:", event.data);
//       console.log("Type of event.data:", typeof event.data);
//       try{
//         const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
//         console.log("Spotify message data:", data);
//         console.log("Message data type:", typeof event.data);
//         console.log("Message data:", event.data);
//         if(data.type==='playback_update'){//whenever the playback of Spotify embed changes
//           //if track has ended --> playback position becomes 0
//           if(data.payload && data.payload.position===0 && data.payload.duration>0){
//             console.log('Track ended, triggering onTrackEnded callback');
//             if(onTrackEnded && autoplayEnabled){
//               onTrackEnded();
//             }
//           }
//         }
//       }catch(err){
//         console.log("Error processing spotify message:",err);
//       }

//     }
//     window.addEventListener('message',handleSpotifyMessage);
//     return()=>window.removeEventListener('message',handleSpotifyMessage);

//   },[onTrackEnded,autoplayEnabled]);

  
//   // Helper function to extract Spotify track ID from various formats
//   function extractSpotifyTrackId(spotifyString) {
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
//   }

//   // Handle player loading success
//   const handlePlayerLoad = () => {
//     setPlayerLoaded(true);
//   };

//   // Handle player loading error with retry logic
//   const handlePlayerError = () => {
//     setPlayerError(true);
//     // Try refreshing the player once
//     if (loadAttempts < 1) {
//       setTimeout(() => {
//         setLoadAttempts(loadAttempts + 1);
//         setPlayerError(false);
//       }, 1000);
//     }
//   };

//   // If no valid track ID could be extracted
//   if (!validatedTrackId) {
//     return (
//       <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
//         <div className="flex items-center justify-center mb-2">
//           {albumArt ? (
//             <img 
//               src={albumArt} 
//               alt={`${title} album art`} 
//               className="w-10 h-10 rounded mr-2"
//             />
//           ) : (
//             <div className="w-10 h-10 rounded flex items-center justify-center bg-gray-700">
//               <i className="fa-solid fa-music"></i>
//             </div>
//           )}
//           <p>No Spotify preview available for "{title}" by {artist}</p>
//         </div>
//       </div>
//     );
//   }

//   // Use the newer Spotify embed format with proper parameters
//   // Add autoplay=1 if this is the currently playing track
//   const embedUrl = `https://open.spotify.com/embed/track/${validatedTrackId}?utm_source=generator&theme=0${isCurrentlyPlaying ? '&autoplay=1' : ''}`;

//   return (
//     <div className="spotify-player relative">
//       {playerError && loadAttempts >= 1 ? (
//         <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
//           <p>
//             Spotify player failed to load.{" "}
//             <a
//               href={`https://open.spotify.com/track/${validatedTrackId}`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-green-400 hover:underline"
//             >
//               Open in Spotify
//             </a>
//           </p>
//         </div>
//       ) : (
//         <>
//           <iframe
//             src={embedUrl}
//             width="100%"
//             height="152"
//             frameBorder="0"
//             allowFullScreen={true}
//             allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
//             loading="lazy"
//             onLoad={handlePlayerLoad}
//             onError={handlePlayerError}
//             title={`${title} by ${artist}`}
//           ></iframe>
          
//           {!playerLoaded && loadAttempts < 1 && (
//             <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70">
//               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }

// export default SpotifyPlayer;


///////////////////////////////--------------------------////////////////////


import React, { useEffect, useRef, useState } from 'react';

/**
 * SpotifyPlayer component that handles displaying a Spotify embed player
 * with improved error handling and ID extraction
 */
function SpotifyPlayer({ trackId, title, artist, albumArt, onTrackEnded, autoplayEnabled, isCurrentlyPlaying}) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [validatedTrackId, setValidatedTrackId] = useState(null);
  
  // Ref to track if track end has been processed to prevent multiple triggers
  const trackEndProcessedRef = useRef(false);
  
  // Extract and validate track ID when component mounts or trackId changes
  useEffect(() => {
    setPlayerLoaded(false);
    setPlayerError(false);
    setLoadAttempts(0);
    trackEndProcessedRef.current = false;
    
    // Try to extract a valid track ID
    const extractedId = extractSpotifyTrackId(trackId);
    setValidatedTrackId(extractedId);
    
    // Log for debugging
    console.log(`SpotifyPlayer for "${title}": Input ID = ${trackId}, Validated ID = ${extractedId}`);
  }, [trackId, title]);

  // Message event listener for spotify messages
  useEffect(() => {
    const handleSpotifyMessage = (event) => {
      // Only process spotify messages
      if (event.origin !== "https://open.spotify.com") {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Check if it's a playback update and track has truly ended
        if (
          data.type === 'playback_update' && 
          data.payload && 
          data.payload.position === 0 && 
          data.payload.duration > 0 &&
          !trackEndProcessedRef.current
        ) {
          console.log('Genuine track end detected');
          
          // Mark track end as processed to prevent multiple triggers
          trackEndProcessedRef.current = true;
          
          // Trigger track end only if autoplay is enabled
          if (autoplayEnabled) {
            console.log('Triggering onTrackEnded callback');
            onTrackEnded();
          }
        }
      } catch (err) {
        console.error("Error processing spotify message:", err);
      }
    };

    window.addEventListener('message', handleSpotifyMessage);
    return () => window.removeEventListener('message', handleSpotifyMessage);
  }, [onTrackEnded, autoplayEnabled]);
  
  // Helper function to extract Spotify track ID from various formats
  function extractSpotifyTrackId(spotifyString) {
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
  }

  // Handle player loading success
  const handlePlayerLoad = () => {
    setPlayerLoaded(true);
  };

  // Handle player loading error with retry logic
  const handlePlayerError = () => {
    setPlayerError(true);
    // Try refreshing the player once
    if (loadAttempts < 1) {
      setTimeout(() => {
        setLoadAttempts(loadAttempts + 1);
        setPlayerError(false);
      }, 1000);
    }
  };

  // If no valid track ID could be extracted
  if (!validatedTrackId) {
    return (
      <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
        <div className="flex items-center justify-center mb-2">
          {albumArt ? (
            <img 
              src={albumArt} 
              alt={`${title} album art`} 
              className="w-10 h-10 rounded mr-2"
            />
          ) : (
            <div className="w-10 h-10 rounded flex items-center justify-center bg-gray-700">
              <i className="fa-solid fa-music"></i>
            </div>
          )}
          <p>No Spotify preview available for "{title}" by {artist}</p>
        </div>
      </div>
    );
  }

  // Use the newer Spotify embed format with proper parameters
  // Add autoplay=1 if this is the currently playing track
  const embedUrl = `https://open.spotify.com/embed/track/${validatedTrackId}?utm_source=generator&theme=0${isCurrentlyPlaying ? '&autoplay=1' : ''}`;

  return (
    <div className="spotify-player relative">
      {playerError && loadAttempts >= 1 ? (
        <div className="bg-gray-800 text-gray-300 p-3 rounded text-center">
          <p>
            Spotify player failed to load.{" "}
            <a
              href={`https://open.spotify.com/track/${validatedTrackId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:underline"
            >
              Open in Spotify
            </a>
          </p>
        </div>
      ) : (
        <>
          <iframe
            src={embedUrl}
            width="100%"
            height="152"
            frameBorder="0"
            allowFullScreen={true}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
            loading="lazy"
            onLoad={handlePlayerLoad}
            onError={handlePlayerError}
            title={`${title} by ${artist}`}
          ></iframe>
          
          {!playerLoaded && loadAttempts < 1 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SpotifyPlayer;


// import React, { useEffect, useState } from 'react';

// const SpotifyPlayer = ({ trackId, title, artist, albumArt }) => {
//   const [player, setPlayer] = useState(null);
//   const [isActive, setIsActive] = useState(false);
//   const [isPaused, setIsPaused] = useState(true);
//   const [currentTrack, setCurrentTrack] = useState(null);
//   const [playerError, setPlayerError] = useState(null);
//   const [deviceId, setDeviceId] = useState(null);

//   // Initialize the SDK when component mounts
//   useEffect(() => {
//     if (!trackId) return;

//     // Load the Spotify SDK script
//     const script = document.createElement("script");
//     script.src = "https://sdk.scdn.co/spotify-player.js";
//     script.async = true;
//     document.body.appendChild(script);

//     // Initialize the player when SDK is ready
//     window.onSpotifyWebPlaybackSDKReady = () => {
//       // Get the token from your backend
//       const getToken = async () => {
//         try {
//           const response = await fetch('http://localhost:3000/api/music/recommend/spotify/token');
//           const data = await response.json();
//           return data.token;
//         } catch (error) {
//           console.error("Error fetching token:", error);
//           setPlayerError("Failed to get authentication token");
//           return null;
//         }
//       };

//       getToken().then(token => {
//         if (!token) return;

//         const player = new window.Spotify.Player({
//           name: 'ZENOVA Music Player',
//           getOAuthToken: cb => { cb(token); },
//           volume: 0.5
//         });

//         // Error handling
//         player.addListener('initialization_error', ({ message }) => {
//           console.error('Initialization error:', message);
//           setPlayerError('Failed to initialize player');
//         });

//         player.addListener('authentication_error', ({ message }) => {
//           console.error('Authentication error:', message);
//           setPlayerError('Authentication failed');
//         });

//         player.addListener('account_error', ({ message }) => {
//           console.error('Account error:', message);
//           setPlayerError('Premium account required');
//         });

//         player.addListener('playback_error', ({ message }) => {
//           console.error('Playback error:', message);
//           setPlayerError('Playback error occurred');
//         });

//         // Playback status updates
//         player.addListener('player_state_changed', state => {
//           if (!state) return;
          
//           setCurrentTrack(state.track_window.current_track);
//           setIsPaused(state.paused);
          
//           player.getCurrentState().then(state => {
//             setIsActive(!!state);
//           });
//         });

//         // Ready
//         player.addListener('ready', ({ device_id }) => {
//           console.log('Ready with Device ID', device_id);
//           setDeviceId(device_id);
          
//           // Play the specified track
//           if (trackId) {
//             playTrack(device_id, trackId, token);
//           }
//         });

//         // Not Ready
//         player.addListener('not_ready', ({ device_id }) => {
//           console.log('Device ID has gone offline', device_id);
//           setDeviceId(null);
//         });

//         // Connect to the player
//         player.connect();
//         setPlayer(player);
//       });
//     };

//     return () => {
//       // Clean up
//       if (player) {
//         player.disconnect();
//       }
//     };
//   }, [trackId]);

//   // Function to play a specific track
//   const playTrack = async (deviceId, trackId, token) => {
//     if (!deviceId || !trackId || !token) return;
    
//     try {
//       await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           uris: [`spotify:track:${trackId}`]
//         })
//       });
//     } catch (error) {
//       console.error("Error playing track:", error);
//       setPlayerError("Failed to play track");
//     }
//   };

//   // Toggle play/pause
//   const togglePlay = () => {
//     if (!player) return;
//     player.togglePlay();
//   };

//   // Skip to next track
//   const skipNext = () => {
//     if (!player) return;
//     player.nextTrack();
//   };

//   // Skip to previous track
//   const skipPrevious = () => {
//     if (!player) return;
//     player.previousTrack();
//   };

//   if (!trackId) {
//     return (
//       <div className="flex items-center p-2 bg-[#252525] rounded-md">
//         <div className="text-gray-400 text-sm">
//           No Spotify track available
//         </div>
//       </div>
//     );
//   }

//   if (playerError) {
//     return (
//       <div className="flex items-center p-2 bg-[#252525] rounded-md">
//         <div className="text-red-400 text-sm">{playerError}</div>
//       </div>
//     );
//   }

//   return (
//     <div className="spotify-player-container rounded-md overflow-hidden bg-[#1e1e1e] p-3">
//       <div className="flex items-center">
//         {albumArt && (
//           <img 
//             src={albumArt} 
//             alt={`${title} by ${artist}`} 
//             className="w-12 h-12 rounded mr-3"
//           />
//         )}
//         <div className="flex-1 mr-3">
//           <div className="text-white text-sm font-medium truncate">{currentTrack?.name || title}</div>
//           <div className="text-gray-400 text-xs truncate">{currentTrack?.artists?.[0]?.name || artist}</div>
//         </div>
//         <div className="flex space-x-2">
//           <button 
//             onClick={skipPrevious}
//             className="text-white hover:text-green-400 focus:outline-none"
//             disabled={!isActive}
//           >
//             <i className="fa-solid fa-backward"></i>
//           </button>
//           <button 
//             onClick={togglePlay}
//             className="text-white hover:text-green-400 focus:outline-none"
//             disabled={!isActive}
//           >
//             <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
//           </button>
//           <button 
//             onClick={skipNext}
//             className="text-white hover:text-green-400 focus:outline-none"
//             disabled={!isActive}
//           >
//             <i className="fa-solid fa-forward"></i>
//           </button>
//         </div>
//       </div>
//       {!isActive && !playerError && (
//         <div className="mt-2 text-xs text-gray-400">
//           Connecting to Spotify...
//         </div>
//       )}
//     </div>
//   );
// };

// export default SpotifyPlayer;


// components/SimpleSpotifyPlayer.jsx

// import React, { useState } from 'react';
// const SpotifyPlayer= ({ trackId, title, artist }) => {
//   const [height, setHeight] = useState(152);

//   if (!trackId) {
//     return (
//       <div className="flex items-center p-2 bg-[#252525] rounded-md">
//         <div className="text-gray-400 text-sm">
//           No Spotify track available
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="spotify-embed-container rounded-md overflow-hidden" style={{ isolation: 'isolate' }}>
//       <iframe
//         src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
//         width="100%"
//         height={height}
//         frameBorder="0"
//         allowFullScreen=""
//         allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
//         loading="lazy"
//         onLoad={() => setHeight(80)} // Reset height after load if needed
//         style={{ maxWidth: '100%' }}
//         title={`${title} by ${artist}`}
//       ></iframe>
//     </div>
//   );
// };

// export default SpotifyPlayer;

