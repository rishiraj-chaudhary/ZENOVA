import { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { SpotifyAuthContext } from '../context/SpotifyAuthContext';
const SpotifyCallback = () => {
  const [status, setStatus] = useState('Processing authentication...');
  const location = useLocation();
  const { setCurrentPage } = useContext(AuthContext);
  const { handleCallback } = useContext(SpotifyAuthContext);
  
  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      
      if (!code) {
        setStatus('Authentication failed: No code provided');
        setTimeout(() => setCurrentPage('chatbot'), 3000);
        return;
      }
      
      const success = await handleCallback(code, state);
      
      if (success) {
        setStatus('Authentication successful! Redirecting...');
        setTimeout(() => setCurrentPage('chatbot'), 2000);
      } else {
        setStatus('Authentication failed. Please try again.');
        setTimeout(() => setCurrentPage('chatbot'), 3000);
      }
    };
    
    processCallback();
  }, [location, handleCallback]);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#181818]">
      <div className="bg-[#252525] p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Spotify Authentication</h2>
        <p className="text-gray-300">{status}</p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1DB954]"></div>
        </div>
      </div>
    </div>
  );
};

export default SpotifyCallback;
