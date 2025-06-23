// // 1. First, install the spotify-web-api-node package
// // npm install spotify-web-api-node --save

// // 2. Update musicController.js with Spotify integration

// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import SpotifyWebApi from 'spotify-web-api-node';
// import MusicResource from "../models/MusicResource.js";
// import Recommendation from "../models/Recommendation.js";
// import User from "../models/User.js";
// dotenv.config();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Set up Spotify API client
// const spotifyApi = new SpotifyWebApi({
//   clientId: process.env.SPOTIFY_CLIENT_ID,
//   clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
//   redirectUri: process.env.SPOTIFY_REDIRECT_URI
// });

// // Function to refresh Spotify access token
// async function refreshSpotifyToken() {
//   try {
//     const data = await spotifyApi.clientCredentialsGrant();
//     spotifyApi.setAccessToken(data.body['access_token']);
//     console.log('Spotify access token refreshed');
    
//     // Set timeout to refresh before token expires
//     setTimeout(refreshSpotifyToken, (data.body['expires_in'] - 60) * 1000); // Refresh 1 minute before expiry
//   } catch (error) {
//     console.error('Error refreshing Spotify token:', error);
//   }
// }

// // Initialize Spotify token on startup
// refreshSpotifyToken();

// // Function to search Spotify for a song and get track details
// async function getSpotifyTrack(title, artist) {
//   try {
//     const searchQuery = `track:${title} artist:${artist}`;
//     const searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
    
//     if (searchResult.body.tracks.items.length > 0) {
//       const track = searchResult.body.tracks.items[0];
//       return {
//         spotifyId: track.id,
//         spotifyUri: track.uri,
//         previewUrl: track.preview_url,
//         spotifyUrl: track.external_urls.spotify,
//         albumArt: track.album.images[0]?.url || null,
//         popularity: track.popularity,
//         explicit: track.explicit
//       };
//     }
//     return null;
//   } catch (error) {
//     console.error('Error searching Spotify:', error);
//     return null;
//   }
// }

// // Fallback to YouTube search URL if Spotify fails
// function getYouTubeUrl(title, artist) {
//   try {
//     const searchQuery = encodeURIComponent(`${title} ${artist}`);
//     return `https://www.youtube.com/results?search_query=${searchQuery}`;
//   } catch (error) {
//     console.error('Error getting YouTube URL:', error);
//     return "";
//   }
// }

// export const getMusicRecommendations = async(req, res) => {
//     try {
//         const {userId, message, conversationHistory} = req.body;
//         console.log('Received request with:', {userId, message, conversationHistory});
        
//         // Validate userId
//         if(!userId || typeof userId !== 'string' || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
//             console.log('Invalid userId detected : ', userId);
//             return res.status(400).json({
//                 message: 'Invalid userId format',
//                 details: "Must be a 24-character hex string",
//                 receivedUserId: userId
//             });
//         }
        
//         // Convert userId to ObjectId
//         let objectId;
//         try {
//             objectId = new mongoose.Types.ObjectId(userId);
//             console.log('Converted userId:', objectId);
//         } catch(idErr) {
//             console.log('ObjectId Conversion Error:', idErr);
//             return res.status(400).json({ 
//                 message: "Invalid userId format", 
//                 details: idErr.message 
//             });
//         }

//         // Get user preferences
//         const user = await User.findById(objectId);
//         const userPreferences = user?.preferences || [];
        
//         // Get recommendations from Gemini
//         const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        
//         // Build conversation context
//         const conversationContext = conversationHistory
//             ? conversationHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')
//             : '';
            
//         const prompt = `You are a friendly and conversational music recommendation assistant. 
//         The user has previously indicated these preferences: ${userPreferences.join(', ')}.
        
//         Previous conversation:
//         ${conversationContext}
        
//         Current message: ${message}
        
//         Based on the conversation and user preferences, provide a natural, conversational response and suggest 3-5 songs that would be appropriate.
        
//         Response Format:
//         Return a JSON object with this structure:
//         {
//             "response": "Your conversational response here...",
//             "detectedMood": "mood detected from conversation",
//             "recommendations": [
//                 {
//                     "title": "Song Name",
//                     "artist": "Artist Name",
//                     "genre": "Genre",
//                     "moodTags": ["tag1", "tag2"],
//                     "duration": 240,
//                     "recommendedFor": ["activity1", "activity2"],
//                     "reason": "Why this song matches the conversation and preferences"
//                 }
//             ]
//         }
        
//         Guidelines:
//         1. Keep the response conversational and natural
//         2. Reference previous conversation when relevant
//         3. Consider user preferences in recommendations
//         4. Explain why each song was chosen
//         5. Include a mix of genres based on preferences
//         6. Make sure songs are available on Spotify/YouTube`;
        
//         const result = await model.generateContent(prompt);
//         const responseText = await result.response.text();
//         console.log('Raw Gemini Response: ', responseText);
        
//         // Parse Gemini response
//         let responseData;
//         try {
//             const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*)\n```/);
//             if (jsonMatch) {
//                 responseData = JSON.parse(jsonMatch[1]);
//             } else {
//                 responseData = JSON.parse(responseText);
//             }
//         } catch(parseError) {
//             console.error('Parsing Error:', parseError);
//             return res.status(500).json({
//                 message: "Invalid response format from Gemini",
//                 rawResponse: responseText
//             });
//         }
        
//         // Process and store recommendations
//         let recommendationsList = [];
        
//         for (const song of responseData.recommendations) {
//             // Try to get Spotify track info
//             const spotifyData = await getSpotifyTrack(song.title, song.artist);
            
//             // Fallback to YouTube if Spotify data not found
//             const audioUrl = spotifyData?.spotifyUrl || getYouTubeUrl(song.title, song.artist);
            
//             // Store the song in MusicResource
//             let music = await MusicResource.findOneAndUpdate(
//                 { title: song.title, artist: song.artist },
//                 {
//                     title: song.title,
//                     artist: song.artist,
//                     genre: song.genre,
//                     moodTags: song.moodTags || [],
//                     audioUrl: audioUrl,
//                     duration: song.duration || 0,
//                     recommendedFor: song.recommendedFor || [],
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         previewUrl: spotifyData.previewUrl,
//                         albumArt: spotifyData.albumArt,
//                         popularity: spotifyData.popularity
//                     })
//                 },
//                 { new: true, upsert: true }
//             );
            
//             if (!music) {
//                 music = new MusicResource({
//                     title: song.title,
//                     artist: song.artist,
//                     genre: song.genre,
//                     moodTags: song.moodTags || [],
//                     audioUrl: audioUrl,
//                     duration: song.duration || 0,
//                     recommendedFor: song.recommendedFor || [],
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         previewUrl: spotifyData.previewUrl,
//                         albumArt: spotifyData.albumArt,
//                         popularity: spotifyData.popularity
//                     })
//                 });
//                 await music.save();
//             }
            
//             recommendationsList.push({
//                 musicId: music._id,
//                 title: song.title,
//                 artist: song.artist,
//                 audioUrl: audioUrl,
//                 genre: song.genre,
//                 reason: song.reason,
//                 ...(spotifyData && {
//                     spotifyUrl: spotifyData.spotifyUrl,
//                     previewUrl: spotifyData.previewUrl,
//                     albumArt: spotifyData.albumArt
//                 })
//             });
//         }
        
//         // Save recommendation record
//         const newRecommendation = new Recommendation({
//             userId: objectId,
//             recommendedMusic: recommendationsList.map(item => ({
//                 musicId: item.musicId,
//                 reason: item.reason
//             }))
//         });
        
//         await newRecommendation.save();
        
//         return res.json({
//             response: responseData.response,
//             detectedMood: responseData.detectedMood,
//             recommendations: recommendationsList
//         });
//     } catch(err) {
//         console.log('Error finding music recommendation:', err);
//         res.status(500).json({message: 'Internal server error'});
//     }
// }


// // New endpoint to get Spotify player URL for embedding
// export const getSpotifyEmbed = async(req, res) => {
//     try {
//         const { trackId } = req.params;
        
//         if (!trackId) {
//             return res.status(400).json({ message: "Track ID is required" });
//         }
        
//         // Format the embed URL for Spotify iframes
//         const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
        
//         return res.json({
//             embedUrl: embedUrl
//         });
//     } catch(err) {
//         console.error('Error getting Spotify embed:', err);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// }


// // 1. First, install the spotify-web-api-node package
// // npm install spotify-web-api-node --save

// // 2. Update musicController.js with Spotify integration

// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import SpotifyWebApi from 'spotify-web-api-node';
// import MusicResource from "../models/MusicResource.js";
// import Recommendation from "../models/Recommendation.js";
// import User from "../models/User.js";
// dotenv.config();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Set up Spotify API client
// const spotifyApi = new SpotifyWebApi({
//   clientId: process.env.SPOTIFY_CLIENT_ID,
//   clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
//   redirectUri: process.env.SPOTIFY_REDIRECT_URI
// });

// // Function to refresh Spotify access token
// async function refreshSpotifyToken() {
//   try {
//     const data = await spotifyApi.clientCredentialsGrant();
//     spotifyApi.setAccessToken(data.body['access_token']);
//     console.log('Spotify access token refreshed');
    
//     // Set timeout to refresh before token expires
//     setTimeout(refreshSpotifyToken, (data.body['expires_in'] - 60) * 1000); // Refresh 1 minute before expiry
//   } catch (error) {
//     console.error('Error refreshing Spotify token:', error);
//   }
// }

// // Initialize Spotify token on startup
// refreshSpotifyToken();

// // Function to search Spotify for a song and get track details
// async function getSpotifyTrack(title, artist) {
//   try {
//     const searchQuery = `track:${title} artist:${artist}`;
//     const searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
    
//     if (searchResult.body.tracks.items.length > 0) {
//       const track = searchResult.body.tracks.items[0];
//       return {
//         spotifyId: track.id,
//         spotifyUri: track.uri,
//         previewUrl: track.preview_url,
//         spotifyUrl: track.external_urls.spotify,
//         albumArt: track.album.images[0]?.url || null,
//         popularity: track.popularity,
//         explicit: track.explicit
//       };
//     }
//     return null;
//   } catch (error) {
//     console.error('Error searching Spotify:', error);
//     return null;
//   }
// }

// // Fallback to YouTube search URL if Spotify fails
// function getYouTubeUrl(title, artist) {
//   try {
//     const searchQuery = encodeURIComponent(`${title} ${artist}`);
//     return `https://www.youtube.com/results?search_query=${searchQuery}`;
//   } catch (error) {
//     console.error('Error getting YouTube URL:', error);
//     return "";
//   }
// }

// export const getMusicRecommendations = async(req, res) => {
//     try {
//         const {userId, message, conversationHistory} = req.body;
//         console.log('Received request with:', {userId, message, conversationHistory});
        
//         // Validate userId
//         if(!userId || typeof userId !== 'string' || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
//             console.log('Invalid userId detected : ', userId);
//             return res.status(400).json({
//                 message: 'Invalid userId format',
//                 details: "Must be a 24-character hex string",
//                 receivedUserId: userId
//             });
//         }
        
//         // Convert userId to ObjectId
//         let objectId;
//         try {
//             objectId = new mongoose.Types.ObjectId(userId);
//             console.log('Converted userId:', objectId);
//         } catch(idErr) {
//             console.log('ObjectId Conversion Error:', idErr);
//             return res.status(400).json({ 
//                 message: "Invalid userId format", 
//                 details: idErr.message 
//             });
//         }

//         // Get user preferences
//         const user = await User.findById(objectId);
//         const userPreferences = user?.preferences || [];
        
//         // Get recommendations from Gemini
//         const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        
//         // Build conversation context
//         const conversationContext = conversationHistory
//             ? conversationHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')
//             : '';
            
//         const prompt = `You are a friendly and conversational music recommendation assistant. 
//         The user has previously indicated these preferences: ${userPreferences.join(', ')}.
        
//         Previous conversation:
//         ${conversationContext}
        
//         Current message: ${message}
        
//         Based on the conversation and user preferences, provide a natural, conversational response and suggest 3-5 songs that would be appropriate.
        
//         Response Format:
//         Return a JSON object with this structure:
//         {
//             "response": "Your conversational response here...",
//             "detectedMood": "mood detected from conversation",
//             "recommendations": [
//                 {
//                     "title": "Song Name",
//                     "artist": "Artist Name",
//                     "genre": "Genre",
//                     "moodTags": ["tag1", "tag2"],
//                     "duration": 240,
//                     "recommendedFor": ["activity1", "activity2"],
//                     "reason": "Why this song matches the conversation and preferences"
//                 }
//             ]
//         }
        
//         Guidelines:
//         1. Keep the response conversational and natural
//         2. Reference previous conversation when relevant
//         3. Consider user preferences in recommendations
//         4. Explain why each song was chosen
//         5. Include a mix of genres based on preferences
//         6. Make sure songs are available on Spotify/YouTube`;
        
//         const result = await model.generateContent(prompt);
//         const responseText = await result.response.text();
//         console.log('Raw Gemini Response: ', responseText);
        
//         // Parse Gemini response
//         let responseData;
//         try {
//             const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*)\n```/);
//             if (jsonMatch) {
//                 responseData = JSON.parse(jsonMatch[1]);
//             } else {
//                 responseData = JSON.parse(responseText);
//             }
//         } catch(parseError) {
//             console.error('Parsing Error:', parseError);
//             return res.status(500).json({
//                 message: "Invalid response format from Gemini",
//                 rawResponse: responseText
//             });
//         }
        
//         // Process and store recommendations
//         let recommendationsList = [];
        
//         for (const song of responseData.recommendations) {
//             // Try to get Spotify track info
//             const spotifyData = await getSpotifyTrack(song.title, song.artist);
            
//             // Fallback to YouTube if Spotify data not found
//             const audioUrl = spotifyData?.spotifyUrl || getYouTubeUrl(song.title, song.artist);
            
//             // Store the song in MusicResource
//             let music = await MusicResource.findOneAndUpdate(
//                 { title: song.title, artist: song.artist },
//                 {
//                     title: song.title,
//                     artist: song.artist,
//                     genre: song.genre,
//                     moodTags: song.moodTags || [],
//                     audioUrl: audioUrl,
//                     duration: song.duration || 0,
//                     recommendedFor: song.recommendedFor || [],
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         previewUrl: spotifyData.previewUrl,
//                         albumArt: spotifyData.albumArt,
//                         popularity: spotifyData.popularity
//                     })
//                 },
//                 { new: true, upsert: true }
//             );
            
//             if (!music) {
//                 music = new MusicResource({
//                     title: song.title,
//                     artist: song.artist,
//                     genre: song.genre,
//                     moodTags: song.moodTags || [],
//                     audioUrl: audioUrl,
//                     duration: song.duration || 0,
//                     recommendedFor: song.recommendedFor || [],
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         previewUrl: spotifyData.previewUrl,
//                         albumArt: spotifyData.albumArt,
//                         popularity: spotifyData.popularity
//                     })
//                 });
//                 await music.save();
//             }
            
//             recommendationsList.push({
//                 musicId: music._id,
//                 title: song.title,
//                 artist: song.artist,
//                 audioUrl: audioUrl,
//                 genre: song.genre,
//                 reason: song.reason,
//                 ...(spotifyData && {
//                     spotifyUrl: spotifyData.spotifyUrl,
//                     previewUrl: spotifyData.previewUrl,
//                     albumArt: spotifyData.albumArt
//                 })
//             });
//         }
        
//         // Save recommendation record
//         const newRecommendation = new Recommendation({
//             userId: objectId,
//             recommendedMusic: recommendationsList.map(item => ({
//                 musicId: item.musicId,
//                 reason: item.reason
//             }))
//         });
        
//         await newRecommendation.save();
        
//         return res.json({
//             response: responseData.response,
//             detectedMood: responseData.detectedMood,
//             recommendations: recommendationsList
//         });
//     } catch(err) {
//         console.log('Error finding music recommendation:', err);
//         res.status(500).json({message: 'Internal server error'});
//     }
// }


// // New endpoint to get Spotify player URL for embedding
// export const getSpotifyEmbed = async(req, res) => {
//     try {
//         const { trackId } = req.params;
        
//         if (!trackId) {
//             return res.status(400).json({ message: "Track ID is required" });
//         }
        
//         // Format the embed URL for Spotify iframes
//         const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
        
//         return res.json({
//             embedUrl: embedUrl
//         });
//     } catch(err) {
//         console.error('Error getting Spotify embed:', err);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// }


import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import mongoose from "mongoose";
import SpotifyWebApi from 'spotify-web-api-node';
import user from '../models/user.js';
// controllers/userFeedbackController.js
import axios from "axios";
import querystring from 'querystring';
import MusicResource from "../models/MusicResource.js";
import Recommendation from '../models/Recommendation.js';
dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Set up Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});
let tokenExpiryTime = 0;
// Function to refresh Spotify access token
async function refreshSpotifyToken() {
 try {
    console.log('Attempting to refresh Spotify token...');
    const data = await spotifyApi.clientCredentialsGrant();
    
    spotifyApi.setAccessToken(data.body['access_token']);
    tokenExpiryTime = Date.now() + (data.body['expires_in'] * 1000);
    
    console.log('Spotify access token refreshed successfully');
    console.log(`Token expires at: ${new Date(tokenExpiryTime).toISOString()}`);
    
    // Set timeout to refresh 5 minutes before token expires
    const refreshTime = (data.body['expires_in'] - 300) * 1000; // 5 minutes before expiry
    setTimeout(refreshSpotifyToken, Math.max(refreshTime, 60000)); // At least 1 minute
    
  } catch (error) {
    console.error('Error refreshing Spotify token:', error.message);
    // Retry after 30 seconds if refresh fails
    setTimeout(refreshSpotifyToken, 30000);
  }
}

// Initialize Spotify token on startup
refreshSpotifyToken();


async function getSpotifyTrack(title, artist) {
    try {
      // Try exact match first
      let searchQuery = `track:${title} artist:${artist}`;
      let searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
      
      // If no results, try a more lenient search
      if (searchResult.body.tracks.items.length === 0) {
        // Remove any text in parentheses or after feat./ft.
        const cleanTitle = title.replace(/\(.*?\)|\sfeat\..*|\sft\..*$/i, '').trim();
        const cleanArtist = artist.replace(/\(.*?\)|\sfeat\..*|\sft\..*$/i, '').trim();
        
        searchQuery = `${cleanTitle} ${cleanArtist}`;
        searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 5 });
      }
      
      if (searchResult.body.tracks.items.length > 0) {
        const track = searchResult.body.tracks.items[0];
        return {
          spotifyId: track.id,
          spotifyUri: track.uri,
          spotifyUrl: track.external_urls.spotify,
          previewUrl: track.preview_url,
          albumArt: track.album.images[0]?.url || null,
          popularity: track.popularity,
          explicit: track.explicit
        };
      }
      
      console.log(`No Spotify tracks found for "${title}" by ${artist}`);
      return null;
    } catch (error) {
      console.error('Error searching Spotify:', error);
      return null;
    }
  }
  

// Fallback to YouTube search URL if Spotify fails
function getYouTubeUrl(title, artist) {
  try {
    const searchQuery = encodeURIComponent(`${title} ${artist}`);
    return `https://www.youtube.com/results?search_query=${searchQuery}`;
  } catch (error) {
    console.error('Error getting YouTube URL:', error);
    return "";
  }
}
// Helper function to preprocess JSON string
function preprocessJsonString(jsonStr) {
    // Fix time formats (e.g., 4:36 → 276 or "4:36")
    return jsonStr.replace(/"duration":\s*(\d+):(\d+)/g, (match, minutes, seconds) => {
        // Convert to seconds as a number
        const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
        return `"duration": ${totalSeconds}`;
        
        // Alternatively, return as a string:
        // return `"duration": "${minutes}:${seconds}"`;
    });
}

export const getMusicRecommendations = async(req, res) => {
    try {
        const {userId, message, conversationHistory} = req.body;
        console.log('Received request with:', {userId, message, conversationHistory});
         // Convert userId to ObjectId
         let objectId;
         try {
             objectId = new mongoose.Types.ObjectId(userId);
             console.log('Converted userId:', objectId);
         } catch(idErr) {
             console.log('ObjectId Conversion Error:', idErr);
             return res.status(400).json({ 
                 message: "Invalid userId format", 
                 details: idErr.message 
             });
         }
        // Get user preferences
        const User = await user.findById(objectId);
        // Validate userId
        if(!userId || typeof userId !== 'string' || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            console.log('Invalid userId detected : ', userId);
            return res.status(400).json({
                message: 'Invalid userId format',
                details: "Must be a 24-character hex string",
                receivedUserId: userId
            });
        }
        
       

   
        if (!User) {
            return res.status(404).json({
                message: "User not found",
                details: "The provided userId does not exist in the database"
            });
        }
        const userPreferences = User.preferences || [];
        
        // Get recommendations from Gemini
        const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        
        // Build conversation context
        const conversationContext = conversationHistory
            ? conversationHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')
            : '';
            
        const prompt = `You are a friendly and conversational music recommendation assistant. 
         You are built by RISHIRAJ an undergrad at NSUT to provide users ease in finding and compiling music.
        The user has previously indicated these preferences: ${userPreferences.join(', ')}.
        
        Previous conversation:
        ${conversationContext}
        
        Current message: ${message}
        
        Based on the conversation and user preferences, provide a natural, conversational response and suggest as many songs as asked by user and if not specified suggest 4-5 songs that would be appropriate.
        
        Response Format:
        Return a JSON object with this structure:
        {
            "response": "Your conversational response here...",
            "detectedMood": "mood detected from conversation",
            "recommendations": [
  { 
    "title": "Song Name",
    "artist": "Artist Name",
    "genre": "Genre",
    "moodTags": ["tag1", "tag2"],
    "duration": 240,
    "recommendedFor": ["activity1", "activity2"],
                    "reason": "Why this song matches the conversation and preferences"
                }
            ]
        }
        
        Guidelines:
        1. Keep the response conversational and natural
        2. Reference previous conversation when relevant
        3. Consider user preferences in recommendations
        4. Explain why each song was chosen
        5. Include a mix of genres based on preferences
        6. Make sure songs are available on Spotify/YouTube`;
        
        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();
        console.log('Raw Gemini Response: ', responseText);
        
        let responseData;
        try {
            // Extract JSON from code blocks if present
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
            const jsonString = jsonMatch ? jsonMatch[1] : responseText;
            
            // Pre-process the JSON string to fix common formatting issues
            const preprocessedJson = preprocessJsonString(jsonString);
            
            // Parse the preprocessed JSON
            responseData = JSON.parse(preprocessedJson);
        } catch(parseError) {
            console.error('Parsing Error:', parseError);
            return res.status(500).json({
                message: "Invalid response format from Gemini",
                rawResponse: responseText
            });
        }
        // Process and store recommendations
        let recommendationsList = [];
        
        for (const song of responseData.recommendations) {
            // Try to get Spotify track info
            const spotifyData = await getSpotifyTrack(song.title, song.artist);
              // Logging for debugging
    if (spotifyData) {
        console.log(`Spotify data for "${song.title}" by ${song.artist}:`, {
          id: spotifyData.spotifyId,
          uri: spotifyData.spotifyUri,
          url: spotifyData.spotifyUrl
        });
      } else {
        console.log(`No Spotify data found for "${song.title}" by ${song.artist}`);
      }
            // Fallback to YouTube if Spotify data not found
            const audioUrl = spotifyData?.spotifyUrl || getYouTubeUrl(song.title, song.artist);
            
            // Store the song in MusicResource
            let music = await MusicResource.findOneAndUpdate(
                { title: song.title, artist: song.artist },
                {
                    title: song.title,
                    artist: song.artist,
                    genre: song.genre,
                    moodTags: song.moodTags || [],
                    audioUrl: audioUrl,
                    duration: song.duration || 0,
                    recommendedFor: song.recommendedFor || [],
                    ...(spotifyData && {
                        spotifyId: spotifyData.spotifyId,
                        spotifyUri: spotifyData.spotifyUri,  // URI format: spotify:track:xyz
                        spotifyUrl: spotifyData.spotifyUrl,
                        previewUrl: spotifyData.previewUrl,
                        albumArt: spotifyData.albumArt,
                        popularity: spotifyData.popularity
                    })
                },
                { new: true, upsert: true }
            );
            
            if (!music) {
                music = new MusicResource({
                    title: song.title,
                    artist: song.artist,
                    genre: song.genre,
                    moodTags: song.moodTags || [],
                    audioUrl: audioUrl,
                    duration: song.duration || 0,
                    recommendedFor: song.recommendedFor || [],
                    ...(spotifyData && {
                        spotifyId: spotifyData.spotifyId,
                        spotifyUri: spotifyData.spotifyUri,  // URI format: spotify:track:xyz
                        spotifyUrl: spotifyData.spotifyUrl,
                        previewUrl: spotifyData.previewUrl,
                        albumArt: spotifyData.albumArt,
                        popularity: spotifyData.popularity
                    })
                });
                await music.save();
            }
            
            recommendationsList.push({
                musicId: music._id,
                title: song.title,
                artist: song.artist,
                audioUrl: audioUrl,
                genre: song.genre,
                reason: song.reason,
                ...(spotifyData && {
                    spotifyId: spotifyData?.spotifyId || null, // Add this
                    spotifyUrl: spotifyData?.spotifyUrl || null, // Make sure this is the full URL
                    spotifyUri: spotifyData?.spotifyUri || null, // Include the URI format
                    previewUrl: spotifyData.previewUrl,
                    albumArt: spotifyData.albumArt
                })
            });
        }
        
        // Save recommendation record
        const newRecommendation = new Recommendation({
            userId: objectId,
            recommendedMusic: recommendationsList.map(item => ({
                musicId: item.musicId,
                reason: item.reason
            }))
        });
        
        await newRecommendation.save();
        
        return res.json({
            response: responseData.response,
            detectedMood: responseData.detectedMood,
            recommendations: recommendationsList
        });
    } catch(err) {
        console.log('Error finding music recommendation:', err);
        res.status(500).json({message: 'Internal server error'});
    }
}


// New endpoint to get Spotify player URL for embedding
export const getSpotifyEmbed = async(req, res) => {
    try {
        const { trackId } = req.params;
        
        if (!trackId) {
            return res.status(400).json({ message: "Track ID is required" });
        }
        
        // Format the embed URL for Spotify iframes
        const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
        
        return res.json({
            embedUrl: embedUrl
        });
    } catch(err) {
        console.error('Error getting Spotify embed:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
}


//Get spotify auth URL
export const getSpotifyAuthUrl = async (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = 'http://localhost:5173/spotify-callback';
    const scopes=[
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-library-read',
        'playlist-read-private',
    ];
    const state=Math.random().toString(36).substring(2, 15);
    const authUrl='https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: clientId,
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state: state
    });
    res.json({authUrl});
}
// Handle Spotify callback
export const handleSpotifyCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = 'http://localhost:5173/spotify-callback';
    
    // Exchange code for tokens
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    res.json({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error('Spotify callback error:', error);
    res.status(500).json({ message: 'Failed to authenticate with Spotify' });
  }
};

