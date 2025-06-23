import dotenv from "dotenv";
import mongoose from "mongoose"; // Ensure mongoose is imported
import OpenAI from "openai";
import user from "../models/user.js";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const analyzeMood = async (req, res) => {
    try {
        const { userId, userInput } = req.body;
        if (!userInput) {
            return res.status(400).json({ message: "Input required!" });
        }

        // Ask GPT-4 for mood detection
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: `Detect the mood in this sentence: "${userInput}" and return a valid JSON object like { "mood": "happy" }` }],
            response_format: "json", // Ensure GPT-4 returns valid JSON
        });

        // Parse mood safely
        let detectedMood = "neutral"; // Default mood
        if (response.choices?.length > 0) {
            try {
                const moodData = JSON.parse(response.choices[0].message.content);
                detectedMood = moodData?.mood?.toLowerCase() || "neutral";
            } catch (jsonError) {
                console.error("JSON Parsing Error:", jsonError);
            }
        }

        // Store mood tracking if userId is valid
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            await user.findByIdAndUpdate(userId, {
                $push: { moodTracking: { mood: detectedMood, date: new Date() } },
            });
        }

        res.json({
            mood: detectedMood,
            message: `You seem **${detectedMood}**. Need a song recommendation? 🎶`,
        });

    } catch (err) {
        console.error("Error analyzing mood:", err);
        res.status(500).json({ message: "Mood analysis failed. Please try again." });
    }
};


// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import MusicResource from "../models/MusicResource.js";
// import user from "../models/user.js";

// dotenv.config();

// // Initialize Gemini AI
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// export const analyzeMood = async (req, res) => {
//     try {
//         const { userId, userInput } = req.body;
//         if (!userInput) {
//             return res.status(400).json({ message: "Input required!" });
//         }

//         // Use Gemini for mood detection
//         const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
//         const prompt = `Analyze the emotional tone in this message and identify the primary mood. 
//         Return ONLY a single word representing the dominant mood (e.g., happy, sad, anxious, excited, etc.): "${userInput}"`;
        
//         const result = await model.generateContent(prompt);
//         const detectedMood = result.response.text().trim().toLowerCase();

//         // Store mood tracking if userId is valid
//         if (userId && mongoose.Types.ObjectId.isValid(userId)) {
//             await user.findByIdAndUpdate(userId, {
//                 $push: { moodTracking: { mood: detectedMood, date: new Date() } },
//             });
//         }

//         // Get a therapeutic message related to the mood
//         const therapeuticPrompt = `As a music therapy assistant, create a brief, supportive message (1-2 sentences) 
//         for someone feeling ${detectedMood}. Be empathetic and mention that music can help with this mood.`;
        
//         const therapyResult = await model.generateContent(therapeuticPrompt);
//         const therapyMessage = therapyResult.response.text().trim();

//         res.json({
//             mood: detectedMood,
//             message: therapyMessage,
//         });

//     } catch (err) {
//         console.error("Error analyzing mood:", err);
//         res.status(500).json({ message: "Mood analysis failed. Please try again." });
//     }
// };

// export const getMoodHistory = async (req, res) => {
//     try {
//         const { userId } = req.params;
        
//         if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//             return res.status(400).json({ message: "Valid user ID required" });
//         }
        
//         const user = await user.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: "user not found" });
//         }
        
//         // Get mood history with timestamps
//         const moodHistory = user.moodTracking || [];
        
//         res.json({
//             userId,
//             moodHistory: moodHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
//         });
        
//     } catch (err) {
//         console.error("Error fetching mood history:", err);
//         res.status(500).json({ message: "Failed to fetch mood history" });
//     }
// };

// export const getMoodTrends = async (req, res) => {
//     try {
//         const { userId } = req.params;
        
//         if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//             return res.status(400).json({ message: "Valid user ID required" });
//         }
        
//         const user = await user.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: "user not found" });
//         }
        
//         const moodHistory = user.moodTracking || [];
        
//         // Process mood data to get trends
//         const moodCounts = {};
//         const weeklyMoods = Array(7).fill(0).map(() => ({}));
        
//         const now = new Date();
        
//         moodHistory.forEach(entry => {
//             const mood = entry.mood.toLowerCase();
            
//             // Count overall moods
//             moodCounts[mood] = (moodCounts[mood] || 0) + 1;
            
//             // Get day of week (0-6, where 0 is Sunday)
//             const entryDate = new Date(entry.date);
//             const dayDiff = Math.floor((now - entryDate) / (24 * 60 * 60 * 1000));
            
//             if (dayDiff < 7) {
//                 const dayOfWeek = (now.getDay() - dayDiff + 7) % 7;
//                 weeklyMoods[dayOfWeek][mood] = (weeklyMoods[dayOfWeek][mood] || 0) + 1;
//             }
//         });
        
//         // Get top moods
//         const topMoods = Object.entries(moodCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 5)
//             .map(([mood, count]) => ({ mood, count }));
        
//         // Get weekly mood summary
//         const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
//         const weeklyMoodSummary = weeklyMoods.map((moods, index) => {
//             const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
//             return {
//                 day: dayNames[index],
//                 dominantMood: topMood ? topMood[0] : null,
//                 moodCount: topMood ? topMood[1] : 0
//             };
//         });
        
//         res.json({
//             userId,
//             topMoods,
//             weeklyMoodSummary,
//             totalMoodEntries: moodHistory.length
//         });
        
//     } catch (err) {
//         console.error("Error analyzing mood trends:", err);
//         res.status(500).json({ message: "Failed to analyze mood trends" });
//     }
// };

// export const getTherapyInsights = async (req, res) => {
//     try {
//         const { userId } = req.params;
        
//         if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//             return res.status(400).json({ message: "Valid user ID required" });
//         }
        
//         const user = await user.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: "user not found" });
//         }
        
//         const moodHistory = user.moodTracking || [];
        
//         // Get recent moods (last 10)
//         const recentMoods = moodHistory
//             .sort((a, b) => new Date(b.date) - new Date(a.date))
//             .slice(0, 10)
//             .map(entry => entry.mood);
        
//         if (recentMoods.length === 0) {
//             return res.json({
//                 userId,
//                 insights: "Not enough mood data to generate insights.",
//                 musicRecommendation: null
//             });
//         }
        
//         // Generate insights with Gemini
//         const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
//         const insightPrompt = `As a music therapy assistant, analyze these recent moods: ${recentMoods.join(', ')}. 
        
//         Provide a short paragraph (3-4 sentences) with therapeutic insights about these mood patterns, 
//         and suggest one specific music therapy approach that might be beneficial.`;
        
//         const insightResult = await model.generateContent(insightPrompt);
//         const insights = insightResult.response.text().trim();
        
//         // Get dominant mood
//         const moodFrequency = {};
//         recentMoods.forEach(mood => {
//             moodFrequency[mood] = (moodFrequency[mood] || 0) + 1;
//         });
        
//         const dominantMood = Object.entries(moodFrequency)
//             .sort((a, b) => b[1] - a[1])[0][0];
        
//         // Get music recommendation for dominant mood
//         const musicQuery = { mood: { $regex: new RegExp(dominantMood, 'i') } };
//         const recommendedMusic = await MusicResource.findOne(musicQuery);
        
//         let musicRecommendation = null;
//         if (recommendedMusic) {
//             musicRecommendation = {
//                 title: recommendedMusic.title,
//                 artist: recommendedMusic.artist,
//                 reason: `This song may help with your recent ${dominantMood} moods.`,
//                 spotifyUrl: recommendedMusic.spotifyUrl || null
//             };
//         }
        
//         res.json({
//             userId,
//             insights,
//             dominantMood,
//             musicRecommendation
//         });
        
//     } catch (err) {
//         console.error("Error generating therapy insights:", err);
//         res.status(500).json({ message: "Failed to generate therapy insights" });
//     }
// };