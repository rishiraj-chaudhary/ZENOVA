import SongFeedback from "./SongFeedback.jsx";
import SpotifyPlayer from "./SpotifyPlayer.jsx";
import YouTubeFallback from "./YouTubeFallback.jsx";

/**
 * RecommendationCard component that displays a music recommendation
 * with consistent Spotify ID extraction and formatting
 */
function RecommendationCard({ index, song, moodColors, onAddToPlaylist, isCurrentlyPlaying, autoplayEnabled, onTrackEnded, onPlay, sessionId, moodAtTime }) {
  const extractSpotifyTrackId = (spotifyString) => {
    if (!spotifyString) return null;
    try {
      let matches = spotifyString.match(/spotify:track:([a-zA-Z0-9]+)/);
      if (matches && matches[1]) return matches[1];
      
      matches = spotifyString.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?|$)/);
      if (matches && matches[1]) return matches[1];
      
      if (/^[a-zA-Z0-9]{22}$/.test(spotifyString)) return spotifyString;
      
      return null;
    } catch (error) {
      console.error("Error extracting Spotify track ID:", error);
      return null;
    }
  };

  let spotifyTrackId = null;
  
  if (song.spotifyId && typeof song.spotifyId === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyId);
  }
  
  if (!spotifyTrackId && song.spotifyUri && typeof song.spotifyUri === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyUri);
  }
  
  if (!spotifyTrackId && song.spotifyUrl && typeof song.spotifyUrl === 'string') {
    spotifyTrackId = extractSpotifyTrackId(song.spotifyUrl);
  }

  const handleCardClick=()=>{
    if(onPlay){
        onPlay(index);
    }
  }

  return (
    <div 
      className="mb-4 rounded-lg bg-slate-800/80 p-4 shadow-md transition-transform duration-200 hover:scale-[1.01]"

      style={{ borderLeft: `4px solid ${moodColors.primary}` }}
      onClick={handleCardClick}
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
            style={{ backgroundColor: moodColors.primary }}
          >
            <i className="fa-solid fa-music text-2xl text-slate-900" aria-hidden="true"></i>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h4 className="truncate text-base font-bold text-white">
            {song.title}
          </h4>
          <p className="truncate text-sm text-gray-300">
            {song.artist}
          </p>
        </div>
      </div>

      {/* Playback. A third of the catalogue has no Spotify match, and those
          songs used to render nothing playable at all: YouTubeFallback existed
          but was only reachable from inside SpotifyPlayer, which only mounts
          once a track id is known. */}
      <div className="mb-3">
        {spotifyTrackId ? (
          <SpotifyPlayer
            trackId={spotifyTrackId}
            title={song.title}
            artist={song.artist}
            albumArt={song.albumArt}
            previewUrl={song.previewUrl}
            onTrackEnded={onTrackEnded}
            autoplayEnabled={autoplayEnabled}
            isCurrentlyPlaying={isCurrentlyPlaying}
          />
        ) : (
          <YouTubeFallback
            title={song.title}
            artist={song.artist}
            albumArt={song.albumArt}
            watchUrl={song.audioUrl}
            previewUrl={song.previewUrl}
            autoPlay={isCurrentlyPlaying}
            onPreviewEnded={autoplayEnabled ? onTrackEnded : undefined}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* The YouTube link lives in YouTubeFallback above; repeating it here
            gave the same song two identical red buttons. */}
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
          style={{ backgroundColor: moodColors.secondary, color: '#0f172a' }}
        >
          <i className="fa-solid fa-plus mr-1"></i> Add
        </button>

        <div className="ml-auto">
          <SongFeedback
            musicId={song.musicId}
            sessionId={sessionId}
            moodAtTime={moodAtTime}
          />
        </div>
      </div>

      {/* Why this song — the explanation is the differentiator, so it is
          labelled rather than left as an unattributed italic caption. */}
      {song.reason && (
        <div className="rounded-lg bg-black/30 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Why this one
          </p>
          <p className="text-xs leading-relaxed text-white">{song.reason}</p>
        </div>
      )}
    </div>
  );
}

export default RecommendationCard;