import SpotifyPlayer from './SpotifyPlayer';

/**
 * RecommendationCard component that displays a music recommendation
 * with consistent Spotify ID extraction and formatting
 */
function RecommendationCard({ index,song, moodColors, onAddToPlaylist , isCurrentlyPlaying ,autoplayEnabled,onTrackEnded,onPlay}) {
  // Try multiple sources to find a valid track ID
  const extractSpotifyTrackId = (spotifyString) => {
    if (!spotifyString) return null;
    console.log("RecommendationCard song object:", song);
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

  // Extract the Spotify track ID from various possible properties
  let spotifyTrackId = null;
  
  // Attempt to extract from different fields, in order of preference
  if (song.spotifyId && typeof song.spotifyId === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyId);
  }
  
  if (!spotifyTrackId && song.spotifyUri && typeof song.spotifyUri === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyUri);
  }
  
  if (!spotifyTrackId && song.spotifyUrl && typeof song.spotifyUrl === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyUrl);
  }

  //Handle click on card to start playing song
  const handleCardClick=()=>{
    if(onPlay){
        onPlay(index);
    }
  }

  return (
    <div 
      className="p-4 rounded-lg mb-4 shadow-md transform hover:scale-[1.01] transition-transform duration-200" 
      style={{ backgroundColor: moodColors.primary }} onClick={handleCardClick}
    >
      {/* Song header with album art */}
      <div className="flex items-center mb-3">
        {song.albumArt ? (
          <img 
            src={song.albumArt} 
            alt={`${song.title} album art`} 
            className="w-12 h-12 rounded-lg mr-3 object-cover shadow-md"
          />
        ) : (
          <div 
            className="w-12 h-12 rounded-lg mr-3 flex items-center justify-center shadow-md" 
            style={{ backgroundColor: moodColors.secondary }}
          >
            <i className="fa-solid fa-music text-2xl" style={{ color: moodColors.background }}></i>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h4 className="font-bold text-base truncate" style={{ color: moodColors.text }}>
            {song.title}
          </h4>
          <p className="text-sm truncate" style={{ color: moodColors.text }}>
            {song.artist}
          </p>
        </div>
      </div>

      {/* Spotify Player */}
      {spotifyTrackId && (
        <div className="mb-3">
          <SpotifyPlayer 
            trackId={spotifyTrackId} 
            title={song.title} 
            artist={song.artist}
            albumArt={song.albumArt}
            onTrackEnded={onTrackEnded}
            autoplayEnabled={autoplayEnabled}
            isCurrentlyPlaying={isCurrentlyPlaying}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {!spotifyTrackId && !song.audioUrl && (
          <div>
            <p>This song is not available</p>
          </div>
        )}
        
        {!spotifyTrackId && song.audioUrl && (
          <a
            href={song.audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded text-xs font-medium flex items-center"
            style={{ backgroundColor: '#FF0000', color: '#FFFFFF' }}
          >
            <i className="fa-brands fa-youtube mr-1"></i> YouTube
          </a>
        )}
        
        {song.spotifyUrl && (
          <a 
            href={song.spotifyUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3 py-1 rounded text-xs font-medium flex items-center"
            style={{ backgroundColor: '#1DB954', color: '#FFFFFF' }}
          >
            <i className="fa-brands fa-spotify mr-1"></i> Spotify
          </a>
        )}
        
        <button 
          onClick={(e) =>{ 
            e.stopPropagation();
            onAddToPlaylist(song.musicId)}}
          className="px-3 py-1 rounded text-xs font-medium flex items-center"
          style={{ backgroundColor: moodColors.secondary, color: '#FFFFFF' }}
        >
          <i className="fa-solid fa-plus mr-1"></i> Add
        </button>
      </div>

      {/* Recommendation reason */}
      <div 
        className="p-2 rounded text-xs italic" 
        style={{ backgroundColor: moodColors.secondary, color: '#FFFFFF' }}
      >
        {song.reason}
      </div>
    </div>
  );
}

export default RecommendationCard;