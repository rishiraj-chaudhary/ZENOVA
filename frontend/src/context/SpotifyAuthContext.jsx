import axios from 'axios';
import React, { createContext, useCallback, useEffect, useState } from 'react';

export const SpotifyAuthContext = createContext(null);

export const SpotifyAuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(localStorage.getItem('spotify_access_token') || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('spotify_refresh_token') || null);
  const [expiresAt, setExpiresAt] = useState(localStorage.getItem('spotify_expires_at') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [player, setPlayer] = useState(null);
  
  // Initialize authentication state
  useEffect(() => {
    const checkTokenValidity = () => {
      if (!accessToken || !expiresAt) {
        setIsAuthenticated(false);
        return;
      }
      
      const now = Date.now();
      const isValid = now < parseInt(expiresAt);
      setIsAuthenticated(isValid);
      
      // If token is expired but we have a refresh token, refresh it
      if (!isValid && refreshToken) {
        refreshAccessToken();
      }
    };
    
    checkTokenValidity();
  }, [accessToken, expiresAt, refreshToken]);
  
  // Function to refresh token
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return;
    
    try {
      const response = await axios.post('http://localhost:3000/api/music/recommend/spotify/refresh', {
        refreshToken
      });
      
      const { accessToken: newToken, expiresIn } = response.data;
      const newExpiresAt = Date.now() + expiresIn * 1000;
      
      setAccessToken(newToken);
      setExpiresAt(newExpiresAt.toString());
      
      localStorage.setItem('spotify_access_token', newToken);
      localStorage.setItem('spotify_expires_at', newExpiresAt.toString());
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
    }
  }, [refreshToken]);
  
  // Function to initiate login
  const login = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/music/recommend/spotify/auth');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    }
  };
  
  // Function to handle callback
  const handleCallback = async (code, state) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/music/recommend/spotify/callback?code=${code}&state=${state}`);
      
      const { accessToken: newToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      const newExpiresAt = Date.now() + expiresIn * 1000;
      
      setAccessToken(newToken);
      setRefreshToken(newRefreshToken);
      setExpiresAt(newExpiresAt.toString());
      
      localStorage.setItem('spotify_access_token', newToken);
      localStorage.setItem('spotify_refresh_token', newRefreshToken);
      localStorage.setItem('spotify_expires_at', newExpiresAt.toString());
      
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error('Failed to handle callback:', error);
      return false;
    }
  };
  
  // Function to logout
  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setExpiresAt(null);
    setIsAuthenticated(false);
    setPlayer(null);
    
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_expires_at');
  };
  
  // Initialize Spotify Web Playback SDK
  const initializePlayer = useCallback(() => {
    if (!accessToken || !window.Spotify) return;
    
    const player = new window.Spotify.Player({
      name: 'Zenova Music Therapy Player',
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });
    
    // Error handling
    player.addListener('initialization_error', ({ message }) => {
      console.error('Failed to initialize player:', message);
    });
    
    player.addListener('authentication_error', ({ message }) => {
      console.error('Failed to authenticate:', message);
      refreshAccessToken();
    });
    
    player.addListener('account_error', ({ message }) => {
      console.error('Failed to validate account:', message);
    });
    
    player.addListener('playback_error', ({ message }) => {
      console.error('Failed to perform playback:', message);
    });
    
    // Ready
    player.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      localStorage.setItem('spotify_device_id', device_id);
    });
    
    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
      console.log('Device ID has gone offline', device_id);
      localStorage.removeItem('spotify_device_id');
    });
    
    // Connect to the player
    player.connect();
    
    setPlayer(player);
    
    return () => {
      player.disconnect();
    };
  }, [accessToken, refreshAccessToken]);
  
  // Load Spotify SDK script
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    
    document.body.appendChild(script);
    
    window.onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer();
    };
    
    return () => {
      document.body.removeChild(script);
    };
  }, [isAuthenticated, initializePlayer]);
  
  return (
    <SpotifyAuthContext.Provider
      value={{
        accessToken,
        isAuthenticated,
        player,
        login,
        logout,
        handleCallback,
        refreshAccessToken
      }}
    >
      {children}
    </SpotifyAuthContext.Provider>
  );
};
