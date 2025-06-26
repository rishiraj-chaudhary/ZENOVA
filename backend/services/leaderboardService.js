import Gamification from "../models/Gamification.js";
import LeaderBoard from "../models/Leaderboard.js";

export const updateLeaderboard=async(type='alltime',period='all')=>{
    //Fetch all users anf their gamification stats
    const gamifications=await Gamification.find().populate('userId');
    //SORT--> descending , then be level then by streak
    const sorted=gamifications.sort((a,b)=> b.totalPoints-a.totalPoints || b.level - a.level || b.currentStreak - a.currentStreak).slice(0,100);//Top 100
     const entries = sorted.map((g,idx)=> ({
        userId: g.userId._id,
        username: g.userId.name,
        totalPoints: g.totalPoints,
        level: g.level,
        currentStreak: g.currentStreak,
        badgeCount: Array.isArray(g.badges) ? g.badges.length : 0,
        rank: idx + 1
     }));
     //Upsert leaderboard
     await LeaderBoard.findOneAndUpdate({type,period},{entries,lastUpdated:new Date()},{upsert: true,new : true});
}
export const getLeaderboard=async(type='alltime',period='all')=>{
    const leaderboard=await LeaderBoard.findOne({type,period});
    return leaderboard ? leaderboard.entries : [];
}
