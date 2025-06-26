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


// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from 'dotenv';
// import mongoose from "mongoose";
// import SpotifyWebApi from 'spotify-web-api-node';
// import user from '../models/user.js';
// // controllers/userFeedbackController.js
// import axios from "axios";
// import querystring from 'querystring';
// import MusicResource from "../models/MusicResource.js";
// import Recommendation from '../models/Recommendation.js';
// dotenv.config();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Set up Spotify API client
// const spotifyApi = new SpotifyWebApi({
//   clientId: process.env.SPOTIFY_CLIENT_ID,
//   clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
//   redirectUri: process.env.SPOTIFY_REDIRECT_URI
// });
// let tokenExpiryTime = 0;
// // Function to refresh Spotify access token
// async function refreshSpotifyToken() {
//  try {
//     console.log('Attempting to refresh Spotify token...');
//     const data = await spotifyApi.clientCredentialsGrant();
    
//     spotifyApi.setAccessToken(data.body['access_token']);
//     tokenExpiryTime = Date.now() + (data.body['expires_in'] * 1000);
    
//     console.log('Spotify access token refreshed successfully');
//     console.log(`Token expires at: ${new Date(tokenExpiryTime).toISOString()}`);
    
//     // Set timeout to refresh 5 minutes before token expires
//     const refreshTime = (data.body['expires_in'] - 300) * 1000; // 5 minutes before expiry
//     setTimeout(refreshSpotifyToken, Math.max(refreshTime, 60000)); // At least 1 minute
    
//   } catch (error) {
//     console.error('Error refreshing Spotify token:', error.message);
//     // Retry after 30 seconds if refresh fails
//     setTimeout(refreshSpotifyToken, 30000);
//   }
// }

// // Initialize Spotify token on startup
// refreshSpotifyToken();


// async function getSpotifyTrack(title, artist) {
//     try {
//       // Try exact match first
//       let searchQuery = `track:${title} artist:${artist}`;
//       let searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 1 });
      
//       // If no results, try a more lenient search
//       if (searchResult.body.tracks.items.length === 0) {
//         // Remove any text in parentheses or after feat./ft.
//         const cleanTitle = title.replace(/\(.*?\)|\sfeat\..*|\sft\..*$/i, '').trim();
//         const cleanArtist = artist.replace(/\(.*?\)|\sfeat\..*|\sft\..*$/i, '').trim();
        
//         searchQuery = `${cleanTitle} ${cleanArtist}`;
//         searchResult = await spotifyApi.searchTracks(searchQuery, { limit: 5 });
//       }
      
//       if (searchResult.body.tracks.items.length > 0) {
//         const track = searchResult.body.tracks.items[0];
//         return {
//           spotifyId: track.id,
//           spotifyUri: track.uri,
//           spotifyUrl: track.external_urls.spotify,
//           previewUrl: track.preview_url,
//           albumArt: track.album.images[0]?.url || null,
//           popularity: track.popularity,
//           explicit: track.explicit
//         };
//       }
      
//       console.log(`No Spotify tracks found for "${title}" by ${artist}`);
//       return null;
//     } catch (error) {
//       console.error('Error searching Spotify:', error);
//       return null;
//     }
//   }
  

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
// // Helper function to preprocess JSON string
// function preprocessJsonString(jsonStr) {
//     // Fix time formats (e.g., 4:36 → 276 or "4:36")
//     return jsonStr.replace(/"duration":\s*(\d+):(\d+)/g, (match, minutes, seconds) => {
//         // Convert to seconds as a number
//         const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
//         return `"duration": ${totalSeconds}`;
        
//         // Alternatively, return as a string:
//         // return `"duration": "${minutes}:${seconds}"`;
//     });
// }

// export const getMusicRecommendations = async(req, res) => {
//     try {
//         const {userId, message, conversationHistory} = req.body;
//         console.log('Received request with:', {userId, message, conversationHistory});
//          // Convert userId to ObjectId
//          let objectId;
//          try {
//              objectId = new mongoose.Types.ObjectId(userId);
//              console.log('Converted userId:', objectId);
//          } catch(idErr) {
//              console.log('ObjectId Conversion Error:', idErr);
//              return res.status(400).json({ 
//                  message: "Invalid userId format", 
//                  details: idErr.message 
//              });
//          }
//         // Get user preferences
//         const User = await user.findById(objectId);
//         // Validate userId
//         if(!userId || typeof userId !== 'string' || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
//             console.log('Invalid userId detected : ', userId);
//             return res.status(400).json({
//                 message: 'Invalid userId format',
//                 details: "Must be a 24-character hex string",
//                 receivedUserId: userId
//             });
//         }
        
       

   
//         if (!User) {
//             return res.status(404).json({
//                 message: "User not found",
//                 details: "The provided userId does not exist in the database"
//             });
//         }
//         const userPreferences = User.preferences || [];
        
//         // Get recommendations from Gemini
//         const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        
//         // Build conversation context
//         const conversationContext = conversationHistory
//             ? conversationHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')
//             : '';
            
//         const prompt = `You are a friendly and conversational music recommendation assistant. 
//          You are built by RISHIRAJ an undergrad at NSUT to provide users ease in finding and compiling music.
//         The user has previously indicated these preferences: ${userPreferences.join(', ')}.
        
//         Previous conversation:
//         ${conversationContext}
        
//         Current message: ${message}
        
//         Based on the conversation and user preferences, provide a natural, conversational response and suggest as many songs as asked by user and if not specified suggest 4-5 songs that would be appropriate.
        
//         Response Format:
//         Return a JSON object with this structure:
//         {
//             "response": "Your conversational response here...",
//             "detectedMood": "mood detected from conversation",
//             "recommendations": [
//   { 
//     "title": "Song Name",
//     "artist": "Artist Name",
//     "genre": "Genre",
//     "moodTags": ["tag1", "tag2"],
//     "duration": 240,
//     "recommendedFor": ["activity1", "activity2"],
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
        
//         let responseData;
//         try {
//             // Extract JSON from code blocks if present
//             const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
//             const jsonString = jsonMatch ? jsonMatch[1] : responseText;
            
//             // Pre-process the JSON string to fix common formatting issues
//             const preprocessedJson = preprocessJsonString(jsonString);
            
//             // Parse the preprocessed JSON
//             responseData = JSON.parse(preprocessedJson);
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
//               // Logging for debugging
//     if (spotifyData) {
//         console.log(`Spotify data for "${song.title}" by ${song.artist}:`, {
//           id: spotifyData.spotifyId,
//           uri: spotifyData.spotifyUri,
//           url: spotifyData.spotifyUrl
//         });
//       } else {
//         console.log(`No Spotify data found for "${song.title}" by ${song.artist}`);
//       }
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
//                         spotifyUri: spotifyData.spotifyUri,  // URI format: spotify:track:xyz
//                         spotifyUrl: spotifyData.spotifyUrl,
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
//                         spotifyUri: spotifyData.spotifyUri,  // URI format: spotify:track:xyz
//                         spotifyUrl: spotifyData.spotifyUrl,
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
//                     spotifyId: spotifyData?.spotifyId || null, // Add this
//                     spotifyUrl: spotifyData?.spotifyUrl || null, // Make sure this is the full URL
//                     spotifyUri: spotifyData?.spotifyUri || null, // Include the URI format
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


// //Get spotify auth URL
// export const getSpotifyAuthUrl = async (req, res) => {
//     const clientId = process.env.SPOTIFY_CLIENT_ID;
//     const redirectUri = 'http://localhost:5173/spotify-callback';
//     const scopes=[
//         'streaming',
//         'user-read-email',
//         'user-read-private',
//         'user-modify-playback-state',
//         'user-read-playback-state',
//         'user-library-read',
//         'playlist-read-private',
//     ];
//     const state=Math.random().toString(36).substring(2, 15);
//     const authUrl='https://accounts.spotify.com/authorize?' +
//     querystring.stringify({
//       response_type: 'code',
//       client_id: clientId,
//       scope: scopes.join(' '),
//       redirect_uri: redirectUri,
//       state: state
//     });
//     res.json({authUrl});
// }
// // Handle Spotify callback
// export const handleSpotifyCallback = async (req, res) => {
//   try {
//     const { code } = req.query;
//     const clientId = process.env.SPOTIFY_CLIENT_ID;
//     const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
//     const redirectUri = 'http://localhost:5173/spotify-callback';
    
//     // Exchange code for tokens
//     const response = await axios.post('https://accounts.spotify.com/api/token', 
//       querystring.stringify({
//         grant_type: 'authorization_code',
//         code,
//         redirect_uri: redirectUri
//       }),
//       {
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
//         }
//       }
//     );
    
//     const { access_token, refresh_token, expires_in } = response.data;
    
//     res.json({
//       accessToken: access_token,
//       refreshToken: refresh_token,
//       expiresIn: expires_in
//     });
//   } catch (error) {
//     console.error('Spotify callback error:', error);
//     res.status(500).json({ message: 'Failed to authenticate with Spotify' });
//   }
// };



// import { GoogleGenerativeAI } from "@google/generative-ai";
// import axios from "axios";
// import dotenv from 'dotenv';
// import mongoose from "mongoose";
// import querystring from 'querystring';
// import SpotifyWebApi from 'spotify-web-api-node';
// import MusicResource from "../models/MusicResource.js";
// import Recommendation from '../models/Recommendation.js';
// import user from '../models/user.js';

// dotenv.config();
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Set up Spotify API client
// const spotifyApi = new SpotifyWebApi({
//   clientId: process.env.SPOTIFY_CLIENT_ID,
//   clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
//   redirectUri: process.env.SPOTIFY_REDIRECT_URI
// });

// let tokenExpiryTime = 0;

// // Enhanced Music Recommendation Prompt
// const createMusicRecommendationPrompt = (userInput, conversationHistory = [], userProfile = {}, currentMood = null) => {
//   const { preferences = [], moodHistory = [], musicBehavior = {} } = userProfile;
//   const { likes = [], skips = [], playlistAdditions = [] } = musicBehavior;
  
//   // Analyze user's music preferences from behavior
//   const likedGenres = [...new Set(likes.map(l => l.genre).filter(Boolean))];
//   const skippedGenres = [...new Set(skips.map(s => s.genre).filter(Boolean))];
  
//   const contextualHistory = conversationHistory.slice(-5).map((msg, index) => 
//     `${index + 1}. ${msg.sender}: ${msg.text}`
//   ).join('\n');

//   return `You are RISHIRAJ's advanced music therapy AI assistant, specialized in providing therapeutic music recommendations. You combine deep musical knowledge with therapeutic expertise to help users find the perfect songs for their emotional needs.

// USER PROFILE ANALYSIS:
// - Current detected mood: ${currentMood || 'neutral'}
// - Stated preferences: ${preferences.join(', ') || 'None specified'}
// - Liked music genres: ${likedGenres.join(', ') || 'Learning preferences'}
// - Previously skipped genres: ${skippedGenres.join(', ') || 'None noted'}
// - Recent mood pattern: ${moodHistory.slice(-3).map(m => m.mood).join(' → ') || 'First session'}

// CONVERSATION CONTEXT:
// ${contextualHistory || 'Initial interaction'}

// CURRENT REQUEST: "${userInput}"

// ADVANCED ANALYSIS FRAMEWORK:

// 1. INTENT CLASSIFICATION:
//    a) Direct song request ("recommend songs for", "I need music for")
//    b) Mood-based request ("I'm feeling", "help me feel")
//    c) Activity-based request ("workout music", "study playlist")
//    d) Therapeutic goal ("help me relax", "boost my mood")
//    e) Genre/artist preference ("something like", "more of")
//    f) Social sharing intent ("playlist for friends", "party music")

// 2. THERAPEUTIC ASSESSMENT:
//    - What emotional state needs support?
//    - What is the desired emotional outcome?
//    - What's the appropriate energy progression?
//    - Are there any contraindications? (e.g., avoiding melancholic music for depression)

// 3. CONTEXTUAL FACTORS:
//    - Time of day implications
//    - Activity context (work, exercise, sleep, social)
//    - Cultural considerations
//    - Personal history and preferences

// 4. MUSIC THERAPY PRINCIPLES:
//    - Iso-principle: Start where the user is emotionally
//    - Entrainment: Gradually guide toward desired state
//    - Catharsis: Allow emotional release when appropriate
//    - Distraction: Redirect from negative thoughts when needed

// RESPONSE FORMAT - Return valid JSON:
// {
//   "response": "Empathetic, personalized response (2-3 sentences) acknowledging their state and explaining your approach",
//   "detectedMood": "primary_emotion_identified",
//   "therapeuticGoal": "what_we_aim_to_achieve",
//   "recommendations": [
//     {
//       "title": "Song Title",
//       "artist": "Artist Name",
//       "genre": "Primary Genre",
//       "moodTags": ["current_mood", "target_mood", "energy_level"],
//       "duration": 240,
//       "recommendedFor": ["specific_activity", "emotional_state"],
//       "reason": "Detailed therapeutic explanation of why this song helps with their specific need",
//       "energyLevel": "low/medium/high",
//       "therapeuticFunction": "support/transition/energize/calm/motivate"
//     }
//   ]
// }

// SONG SELECTION GUIDELINES:

// FOR DIFFERENT MOODS:
// - Anxious/Stressed: Start with calming, slower tempo, nature sounds, instrumental
// - Sad/Depressed: Begin with acknowledgment, gradually introduce hope
// - Angry/Frustrated: Allow intensity expression, then guide toward resolution
// - Happy/Excited: Match and enhance positive energy
// - Tired/Low Energy: Gentle motivation, building energy progressively
// - Confused/Overwhelmed: Clear, simple melodies, familiar comfort songs

// GENRE RECOMMENDATIONS BY THERAPEUTIC GOAL:
// - Relaxation: Ambient, classical, soft indie, nature sounds
// - Motivation: Hip-hop, rock, pop-punk, electronic dance
// - Focus: Lo-fi, instrumental, post-rock, minimalist classical
// - Emotional Release: Blues, soul, alternative rock, singer-songwriter
// - Social Connection: Pop, reggae, folk, world music
// - Spiritual/Reflective: Gospel, world spiritual, ethereal

// ENSURE SONGS ARE:
// - Widely available on streaming platforms
// - Culturally appropriate and inclusive
// - Matched to user's apparent age/generation preferences
// - Balanced between familiar comfort and new discoveries
// - Therapeutically progressive (logical emotional journey)

// Remember: You're not just recommending music, you're providing therapeutic support through carefully curated musical experiences. Always explain the therapeutic reasoning behind each recommendation.`;
// };

// // Enhanced Mood Analysis Prompt for music recommendations
// const createMoodAnalysisPrompt = (userInput, conversationHistory = [], userProfile = {}) => {
//   const { moodHistory = [], preferences = [], currentStreak = 0 } = userProfile;
  
//   const recentMoods = moodHistory.slice(-5).map(m => m.mood).join(', ');
//   const historyContext = conversationHistory.slice(-3).map(msg => `${msg.sender}: ${msg.text}`).join('\n');
  
//   return `You are an expert music therapist and emotional intelligence AI assistant created by RISHIRAJ from NSUT. Your role is to accurately identify and understand the user's emotional state through their text input.

// CONTEXT ANALYSIS:
// - User's recent mood patterns: ${recentMoods || 'No previous data'}
// - Current wellness streak: ${currentStreak} days
// - User preferences: ${preferences.join(', ') || 'Not specified'}
// - Recent conversation context:
// ${historyContext || 'No previous conversation'}

// CURRENT USER INPUT: "${userInput}"

// ANALYSIS FRAMEWORK:
// 1. PRIMARY EMOTION DETECTION:
//    - Identify the dominant emotion (happy, sad, anxious, excited, angry, calm, frustrated, hopeful, lonely, energetic, melancholic, motivated, stressed, peaceful, confused)
//    - Consider intensity level (mild, moderate, strong, intense)

// 2. CONTEXTUAL FACTORS:
//    - Look for temporal indicators (today, yesterday, lately, recently)
//    - Identify situational triggers (work, relationships, health, achievements, challenges)
//    - Note any contradictory emotions or mixed feelings
//    - Consider cultural and personal context clues

// 3. THERAPEUTIC INSIGHTS:
//    - Assess if this represents a pattern or change from recent moods
//    - Identify any concerning patterns (persistent negativity, mood swings)
//    - Note positive developments or progress indicators

// 4. RESPONSE REQUIREMENTS:
//    - Return ONLY a single primary mood word (lowercase)
//    - If multiple emotions are present, choose the most therapeutically relevant one
//    - Prioritize emotions that would benefit most from music therapy intervention

// EXAMPLES:
// - "I've been struggling with work stress lately" → "stressed"
// - "Finally got that promotion I've been working toward!" → "accomplished"
// - "Can't sleep, mind racing with worries" → "anxious"
// - "Just want to curl up and listen to something soothing" → "melancholic"
// - "Ready to take on the world today!" → "energetic"

// Analyze the user's input and respond with a single mood word that best captures their therapeutic needs.`;
// };

// // Function to refresh Spotify access token
// async function refreshSpotifyToken() {
//  try {
//     console.log('Attempting to refresh Spotify token...');
//     const data = await spotifyApi.clientCredentialsGrant();
    
//     spotifyApi.setAccessToken(data.body['access_token']);
//     tokenExpiryTime = Date.now() + (data.body['expires_in'] * 1000);
    
//     console.log('Spotify access token refreshed successfully');
//     console.log(`Token expires at: ${new Date(tokenExpiryTime).toISOString()}`);
    
//     // Set timeout to refresh 5 minutes before token expires
//     const refreshTime = (data.body['expires_in'] - 300) * 1000; // 5 minutes before expiry
//     setTimeout(refreshSpotifyToken, Math.max(refreshTime, 60000)); // At least 1 minute
    
//   } catch (error) {
//     console.error('Error refreshing Spotify token:', error.message);
//     // Retry after 30 seconds if refresh fails
//     setTimeout(refreshSpotifyToken, 30000);
//   }
// }

// // Initialize Spotify token on startup
// refreshSpotifyToken();

// // Enhanced Spotify track lookup with better error handling
// async function getSpotifyTrack(title, artist) {
//     try {
//         // Enhanced search with multiple strategies
//         const searchStrategies = [
//             `track:"${title}" artist:"${artist}"`,
//             `"${title}" "${artist}"`,
//             `${title} ${artist}`,
//             title.split(' ')[0] + ' ' + artist // Fallback to first word of title
//         ];
        
//         for (const query of searchStrategies) {
//             try {
//                 const searchResult = await spotifyApi.searchTracks(query, { limit: 5 });
                
//                 if (searchResult.body.tracks.items.length > 0) {
//                     // Find best match
//                     const tracks = searchResult.body.tracks.items;
//                     const bestMatch = tracks.find(track => 
//                         track.name.toLowerCase().includes(title.toLowerCase()) &&
//                         track.artists.some(a => a.name.toLowerCase().includes(artist.toLowerCase()))
//                     ) || tracks[0];
                    
//                     return {
//                         spotifyId: bestMatch.id,
//                         spotifyUri: bestMatch.uri,
//                         spotifyUrl: bestMatch.external_urls.spotify,
//                         previewUrl: bestMatch.preview_url,
//                         albumArt: bestMatch.album.images[0]?.url || null,
//                         popularity: bestMatch.popularity,
//                         explicit: bestMatch.explicit
//                     };
//                 }
//             } catch (searchError) {
//                 console.log(`Search strategy "${query}" failed:`, searchError.message);
//                 continue;
//             }
//         }
        
//         console.log(`No Spotify tracks found for "${title}" by ${artist} with any strategy`);
//         return null;
        
//     } catch (error) {
//         console.error('Enhanced Spotify search error:', error);
//         return null;
//     }
// }

// // Enhanced YouTube URL generation
// function getYouTubeUrl(title, artist) {
//     try {
//         const cleanTitle = title.replace(/[^\w\s]/gi, '');
//         const cleanArtist = artist.replace(/[^\w\s]/gi, '');
//         const searchQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist} official audio`);
//         return `https://www.youtube.com/results?search_query=${searchQuery}`;
//     } catch (error) {
//         console.error('Error generating YouTube URL:', error);
//         return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
//     }
// }

// // Helper function to preprocess JSON string
// function preprocessJsonString(jsonStr) {
//     // Fix time formats (e.g., 4:36 → 276 or "4:36")
//     return jsonStr.replace(/"duration":\s*(\d+):(\d+)/g, (match, minutes, seconds) => {
//         // Convert to seconds as a number
//         const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
//         return `"duration": ${totalSeconds}`;
//     });
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

//         // Get enhanced user profile
//         const User = await user.findById(objectId);
        
//         if (!User) {
//             return res.status(404).json({
//                 message: "User not found",
//                 details: "The provided userId does not exist in the database"
//             });
//         }

//         // Build comprehensive user profile
//         const userProfile = {
//             preferences: User.preferences || [],
//             moodHistory: User.moodTracking || [],
//             musicBehavior: User.musicBehavior || {},
//             sessionHistory: User.sessionHistory || []
//         };
        
//         // Detect current mood first for better recommendations
//         let currentMood = null;
//         try {
//             const moodModel = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
//             const moodPrompt = createMoodAnalysisPrompt(message, conversationHistory, userProfile);
//             const moodResult = await moodModel.generateContent(moodPrompt);
//             currentMood = moodResult.response.text().trim();
//             console.log('Detected mood:', currentMood);
//         } catch (moodError) {
//             console.log('Mood detection failed, continuing without:', moodError);
//         }
        
//         // Get music recommendations using enhanced prompt
//         const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
//         const prompt = createMusicRecommendationPrompt(message, conversationHistory, userProfile, currentMood);
        
//         const result = await model.generateContent(prompt);
//         const responseText = await result.response.text();
//         console.log('Raw Gemini Response: ', responseText);
        
//         // Enhanced JSON parsing with better error handling
//         let responseData;
//         try {
//             // Try to extract JSON from code blocks first
//             const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*?)\n```/);
//             if (jsonMatch) {
//                 responseData = JSON.parse(jsonMatch[1]);
//             } else {
//                 // Try to find JSON object in the response
//                 const jsonStart = responseText.indexOf('{');
//                 const jsonEnd = responseText.lastIndexOf('}') + 1;
//                 if (jsonStart !== -1 && jsonEnd !== 0) {
//                     const jsonString = responseText.substring(jsonStart, jsonEnd);
//                     const preprocessedJson = preprocessJsonString(jsonString);
//                     responseData = JSON.parse(preprocessedJson);
//                 } else {
//                     throw new Error('No JSON found in response');
//                 }
//             }
            
//             // Validate response structure
//             if (!responseData.recommendations || !Array.isArray(responseData.recommendations)) {
//                 throw new Error('Invalid response structure: missing recommendations array');
//             }
            
//         } catch(parseError) {
//             console.error('Enhanced parsing failed:', parseError);
            
//             // Fallback: Create a structured response from the text
//             responseData = {
//                 response: "I understand you're looking for music recommendations. Let me suggest some therapeutic songs that might help.",
//                 detectedMood: currentMood || "neutral",
//                 therapeuticGoal: "emotional support through music",
//                 recommendations: [
//                     {
//                         title: "Weightless",
//                         artist: "Marconi Union", 
//                         genre: "Ambient",
//                         moodTags: ["calming", "relaxing", "therapeutic"],
//                         duration: 485,
//                         recommendedFor: ["relaxation", "stress relief"],
//                         reason: "This song was scientifically designed to reduce anxiety and promote relaxation.",
//                         energyLevel: "low",
//                         therapeuticFunction: "calm"
//                     },
//                     {
//                         title: "Clair de Lune",
//                         artist: "Claude Debussy",
//                         genre: "Classical",
//                         moodTags: ["peaceful", "contemplative", "soothing"],
//                         duration: 300,
//                         recommendedFor: ["meditation", "sleep preparation"],
//                         reason: "This classical piece promotes inner peace and emotional balance.",
//                         energyLevel: "low",
//                         therapeuticFunction: "support"
//                     }
//                 ]
//             };
//         }
        
//         // Enhanced music processing with Spotify integration
//         let recommendationsList = [];
        
//         for (const song of responseData.recommendations) {
//             // Get Spotify data with improved error handling
//             let spotifyData = null;
//             try {
//                 spotifyData = await getSpotifyTrack(song.title, song.artist);
//                 if (spotifyData) {
//                     console.log(`Spotify data for "${song.title}" by ${song.artist}:`, {
//                       id: spotifyData.spotifyId,
//                       uri: spotifyData.spotifyUri,
//                       url: spotifyData.spotifyUrl
//                     });
//                 } else {
//                     console.log(`No Spotify data found for "${song.title}" by ${song.artist}`);
//                 }
//             } catch (spotifyError) {
//                 console.log(`Spotify lookup failed for "${song.title}" by ${song.artist}:`, spotifyError.message);
//             }
            
//             // Fallback URL generation
//             const audioUrl = spotifyData?.spotifyUrl || getYouTubeUrl(song.title, song.artist);
            
//             // Enhanced music resource creation
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
//                     // Enhanced fields
//                     energyLevel: song.energyLevel || 'medium',
//                     therapeuticFunction: song.therapeuticFunction || 'support',
//                     lastRecommendedAt: new Date(),
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         spotifyUrl: spotifyData.spotifyUrl,
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
//                     energyLevel: song.energyLevel || 'medium',
//                     therapeuticFunction: song.therapeuticFunction || 'support',
//                     lastRecommendedAt: new Date(),
//                     ...(spotifyData && {
//                         spotifyId: spotifyData.spotifyId,
//                         spotifyUri: spotifyData.spotifyUri,
//                         spotifyUrl: spotifyData.spotifyUrl,
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
//                 therapeuticFunction: song.therapeuticFunction,
//                 energyLevel: song.energyLevel,
//                 ...(spotifyData && {
//                     spotifyId: spotifyData.spotifyId,
//                     spotifyUrl: spotifyData.spotifyUrl,
//                     spotifyUri: spotifyData.spotifyUri,
//                     previewUrl: spotifyData.previewUrl,
//                     albumArt: spotifyData.albumArt
//                 })
//             });
//         }
        
//         // Save enhanced recommendation record
//         const newRecommendation = new Recommendation({
//             userId: objectId,
//             recommendedMusic: recommendationsList.map(item => ({
//                 musicId: item.musicId,
//                 reason: item.reason,
//                 therapeuticFunction: item.therapeuticFunction || 'support',
//                 energyLevel: item.energyLevel || 'medium'
//             })),
//             therapeuticGoal: responseData.therapeuticGoal,
//             detectedMood: responseData.detectedMood
//         });
        
//         await newRecommendation.save();
        
//         return res.json({
//             response: responseData.response,
//             detectedMood: responseData.detectedMood,
//             therapeuticGoal: responseData.therapeuticGoal,
//             recommendations: recommendationsList
//         });
        
//     } catch(err) {
//         console.log('Error in enhanced music recommendation:', err);
//         res.status(500).json({
//             message: 'Internal server error',
//             error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
//         });
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

// //Get spotify auth URL
// export const getSpotifyAuthUrl = async (req, res) => {
//     const clientId = process.env.SPOTIFY_CLIENT_ID;
//     const redirectUri = 'http://localhost:5173/spotify-callback';
//     const scopes=[
//         'streaming',
//         'user-read-email',
//         'user-read-private',
//         'user-modify-playback-state',
//         'user-read-playback-state',
//         'user-library-read',
//         'playlist-read-private',
//     ];
//     const state=Math.random().toString(36).substring(2, 15);
//     const authUrl='https://accounts.spotify.com/authorize?' +
//     querystring.stringify({
//       response_type: 'code',
//       client_id: clientId,
//       scope: scopes.join(' '),
//       redirect_uri: redirectUri,
//       state: state
//     });
//     res.json({authUrl});
// }

// // Handle Spotify callback
// export const handleSpotifyCallback = async (req, res) => {
//   try {
//     const { code } = req.query;
//     const clientId = process.env.SPOTIFY_CLIENT_ID;
//     const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
//     const redirectUri = 'http://localhost:5173/spotify-callback';
    
//     // Exchange code for tokens
//     const response = await axios.post('https://accounts.spotify.com/api/token', 
//       querystring.stringify({
//         grant_type: 'authorization_code',
//         code,
//         redirect_uri: redirectUri
//       }),
//       {
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
//         }
//       }
//     );
    
//     const { access_token, refresh_token, expires_in } = response.data;
    
//     res.json({
//       accessToken: access_token,
//       refreshToken: refresh_token,
//       expiresIn: expires_in
//     });
//   } catch (error) {
//     console.error('Spotify callback error:', error);
//     res.status(500).json({ message: 'Failed to authenticate with Spotify' });
//   }
// };


import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import dotenv from 'dotenv';
import mongoose from "mongoose";
import querystring from 'querystring';
import SpotifyWebApi from 'spotify-web-api-node';
import MusicResource from "../models/MusicResource.js";
import Recommendation from '../models/Recommendation.js';
import user from '../models/user.js';

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Set up Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

let tokenExpiryTime = 0;

// Enhanced Music Recommendation Prompt
const createMusicRecommendationPrompt = (userInput, conversationHistory = [], userProfile = {}, currentMood = null) => {
  const { preferences = [], moodHistory = [], musicBehavior = {} } = userProfile;
  const { likes = [], skips = [], playlistAdditions = [] } = musicBehavior;
  
  // Analyze user's music preferences from behavior
  const likedGenres = [...new Set(likes.map(l => l.genre).filter(Boolean))];
  const skippedGenres = [...new Set(skips.map(s => s.genre).filter(Boolean))];
  
  const contextualHistory = conversationHistory.slice(-5).map((msg, index) => 
    `${index + 1}. ${msg.sender}: ${msg.text}`
  ).join('\n');

  // Extract number of songs requested from user input
  const getRequestedSongCount = (input) => {
    const lowerInput = input.toLowerCase();
    
    // Check for specific numbers
    const numberMatch = input.match(/(\d+)\s*songs?|(\d+)\s*tracks?|(\d+)\s*recommendations?/i);
    if (numberMatch) {
      const count = parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3]);
      return Math.min(Math.max(count, 1), 15); // Limit between 1-15 songs
    }
    
    // Check for written numbers
    const writtenNumbers = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    for (const [word, num] of Object.entries(writtenNumbers)) {
      if (lowerInput.includes(word + ' song') || lowerInput.includes(word + ' track')) {
        return num;
      }
    }
    
    // Check for ranges
    if (lowerInput.includes('few')) return 4;
    if (lowerInput.includes('several')) return 6;
    if (lowerInput.includes('many') || lowerInput.includes('lots')) return 8;
    if (lowerInput.includes('couple')) return 2;
    
    // Default to 5 songs
    return 5;
  };

  const requestedCount = getRequestedSongCount(userInput);

  return `You are RISHIRAJ's advanced music therapy AI assistant, specialized in providing therapeutic music recommendations. You combine deep musical knowledge with therapeutic expertise to help users find the perfect songs for their emotional needs.

USER PROFILE ANALYSIS:
- Current detected mood: ${currentMood || 'neutral'}
- Stated preferences: ${preferences.join(', ') || 'None specified'}
- Liked music genres: ${likedGenres.join(', ') || 'Learning preferences'}
- Previously skipped genres: ${skippedGenres.join(', ') || 'None noted'}
- Recent mood pattern: ${moodHistory.slice(-3).map(m => m.mood).join(' → ') || 'First session'}

CONVERSATION CONTEXT:
${contextualHistory || 'Initial interaction'}

CURRENT REQUEST: "${userInput}"

SONG COUNT REQUIREMENT: You MUST provide exactly ${requestedCount} song recommendations in your response.

ADVANCED ANALYSIS FRAMEWORK:

1. INTENT CLASSIFICATION:
   a) Direct song request ("recommend songs for", "I need music for")
   b) Mood-based request ("I'm feeling", "help me feel")
   c) Activity-based request ("workout music", "study playlist")
   d) Therapeutic goal ("help me relax", "boost my mood")
   e) Genre/artist preference ("something like", "more of")
   f) Social sharing intent ("playlist for friends", "party music")

2. THERAPEUTIC ASSESSMENT:
   - What emotional state needs support?
   - What is the desired emotional outcome?
   - What's the appropriate energy progression?
   - Are there any contraindications? (e.g., avoiding melancholic music for depression)

3. CONTEXTUAL FACTORS:
   - Time of day implications
   - Activity context (work, exercise, sleep, social)
   - Cultural considerations
   - Personal history and preferences

4. MUSIC THERAPY PRINCIPLES:
   - Iso-principle: Start where the user is emotionally
   - Entrainment: Gradually guide toward desired state
   - Catharsis: Allow emotional release when appropriate
   - Distraction: Redirect from negative thoughts when needed

RESPONSE FORMAT - Return valid JSON:
{
  "response": "Empathetic, personalized response (2-3 sentences) acknowledging their state and explaining your approach",
  "detectedMood": "primary_emotion_identified",
  "therapeuticGoal": "what_we_aim_to_achieve",
  "requestedCount": ${requestedCount},
  "recommendations": [
    // YOU MUST INCLUDE EXACTLY ${requestedCount} SONG OBJECTS HERE
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "genre": "Primary Genre",
      "moodTags": ["current_mood", "target_mood", "energy_level"],
      "duration": 240,
      "recommendedFor": ["specific_activity", "emotional_state"],
      "reason": "Detailed therapeutic explanation of why this song helps with their specific need",
      "energyLevel": "low/medium/high",
      "therapeuticFunction": "support/transition/energize/calm/motivate"
    }
    // ... continue until you have exactly ${requestedCount} songs
  ]
}

CRITICAL REQUIREMENTS:
1. ALWAYS provide exactly ${requestedCount} songs in the recommendations array
2. If user requested a specific number, acknowledge it in your response
3. If providing 5 songs (default), mention "Here are 5 carefully selected songs..."
4. Each song must be unique and serve a specific therapeutic purpose
5. Ensure variety in energy levels and therapeutic functions across the ${requestedCount} songs

SONG DISTRIBUTION STRATEGY FOR ${requestedCount} SONGS:
${requestedCount <= 3 ? `
- Focus on the most therapeutically relevant songs
- Ensure each song serves a distinct emotional need
- Prioritize quality over quantity
` : requestedCount <= 5 ? `
- Start with songs that match current mood (iso-principle)
- Include transition songs to guide emotional state
- End with songs that support desired emotional outcome
- Include at least one energizing and one calming option
` : `
- Begin with 2 songs matching current emotional state
- Include 2-3 transition songs for emotional progression
- Add 2 songs for desired emotional outcome
- Include variety in genres and energy levels
- Ensure each song has a unique therapeutic purpose
`}

SONG SELECTION GUIDELINES:

FOR DIFFERENT MOODS:
- Anxious/Stressed: Start with calming, slower tempo, nature sounds, instrumental
- Sad/Depressed: Begin with acknowledgment, gradually introduce hope
- Angry/Frustrated: Allow intensity expression, then guide toward resolution
- Happy/Excited: Match and enhance positive energy
- Tired/Low Energy: Gentle motivation, building energy progressively
- Confused/Overwhelmed: Clear, simple melodies, familiar comfort songs

GENRE RECOMMENDATIONS BY THERAPEUTIC GOAL:
- Relaxation: Ambient, classical, soft indie, nature sounds
- Motivation: Hip-hop, rock, pop-punk, electronic dance
- Focus: Lo-fi, instrumental, post-rock, minimalist classical
- Emotional Release: Blues, soul, alternative rock, singer-songwriter
- Social Connection: Pop, reggae, folk, world music
- Spiritual/Reflective: Gospel, world spiritual, ethereal

ENSURE SONGS ARE:
- Widely available on streaming platforms
- Culturally appropriate and inclusive
- Matched to user's apparent age/generation preferences
- Balanced between familiar comfort and new discoveries
- Therapeutically progressive (logical emotional journey)

Remember: You're not just recommending music, you're providing therapeutic support through carefully curated musical experiences. Always explain the therapeutic reasoning behind each recommendation.`;
};

// Enhanced Mood Analysis Prompt for music recommendations
const createMoodAnalysisPrompt = (userInput, conversationHistory = [], userProfile = {}) => {
  const { moodHistory = [], preferences = [], currentStreak = 0 } = userProfile;
  
  const recentMoods = moodHistory.slice(-5).map(m => m.mood).join(', ');
  const historyContext = conversationHistory.slice(-3).map(msg => `${msg.sender}: ${msg.text}`).join('\n');
  
  return `You are an expert music therapist and emotional intelligence AI assistant created by RISHIRAJ from NSUT. Your role is to accurately identify and understand the user's emotional state through their text input.

CONTEXT ANALYSIS:
- User's recent mood patterns: ${recentMoods || 'No previous data'}
- Current wellness streak: ${currentStreak} days
- User preferences: ${preferences.join(', ') || 'Not specified'}
- Recent conversation context:
${historyContext || 'No previous conversation'}

CURRENT USER INPUT: "${userInput}"

ANALYSIS FRAMEWORK:
1. PRIMARY EMOTION DETECTION:
   - Identify the dominant emotion (happy, sad, anxious, excited, angry, calm, frustrated, hopeful, lonely, energetic, melancholic, motivated, stressed, peaceful, confused)
   - Consider intensity level (mild, moderate, strong, intense)

2. CONTEXTUAL FACTORS:
   - Look for temporal indicators (today, yesterday, lately, recently)
   - Identify situational triggers (work, relationships, health, achievements, challenges)
   - Note any contradictory emotions or mixed feelings
   - Consider cultural and personal context clues

3. THERAPEUTIC INSIGHTS:
   - Assess if this represents a pattern or change from recent moods
   - Identify any concerning patterns (persistent negativity, mood swings)
   - Note positive developments or progress indicators

4. RESPONSE REQUIREMENTS:
   - Return ONLY a single primary mood word (lowercase)
   - If multiple emotions are present, choose the most therapeutically relevant one
   - Prioritize emotions that would benefit most from music therapy intervention

EXAMPLES:
- "I've been struggling with work stress lately" → "stressed"
- "Finally got that promotion I've been working toward!" → "accomplished"
- "Can't sleep, mind racing with worries" → "anxious"
- "Just want to curl up and listen to something soothing" → "melancholic"
- "Ready to take on the world today!" → "energetic"

Analyze the user's input and respond with a single mood word that best captures their therapeutic needs.`;
};

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

// Enhanced Spotify track lookup with better error handling
async function getSpotifyTrack(title, artist) {
    try {
        // Enhanced search with multiple strategies
        const searchStrategies = [
            `track:"${title}" artist:"${artist}"`,
            `"${title}" "${artist}"`,
            `${title} ${artist}`,
            title.split(' ')[0] + ' ' + artist // Fallback to first word of title
        ];
        
        for (const query of searchStrategies) {
            try {
                const searchResult = await spotifyApi.searchTracks(query, { limit: 5 });
                
                if (searchResult.body.tracks.items.length > 0) {
                    // Find best match
                    const tracks = searchResult.body.tracks.items;
                    const bestMatch = tracks.find(track => 
                        track.name.toLowerCase().includes(title.toLowerCase()) &&
                        track.artists.some(a => a.name.toLowerCase().includes(artist.toLowerCase()))
                    ) || tracks[0];
                    
                    return {
                        spotifyId: bestMatch.id,
                        spotifyUri: bestMatch.uri,
                        spotifyUrl: bestMatch.external_urls.spotify,
                        previewUrl: bestMatch.preview_url,
                        albumArt: bestMatch.album.images[0]?.url || null,
                        popularity: bestMatch.popularity,
                        explicit: bestMatch.explicit
                    };
                }
            } catch (searchError) {
                console.log(`Search strategy "${query}" failed:`, searchError.message);
                continue;
            }
        }
        
        console.log(`No Spotify tracks found for "${title}" by ${artist} with any strategy`);
        return null;
        
    } catch (error) {
        console.error('Enhanced Spotify search error:', error);
        return null;
    }
}

// Enhanced YouTube URL generation
function getYouTubeUrl(title, artist) {
    try {
        const cleanTitle = title.replace(/[^\w\s]/gi, '');
        const cleanArtist = artist.replace(/[^\w\s]/gi, '');
        const searchQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist} official audio`);
        return `https://www.youtube.com/results?search_query=${searchQuery}`;
    } catch (error) {
        console.error('Error generating YouTube URL:', error);
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
    }
}

// Helper function to preprocess JSON string
function preprocessJsonString(jsonStr) {
    // Fix time formats (e.g., 4:36 → 276 or "4:36")
    return jsonStr.replace(/"duration":\s*(\d+):(\d+)/g, (match, minutes, seconds) => {
        // Convert to seconds as a number
        const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
        return `"duration": ${totalSeconds}`;
    });
}

export const getMusicRecommendations = async(req, res) => {
    try {
        const {userId, message, conversationHistory} = req.body;
        console.log('Received request with:', {userId, message, conversationHistory});
        
        // Validate userId
        if(!userId || typeof userId !== 'string' || userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            console.log('Invalid userId detected : ', userId);
            return res.status(400).json({
                message: 'Invalid userId format',
                details: "Must be a 24-character hex string",
                receivedUserId: userId
            });
        }
        
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

        // Get enhanced user profile
        const User = await user.findById(objectId);
        
        if (!User) {
            return res.status(404).json({
                message: "User not found",
                details: "The provided userId does not exist in the database"
            });
        }

        // Build comprehensive user profile
        const userProfile = {
            preferences: User.preferences || [],
            moodHistory: User.moodTracking || [],
            musicBehavior: User.musicBehavior || {},
            sessionHistory: User.sessionHistory || []
        };
        
        // Detect current mood first for better recommendations
        let currentMood = null;
        try {
            const moodModel = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
            const moodPrompt = createMoodAnalysisPrompt(message, conversationHistory, userProfile);
            const moodResult = await moodModel.generateContent(moodPrompt);
            currentMood = moodResult.response.text().trim();
            console.log('Detected mood:', currentMood);
        } catch (moodError) {
            console.log('Mood detection failed, continuing without:', moodError);
        }
        
        // Get music recommendations using enhanced prompt
        const model = genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        const prompt = createMusicRecommendationPrompt(message, conversationHistory, userProfile, currentMood);
        
        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();
        console.log('Raw Gemini Response: ', responseText);
        
        // Enhanced JSON parsing with better error handling
        let responseData;
        try {
            // Try to extract JSON from code blocks first
            const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                responseData = JSON.parse(jsonMatch[1]);
            } else {
                // Try to find JSON object in the response
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}') + 1;
                if (jsonStart !== -1 && jsonEnd !== 0) {
                    const jsonString = responseText.substring(jsonStart, jsonEnd);
                    const preprocessedJson = preprocessJsonString(jsonString);
                    responseData = JSON.parse(preprocessedJson);
                } else {
                    throw new Error('No JSON found in response');
                }
            }
            
            // Validate response structure and song count
            if (!responseData.recommendations || !Array.isArray(responseData.recommendations)) {
                throw new Error('Invalid response structure: missing recommendations array');
            }
            
            // Check if we got the expected number of songs
            const expectedCount = responseData.requestedCount || 5;
            if (responseData.recommendations.length < expectedCount) {
                console.log(`Warning: Expected ${expectedCount} songs but got ${responseData.recommendations.length}`);
                
                // If we got fewer songs than expected, pad with therapeutic defaults
                const additionalSongs = expectedCount - responseData.recommendations.length;
                const defaultTherapeuticSongs = [
                    {
                        title: "Weightless",
                        artist: "Marconi Union", 
                        genre: "Ambient",
                        moodTags: ["calming", "relaxing", "therapeutic"],
                        duration: 485,
                        recommendedFor: ["relaxation", "stress relief"],
                        reason: "This song was scientifically designed to reduce anxiety and promote relaxation.",
                        energyLevel: "low",
                        therapeuticFunction: "calm"
                    },
                    {
                        title: "Clair de Lune",
                        artist: "Claude Debussy",
                        genre: "Classical",
                        moodTags: ["peaceful", "contemplative", "soothing"],
                        duration: 300,
                        recommendedFor: ["meditation", "sleep preparation"],
                        reason: "This classical piece promotes inner peace and emotional balance.",
                        energyLevel: "low",
                        therapeuticFunction: "support"
                    },
                    {
                        title: "River",
                        artist: "Leon Bridges",
                        genre: "Soul",
                        moodTags: ["hopeful", "uplifting", "spiritual"],
                        duration: 245,
                        recommendedFor: ["emotional healing", "hope building"],
                        reason: "This soulful track provides comfort and hope during difficult times.",
                        energyLevel: "medium",
                        therapeuticFunction: "support"
                    },
                    {
                        title: "Breathe",
                        artist: "Telepopmusik",
                        genre: "Electronic",
                        moodTags: ["meditative", "centering", "peaceful"],
                        duration: 275,
                        recommendedFor: ["mindfulness", "anxiety relief"],
                        reason: "The gentle electronic sounds help center the mind and reduce racing thoughts.",
                        energyLevel: "low",
                        therapeuticFunction: "calm"
                    },
                    {
                        title: "Mad World",
                        artist: "Gary Jules",
                        genre: "Alternative",
                        moodTags: ["melancholic", "reflective", "cathartic"],
                        duration: 195,
                        recommendedFor: ["emotional processing", "sadness validation"],
                        reason: "Sometimes we need music that validates our difficult emotions before we can move forward.",
                        energyLevel: "low",
                        therapeuticFunction: "support"
                    }
                ];
                
                // Add additional songs up to the expected count
                for (let i = 0; i < additionalSongs && i < defaultTherapeuticSongs.length; i++) {
                    responseData.recommendations.push(defaultTherapeuticSongs[i]);
                }
            }
            
        } catch(parseError) {
            console.error('Enhanced parsing failed:', parseError);
            
            // Determine requested count from original input
            const getRequestedCount = (input) => {
                const lowerInput = input.toLowerCase();
                const numberMatch = input.match(/(\d+)\s*songs?|(\d+)\s*tracks?|(\d+)\s*recommendations?/i);
                if (numberMatch) {
                    const count = parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3]);
                    return Math.min(Math.max(count, 1), 15);
                }
                
                const writtenNumbers = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                
                for (const [word, num] of Object.entries(writtenNumbers)) {
                    if (lowerInput.includes(word + ' song') || lowerInput.includes(word + ' track')) {
                        return num;
                    }
                }
                
                if (lowerInput.includes('few')) return 4;
                if (lowerInput.includes('several')) return 6;
                if (lowerInput.includes('many') || lowerInput.includes('lots')) return 8;
                if (lowerInput.includes('couple')) return 2;
                
                return 5; // Default
            };
            
            const fallbackCount = getRequestedCount(message);
            
            // Fallback: Create a structured response with the requested number of songs
            const fallbackSongs = [
                {
                    title: "Weightless",
                    artist: "Marconi Union", 
                    genre: "Ambient",
                    moodTags: ["calming", "relaxing", "therapeutic"],
                    duration: 485,
                    recommendedFor: ["relaxation", "stress relief"],
                    reason: "This song was scientifically designed to reduce anxiety and promote relaxation.",
                    energyLevel: "low",
                    therapeuticFunction: "calm"
                },
                {
                    title: "Clair de Lune",
                    artist: "Claude Debussy",
                    genre: "Classical",
                    moodTags: ["peaceful", "contemplative", "soothing"],
                    duration: 300,
                    recommendedFor: ["meditation", "sleep preparation"],
                    reason: "This classical piece promotes inner peace and emotional balance.",
                    energyLevel: "low",
                    therapeuticFunction: "support"
                },
                {
                    title: "River",
                    artist: "Leon Bridges",
                    genre: "Soul",
                    moodTags: ["hopeful", "uplifting", "spiritual"],
                    duration: 245,
                    recommendedFor: ["emotional healing", "hope building"],
                    reason: "This soulful track provides comfort and hope during difficult times.",
                    energyLevel: "medium",
                    therapeuticFunction: "support"
                },
                {
                    title: "Breathe",
                    artist: "Telepopmusik",
                    genre: "Electronic",
                    moodTags: ["meditative", "centering", "peaceful"],
                    duration: 275,
                    recommendedFor: ["mindfulness", "anxiety relief"],
                    reason: "The gentle electronic sounds help center the mind and reduce racing thoughts.",
                    energyLevel: "low",
                    therapeuticFunction: "calm"
                },
                {
                    title: "Mad World",
                    artist: "Gary Jules",
                    genre: "Alternative",
                    moodTags: ["melancholic", "reflective", "cathartic"],
                    duration: 195,
                    recommendedFor: ["emotional processing", "sadness validation"],
                    reason: "Sometimes we need music that validates our difficult emotions before we can move forward.",
                    energyLevel: "low",
                    therapeuticFunction: "support"
                },
                {
                    title: "Here Comes the Sun",
                    artist: "The Beatles",
                    genre: "Rock",
                    moodTags: ["hopeful", "uplifting", "optimistic"],
                    duration: 185,
                    recommendedFor: ["mood lifting", "motivation"],
                    reason: "This classic brings hope and reminds us that difficult times are temporary.",
                    energyLevel: "medium",
                    therapeuticFunction: "energize"
                },
                {
                    title: "Lose Yourself",
                    artist: "Eminem",
                    genre: "Hip-Hop",
                    moodTags: ["motivational", "empowering", "determined"],
                    duration: 326,
                    recommendedFor: ["motivation", "confidence building"],
                    reason: "This powerful track helps build determination and self-confidence.",
                    energyLevel: "high",
                    therapeuticFunction: "motivate"
                },
                {
                    title: "The Sound of Silence",
                    artist: "Simon & Garfunkel",
                    genre: "Folk",
                    moodTags: ["reflective", "introspective", "contemplative"],
                    duration: 200,
                    recommendedFor: ["self-reflection", "processing emotions"],
                    reason: "This song provides a safe space for deep reflection and emotional processing.",
                    energyLevel: "low",
                    therapeuticFunction: "support"
                }
            ];
            
            responseData = {
                response: `I understand you're looking for music recommendations. Here are ${fallbackCount} carefully selected therapeutic songs that might help.`,
                detectedMood: currentMood || "neutral",
                therapeuticGoal: "emotional support through music",
                requestedCount: fallbackCount,
                recommendations: fallbackSongs.slice(0, fallbackCount)
            };
        }
        
        // Enhanced music processing with Spotify integration
        let recommendationsList = [];
        
        for (const song of responseData.recommendations) {
            // Get Spotify data with improved error handling
            let spotifyData = null;
            try {
                spotifyData = await getSpotifyTrack(song.title, song.artist);
                if (spotifyData) {
                    console.log(`Spotify data for "${song.title}" by ${song.artist}:`, {
                      id: spotifyData.spotifyId,
                      uri: spotifyData.spotifyUri,
                      url: spotifyData.spotifyUrl
                    });
                } else {
                    console.log(`No Spotify data found for "${song.title}" by ${song.artist}`);
                }
            } catch (spotifyError) {
                console.log(`Spotify lookup failed for "${song.title}" by ${song.artist}:`, spotifyError.message);
            }
            
            // Fallback URL generation
            const audioUrl = spotifyData?.spotifyUrl || getYouTubeUrl(song.title, song.artist);
            
            // Enhanced music resource creation
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
                    // Enhanced fields
                    energyLevel: song.energyLevel || 'medium',
                    therapeuticFunction: song.therapeuticFunction || 'support',
                    lastRecommendedAt: new Date(),
                    ...(spotifyData && {
                        spotifyId: spotifyData.spotifyId,
                        spotifyUri: spotifyData.spotifyUri,
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
                    energyLevel: song.energyLevel || 'medium',
                    therapeuticFunction: song.therapeuticFunction || 'support',
                    lastRecommendedAt: new Date(),
                    ...(spotifyData && {
                        spotifyId: spotifyData.spotifyId,
                        spotifyUri: spotifyData.spotifyUri,
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
                therapeuticFunction: song.therapeuticFunction,
                energyLevel: song.energyLevel,
                ...(spotifyData && {
                    spotifyId: spotifyData.spotifyId,
                    spotifyUrl: spotifyData.spotifyUrl,
                    spotifyUri: spotifyData.spotifyUri,
                    previewUrl: spotifyData.previewUrl,
                    albumArt: spotifyData.albumArt
                })
            });
        }
        
        // Save enhanced recommendation record
        const newRecommendation = new Recommendation({
            userId: objectId,
            recommendedMusic: recommendationsList.map(item => ({
                musicId: item.musicId,
                reason: item.reason,
                therapeuticFunction: item.therapeuticFunction || 'support',
                energyLevel: item.energyLevel || 'medium'
            })),
            therapeuticGoal: responseData.therapeuticGoal,
            detectedMood: responseData.detectedMood
        });
        
        await newRecommendation.save();
        
        return res.json({
            response: responseData.response,
            detectedMood: responseData.detectedMood,
            therapeuticGoal: responseData.therapeuticGoal,
            recommendations: recommendationsList
        });
        
    } catch(err) {
        console.log('Error in enhanced music recommendation:', err);
        res.status(500).json({
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
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
