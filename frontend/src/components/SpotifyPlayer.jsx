

        
        

  
          

  
    
    

  
    
      
      
      

          

import { useEffect, useRef, useState } from "react";
import { extractSpotifyTrackId } from "../utils/spotify.js";
import YouTubeFallback from "./YouTubeFallback.jsx";

/**
 * SpotifyPlayer component that handles displaying a Spotify embed player
 * with improved error handling and ID extraction
 */
function SpotifyPlayer({ trackId, title, artist, albumArt, onTrackEnded, autoplayEnabled, isCurrentlyPlaying}) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [validatedTrackId, setValidatedTrackId] = useState(null);
  
  const trackEndProcessedRef = useRef(false);
  
  useEffect(() => {
    setPlayerLoaded(false);
    setPlayerError(false);
    setLoadAttempts(0);
    trackEndProcessedRef.current = false;
    
    const extractedId = extractSpotifyTrackId(trackId);
    setValidatedTrackId(extractedId);
    
    console.log(`SpotifyPlayer for "${title}": Input ID = ${trackId}, Validated ID = ${extractedId}`);
  }, [trackId, title]);

  useEffect(() => {
    const handleSpotifyMessage = (event) => {
      if (event.origin !== "https://open.spotify.com") {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (
          data.type === 'playback_update' && 
          data.payload && 
          data.payload.position === 0 && 
          data.payload.duration > 0 &&
          !trackEndProcessedRef.current
        ) {
          console.log('Genuine track end detected');
          
          trackEndProcessedRef.current = true;
          
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
  

  const handlePlayerLoad = () => {
    setPlayerLoaded(true);
  };

  const handlePlayerError = () => {
    setPlayerError(true);
    if (loadAttempts < 1) {
      setTimeout(() => {
        setLoadAttempts(loadAttempts + 1);
        setPlayerError(false);
      }, 1000);
    }
  };

  if (!validatedTrackId) {
    return <YouTubeFallback title={title} artist={artist} albumArt={albumArt} />;
  }

  const embedUrl = `https://open.spotify.com/embed/track/${validatedTrackId}?utm_source=generator&theme=0${isCurrentlyPlaying ? '&autoplay=1' : ''}`;

  return (
    <div className="spotify-player relative">
      {playerError && loadAttempts >= 1 ? (
        <div className="space-y-2">
          <YouTubeFallback
            title={title}
            artist={artist}
            albumArt={albumArt}
            reason="The Spotify player didn't load."
          />
          <a
            href={`https://open.spotify.com/track/${validatedTrackId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-green-400 hover:underline"
          >
            Or open in Spotify
          </a>
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

          
          

          

    

