import React, { useContext } from 'react';
import YouTube from 'react-youtube';
import AuthContext from "../context/AuthContext";

function MusicPlayer({ songUrl }) {
  const { setCurrentPage } = useContext(AuthContext);

  console.log("songUrl received:", songUrl);

  const getVideoId = (url) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url?.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(songUrl);
  console.log("Extracted videoId:", videoId);

  const opts = {
    height: '390',
    width: '640',
    playerVars: {
      autoplay: 1,
    },
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#181818] text-white">
      <h1 className="text-2xl font-bold mb-4">Music Player</h1>
      {videoId ? (
        <div className="bg-[#1e1e1e] p-4 rounded-lg shadow-lg">
          <YouTube videoId={videoId} opts={opts} />
          <button
            onClick={() => setCurrentPage("chatbot")}
            className="mt-4 bg-[#3b82f6] text-white px-4 py-2 rounded hover:bg-[#2563eb]"
          >
            Back to Chatbot
          </button>
        </div>
      ) : (
        <p className="text-red-400">Invalid video URL. Please go back and try again.</p>
      )}
    </div>
  );
}

export default MusicPlayer;