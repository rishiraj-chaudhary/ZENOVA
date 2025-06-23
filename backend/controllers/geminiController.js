import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const analyzeMood = async (req, res) => {
    try {
        const { userId, userInput } = req.body;

        console.log("Received request with:", { userId, userInput });

        // Validate userId format
        if (!userId || typeof userId !== 'string' || (userId !== "guest" && (userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)))) {
            console.error("Invalid userId Detected:", userId);
            return res.status(400).json({ 
                message: "Invalid userId format", 
                details: "Must be a 24-character hex string or 'guest'",
                receivedUserId: userId
            });
        }

        let objectId = null;
        if (userId !== "guest") {
            try {
                objectId = new mongoose.Types.ObjectId(userId);
                console.log('✅ Converted ObjectId:', objectId);
            } catch (idError) {
                console.error('❌ ObjectId Conversion Error:', idError);
                return res.status(400).json({ 
                    message: "Invalid userId format", 
                    details: idError.message 
                });
            }
        }


        // 🧠 Use Gemini API to Analyze Mood
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Analyze the mood from the following user input and provide a one-word mood description: "${userInput}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const moodResponse = response.text();

        console.log("Gemini Mood Analysis Result:", moodResponse);

        return res.json({
            message: "Mood analyzed successfully",
            mood: moodResponse.trim(),
        });

    } catch (err) {
        console.error("Error in mood analysis:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const chatWithAI = async (req, res) => {
    try {
        const { userId, userInput } = req.body;
        
        if (!userInput) return res.status(400).json({ message: "Input required!" });

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                         
            const prompt = `You are a music therapy assistant created by RISHIRAJ, an undergrad at NSUT, to help users find and compile music that matches their needs and emotions.

        CORE INSTRUCTIONS:
        1. **About Creator**: If asked who made you, mention RISHIRAJ from NSUT and suggest artists like NF, Eminem, and Billie Eilish as examples of emotionally impactful music.

        2. **Song Recommendations**:
        - Always provide 3-5 specific song suggestions with artist names
        - Match songs to the user's mood, situation, or explicit request
        - Focus on popular/well-known songs unless user specifically asks for "hidden gems", "underrated", "lesser-known", or "indie" music
        - Include a mix of genres when appropriate (pop, hip-hop, rock, indie, etc.)
        - Explain briefly why each song fits their request

        3. **Response Format**:
        - Start with empathetic acknowledgment of their input
        - Provide song recommendations in this format: "Song Title" by Artist Name
        - Add 1-2 sentences about why the song fits
        - End with encouraging words

        4. **Mood Categories to Consider**:
        - Happy/Upbeat: energetic, celebratory songs
        - Sad/Melancholy: emotional, reflective songs 
        - Motivated/Pumped: workout, motivational tracks
        - Relaxed/Chill: calming, ambient music
        - Angry/Frustrated: cathartic, intense songs
        - Nostalgic: throwback, sentimental tracks
        - Focus/Study: instrumental, lo-fi beats

        5. **Special Requests**:
        - If user asks for specific genres, decades, or artists, prioritize those
        - If user mentions activities (workout, study, sleep), tailor accordingly
        - Only suggest lesser-known/indie songs when explicitly requested

        EXAMPLE RESPONSES:
        - For "I'm feeling down": "I understand you're going through a tough time. Here are some songs that might help: 'Breathe Me' by Sia, 'Heavy' by Linkin Park ft. Kiiara, 'Someone You Loved' by Lewis Capaldi..."
        - For "I need workout music": "Let's get you pumped up! Try these high-energy tracks: 'Till I Collapse' by Eminem, 'Stronger' by Kanye West, 'Eye of the Tiger' by Survivor..."

        User input: "${userInput}"`;
                         
            const result = await model.generateContent(prompt);
            console.log('Gemini AI Response:', result.response);
                         
            const aiResponse = result.response.text || result.response.message || result.response.content || "No response";
 
            res.json({
                 response: aiResponse,
                userId: userId || null
            });
        } catch (apiError) {
            console.error("Gemini AI Chat API Error:", apiError);
            res.status(500).json({ message: "AI chat failed.", error: apiError.message });
        }
    } catch (err) {
        console.error("Error in AI chat:", err);
        res.status(500).json({ message: "Chat processing failed." });
    }
};


// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import MusicResource from "../models/MusicResource.js";
// import User from "../models/user.js";

// dotenv.config();

// // Initialize Gemini AI
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// export const analyzeMood = async (req, res) => {
//     try {
//         const { userId, userInput } = req.body;
        
//         console.log("Received request with:", { userId, userInput });
        
//         // Validate userId format
//         if (!userId || typeof userId !== 'string' || (userId !== "guest" && (userId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userId)))) {
//             console.error("Invalid userId Detected:", userId);
//             return res.status(400).json({
//                 message: "Invalid userId format",
//                 details: "Must be a 24-character hex string or 'guest'",
//                 receivedUserId: userId
//             });
//         }
        
//         let objectId = null;
//         if (userId !== "guest") {
//             try {
//                 objectId = new mongoose.Types.ObjectId(userId);
//                 console.log('✅ Converted ObjectId:', objectId);
//             } catch (idError) {
//                 console.error('❌ ObjectId Conversion Error:', idError);
//                 return res.status(400).json({
//                     message: "Invalid userId format",
//                     details: idError.message
//                 });
//             }
//         }
        
//         // 🧠 Use Gemini API to Analyze Mood
//         const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
//         const prompt = `Analyze the mood from the following user input and provide a one-word mood description: "${userInput}"`;
        
//         const result = await model.generateContent(prompt);
//         const response = await result.response;
//         const moodResponse = response.text();
        
//         console.log("Gemini Mood Analysis Result:", moodResponse);
        
//         // Store mood in user profile if not guest
//         if (userId !== "guest") {
//             try {
//                 await User.findByIdAndUpdate(objectId, {
//                     $push: { moodTracking: { mood: moodResponse.trim(), date: new Date() } }
//                 });
//             } catch (dbError) {
//                 console.error("Failed to update user mood tracking:", dbError);
//                 // Continue anyway - non-critical error
//             }
//         }
        
//         // ✅ Send Mood Response
//         return res.json({
//             message: "Mood analyzed successfully",
//             mood: moodResponse.trim(),
//         });
        
//     } catch (err) {
//         console.error("Error in mood analysis:", err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };

// export const chatWithAI = async (req, res) => {
//     try {
//         const { userId, userInput } = req.body;
        
//         if (!userInput) return res.status(400).json({ message: "Input required!" });
        
//         try {
//             const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
//             const prompt = `You are a music therapy assistant.
//             Provide a supportive, empathetic response to the following user input,
//             keeping the tone helpful and constructive:
            
//             User input: "${userInput}"`;
            
//             const result = await model.generateContent(prompt);
//             console.log('Gemini AI Response:', result.response); // Check response structure
            
//             const aiResponse = result.response.text || result.response.message || result.response.content || "No response";
//             console.log("Extracted AI Response:", aiResponse); // Add this for debugging
//             res.json({
//                 response: aiResponse,
//                 mood: detectedMood,
//                 conversationState: nextState,
//                 recommendations: recommendations
//             });
//         } catch (apiError) {
//             console.error("Gemini AI Chat API Error:", apiError);
//             res.status(500).json({ message: "AI chat failed.", error: apiError.message });
//         }
//     } catch (err) {
//         console.error("Error in AI chat:", err);
//         res.status(500).json({ message: "Chat processing failed." });
//     }
// };

// export const chat = async (req, res) => {
//     try {
//         const { userId, userInput, conversationState } = req.body;
        
//         if (!userInput) return res.status(400).json({ message: "Input required!" });
        
//         // Default conversation state if not provided
//         const currentState = conversationState || {
//             stage: 'greeting',
//             contextMood: null,
//             previousResponses: [],
//             userPreferences: {
//                 genre: [],
//                 artists: [],
//                 tempo: null,
//                 purpose: null
//             }
//         };
        
//         try {
//             const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
//             // Get user info if available
//             let userInfo = {};
//             if (userId !== "guest" && mongoose.Types.ObjectId.isValid(userId)) {
//                 const user = await User.findById(userId);
//                 if (user) {
//                     userInfo = {
//                         name: user.name || "User",
//                         favoriteGenres: user.preferences?.favoriteGenres || [],
//                         favoriteArtists: user.preferences?.favoriteArtists || [],
//                         moodHistory: user.moodTracking?.slice(-5) || []
//                     };
//                 }
//             }
            
//             // Build conversation history
//             const previousConversation = currentState.previousResponses.map((message, index) => {
//                 return (index % 2 === 0) 
//                     ? `User: ${message}`
//                     : `Assistant: ${message}`;
//             }).join('\n');
            
//             // Build prompt based on conversation stage
//             let prompt = "";
            
//             switch (currentState.stage) {
//                 case 'greeting':
//                     prompt = `You are a music therapy assistant that can have meaningful conversations with users and recommend music based on their mood and preferences.
                    
//                     Your conversation goal is to understand how the user is feeling and help them through music. Ask follow-up questions to understand their emotional state better.
                    
//                     User information:
//                     ${JSON.stringify(userInfo)}
                    
//                     Previous conversation:
//                     ${previousConversation}
                    
//                     User's latest message: "${userInput}"
                    
//                     Analyze if the user expressed any mood in their message. If so, note it. If not, ask them about their current mood in a conversational way.
//                     Ask what kind of music they would like to hear or what they need music for right now (relaxation, energy, focus, etc).
                    
//                     Respond in a friendly, supportive tone with no more than 2-3 short paragraphs.`;
//                     break;
                    
//                 case 'mood_exploration':
//                     prompt = `You are a music therapy assistant that can have meaningful conversations with users and recommend music based on their mood and preferences.
                    
//                     Your conversation goal is to understand the user's current emotional state and preferences in depth.
                    
//                     User information:
//                     ${JSON.stringify(userInfo)}
                    
//                     Previous conversation:
//                     ${previousConversation}
                    
//                     Current understanding of user's mood: ${currentState.contextMood || "Unknown"}
                    
//                     User's latest message: "${userInput}"
                    
//                     Further explore the user's mood or musical preferences. If they've expressed a clear mood, confirm it and ask about their music preferences 
//                     (genre, artist, tempo, etc.) for this mood. If they've shared music preferences, confirm understanding and ask if they're looking for music to 
//                     enhance their current mood or change it.
                    
//                     Respond in a friendly, supportive tone with no more than 2-3 short paragraphs.`;
//                     break;
                    
//                 case 'music_preference':
//                     prompt = `You are a music therapy assistant that can have meaningful conversations with users and recommend music based on their mood and preferences.
                    
//                     Your conversation goal is to finalize music preferences and prepare to make recommendations.
                    
//                     User information:
//                     ${JSON.stringify(userInfo)}
                    
//                     Previous conversation:
//                     ${previousConversation}
                    
//                     Current understanding of user's mood: ${currentState.contextMood || "Unknown"}
//                     Current music preferences: ${JSON.stringify(currentState.userPreferences)}
                    
//                     User's latest message: "${userInput}"
                    
//                     Based on the user's response, finalize your understanding of their musical needs. If they've shared specific preferences (artists, genres, 
//                     tempo, purpose of listening), confirm these. If they're asking for recommendations now, acknowledge that and prepare to provide them. 
//                     If they're asking for something else entirely, address that appropriately.
                    
//                     Respond in a friendly, supportive tone with no more than 2-3 short paragraphs.`;
//                     break;
                    
//                 case 'recommendation':
//                     prompt = `You are a music therapy assistant that can have meaningful conversations with users and recommend music based on their mood and preferences.
                    
//                     Your conversation goal is to discuss music recommendations and gather feedback.
                    
//                     User information:
//                     ${JSON.stringify(userInfo)}
                    
//                     Previous conversation:
//                     ${previousConversation}
                    
//                     Current understanding of user's mood: ${currentState.contextMood || "Unknown"}
//                     Current music preferences: ${JSON.stringify(currentState.userPreferences)}
                    
//                     User's latest message: "${userInput}"
                    
//                     The user has been shown music recommendations. Respond to their feedback or questions about the recommendations. If they seem satisfied, 
//                     ask if they'd like to explore more music or if they have any other needs. If they seem unsatisfied, ask what kind of music would better 
//                     suit their needs right now.
                    
//                     Respond in a friendly, supportive tone with no more than 2-3 short paragraphs.`;
//                     break;
                    
//                 default:
//                     // Default conversation prompt
//                     prompt = `You are a music therapy assistant that can have meaningful conversations with users and recommend music based on their mood and preferences.
                    
//                     Previous conversation:
//                     ${previousConversation}
                    
//                     User's latest message: "${userInput}"
                    
//                     Respond in a helpful, friendly manner. If they're expressing a mood or asking about music, help them explore that. If they're giving feedback
//                     on recommendations, respond appropriately. Always maintain a supportive, therapeutic tone.
                    
//                     Respond in a friendly, supportive tone with no more than 2-3 short paragraphs.`;
//             }
            
//             // Generate AI response
//             const result = await model.generateContent(prompt);
//             const aiResponse = result.response.text();
            
//             // Analyze for mood detection
//             let detectedMood = null;
//             let shouldUpdateMood = false;
//             if (currentState.stage === 'greeting' || currentState.stage === 'mood_exploration') {
//                 // Try to detect mood from user input
//                 const moodAnalysisPrompt = `Based on this user message, identify the primary emotional state or mood expressed. 
//                 Return ONLY a single word representing the mood: "${userInput}"`;
                
//                 const moodResult = await model.generateContent(moodAnalysisPrompt);
//                 const moodResponse = moodResult.response.text().trim();
                
//                 // Only update if we get a valid mood word
//                 if (moodResponse && moodResponse.length < 20) {
//                     detectedMood = moodResponse;
//                     shouldUpdateMood = true;
//                 }
//             }
            
//             // Analyze conversation state
//             const stateAnalysisPrompt = `Analyze the current conversation stage based on this exchange:
            
//             Previous conversation:
//             ${previousConversation}
            
//             User's latest message: "${userInput}"
//             Bot's response: "${aiResponse}"
            
//             Current stage: ${currentState.stage}
            
//             Decide the next conversation stage:
//             - greeting: Initial greeting and mood assessment
//             - mood_exploration: Exploring and understanding mood in more depth
//             - music_preference: Gathering music preferences
//             - recommendation: Ready for or discussing music recommendations
            
//             Also extract any music preferences mentioned by the user (genres, artists, tempo, purpose of listening).
            
//             Return valid JSON in this format:
//             {
//                 "nextStage": "one_of_the_stages_above",
//                 "userPreferences": {
//                     "genre": ["list", "of", "genres"],
//                     "artists": ["list", "of", "artists"],
//                     "tempo": "fast/medium/slow or null",
//                     "purpose": "relaxation/focus/energy/sleep/etc or null"
//                 }
//             }`;
            
//             const stateResult = await model.generateContent(stateAnalysisPrompt);
//             const stateAnalysis = stateResult.response.text();
            
//             // Parse state analysis
//             let nextState = { ...currentState };
//             try {
//                 const stateData = JSON.parse(stateAnalysis);
//                 if (stateData.nextStage) {
//                     nextState.stage = stateData.nextStage;
//                 }
                
//                 // Continued from previous part
//                 if (stateData.userPreferences) {
//                     // Merge new preferences with existing ones
//                     nextState.userPreferences = {
//                         ...nextState.userPreferences,
//                         genre: [...new Set([...(nextState.userPreferences.genre || []), ...(stateData.userPreferences.genre || [])])],
//                         artists: [...new Set([...(nextState.userPreferences.artists || []), ...(stateData.userPreferences.artists || [])])],
//                         tempo: stateData.userPreferences.tempo || nextState.userPreferences.tempo,
//                         purpose: stateData.userPreferences.purpose || nextState.userPreferences.purpose
//                     };
//                 }
//             } catch (parseError) {
//                 console.error("Failed to parse state analysis:", parseError);
//                 // Continue with current state if parsing fails
//             }
            
//             // Update mood in next state if detected
//             if (shouldUpdateMood && detectedMood) {
//                 nextState.contextMood = detectedMood;
                
//                 // Store mood in user profile if not guest
//                 if (userId !== "guest" && mongoose.Types.ObjectId.isValid(userId)) {
//                     try {
//                         await User.findByIdAndUpdate(userId, {
//                             $push: { moodTracking: { mood: detectedMood, date: new Date() } }
//                         });
//                     } catch (dbError) {
//                         console.error("Failed to update user mood tracking:", dbError);
//                         // Continue anyway - non-critical error
//                     }
//                 }
//             }
            
//             // Update previous responses
//             nextState.previousResponses = [
//                 ...nextState.previousResponses,
//                 userInput,
//                 aiResponse
//             ];
            
//             // Get recommendations if we're entering recommendation stage
//             let recommendations = null;
//             if (nextState.stage === 'recommendation' && currentState.stage !== 'recommendation') {
//                 try {
//                     // Decide if we should get recommendations now
//                     const shouldGetRecommendations = nextState.contextMood || 
//                         Object.values(nextState.userPreferences).some(val => 
//                             Array.isArray(val) ? val.length > 0 : Boolean(val)
//                         );
                    
//                     if (shouldGetRecommendations) {
//                         // Get music recommendations based on current context
//                         const mood = nextState.contextMood || "neutral";
//                         const genres = nextState.userPreferences.genre || [];
//                         const artists = nextState.userPreferences.artists || [];
//                         const purpose = nextState.userPreferences.purpose || null;
                        
//                         // Query the database for recommendations
//                         let query = {};
                        
//                         if (mood) {
//                             query.mood = { $regex: new RegExp(mood, 'i') };
//                         }
                        
//                         if (genres.length > 0) {
//                             query.genre = { $in: genres.map(g => new RegExp(g, 'i')) };
//                         }
                        
//                         if (artists.length > 0) {
//                             query.artist = { $in: artists.map(a => new RegExp(a, 'i')) };
//                         }
                        
//                         // Get recommendations from the database
//                         const musicResults = await MusicResource.find(query).limit(6);
                        
//                         if (musicResults.length > 0) {
//                             recommendations = musicResults.map(song => ({
//                                 musicId: song._id,
//                                 title: song.title,
//                                 artist: song.artist,
//                                 albumArt: song.albumArt,
//                                 spotifyUrl: song.spotifyUrl,
//                                 audioUrl: song.audioUrl || null,
//                                 previewUrl: song.previewUrl || null,
//                                 reason: `This ${song.genre} song matches your ${mood} mood${purpose ? ` and is great for ${purpose}` : ''}.`
//                             }));
//                         }
//                     }
//                 } catch (recError) {
//                     console.error("Error getting recommendations:", recError);
//                     // Continue without recommendations if there's an error
//                 }
//             }
            
//             // Return the response with updated state
//             res.json({
//                 response: aiResponse,
//                 mood: detectedMood,
//                 conversationState: nextState,
//                 recommendations: recommendations
//             });
            
//         } catch (apiError) {
//             console.error("Gemini AI Chat API Error:", apiError);
//             res.status(500).json({ message: "AI chat failed.", error: apiError.message });
//         }
//     } catch (err) {
//         console.error("Error in AI chat:", err);
//         res.status(500).json({ message: "Chat processing failed." });
//     }
// };

// // Function to get recommendations based on mood and preferences
// export const getRecommendations = async (mood, preferences = {}) => {
//     try {
//         const { genres = [], artists = [], tempo = null, purpose = null } = preferences;
        
//         // Build query
//         let query = {};
        
//         if (mood) {
//             query.mood = { $regex: new RegExp(mood, 'i') };
//         }
        
//         if (genres.length > 0) {
//             query.genre = { $in: genres.map(g => new RegExp(g, 'i')) };
//         }
        
//         if (artists.length > 0) {
//             query.artist = { $in: artists.map(a => new RegExp(a, 'i')) };
//         }
        
//         // Get recommendations from the database
//         const musicResults = await MusicResource.find(query).limit(8);
        
//         if (musicResults.length > 0) {
//             return musicResults.map(song => ({
//                 musicId: song._id,
//                 title: song.title,
//                 artist: song.artist,
//                 albumArt: song.albumArt,
//                 spotifyUrl: song.spotifyUrl,
//                 audioUrl: song.audioUrl || null,
//                 previewUrl: song.previewUrl || null,
//                 reason: `This ${song.genre} song matches your ${mood} mood${purpose ? ` and is great for ${purpose}` : ''}.`
//             }));
//         }
        
//         return [];
//     } catch (err) {
//         console.error("Error in getRecommendations:", err);
//         return [];
//     }
// };


