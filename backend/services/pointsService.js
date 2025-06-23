
import { LEVELS, POINTS } from '../config/gamification.js';
import Gamification from "../models/Gamification.js";
import { updateLeaderboard } from './leaderboardService.js';
export const calculateLevel=(totalPoints)=>{
    let level=1;
    for(const levelData of LEVELS){
        if(totalPoints >= levelData.minPoints){
            level=levelData.level;
        }
    }
    return level;
}
export const awardPoints=async(userId,action,socketManager,metadata={})=>{
    console.log(`awardPoints called for user ${userId} and action ${action}`);
    try{
        const points=POINTS[action.toUpperCase()] || 0;
        let userGamification=await Gamification.findOne({userId});
        if(!userGamification){
            userGamification=new Gamification({userId});
        }
        //Add points 
        userGamification.totalPoints+=points;
        console.log('5 points for login');
        //Check level up
        const newLevel=calculateLevel(userGamification.totalPoints);
        const leveledUp=newLevel > userGamification.level;
        userGamification.level=newLevel;
        //Update tracking counters based on action
        switch(action.toUpperCase()){
            case 'PLAYLIST_SHARED':
                userGamification.playlistsShared = (userGamification.playlistsShared || 0) + 1;
                break;
            case 'DAILY_LOGIN':
                userGamification.dailyLogins = (userGamification.dailyLogins || 0) + 1;
                break;
            case 'PLAYLIST_CREATED':
                userGamification.playlistsCreated = (userGamification.playlistsCreated || 0) + 1;
                break;
            case 'SONG_ADDED':
                userGamification.songsAdded = (userGamification.songsAdded || 0) + 1;
                break;
        }

        //Update last activity for streak tracking
        // userGamification.lastActivity=new Date();
        await userGamification.save();
        //Real time update via websockets
        if(socketManager && socketManager.emitToUser){
            console.log('Emitting points_awarded for', userId);
            socketManager.emitToUser(userId,'points_awarded',{
                points,
                action,
                totalPoints: userGamification.totalPoints,
                level: userGamification.level,
                leveledUp
            })
        }

        if (leveledUp) {
        console.log('Emitting level_up for', userId);
        socketManager.emitToUser(userId, 'level_up', {
            
            level: userGamification.level,
            totalPoints: userGamification.totalPoints
        });
        }
        await updateLeaderboard('alltime','all');
        return {points,totalPoints:userGamification.totalPoints,leveledUp};
    }catch(err){
        console.error('Error awarding points:', err);
        throw err;
    }
}
//Update user streak based on daily activity
export const updateStreak=async(userId,socketManager)=>{
    console.log(`updateStreak called for user ${userId}`);
    try{
        let userGamification=await Gamification.findOne({userId});
        if(!userGamification){
            userGamification=new Gamification({userId});
        }
        const now=new Date();
        const lastActivity=new Date(userGamification.lastActivity);
        const timeDiff=now.getTime()-lastActivity.getTime();
        const daysDiff=Math.floor(timeDiff / (1000*3600*24));
        if(!lastActivity || userGamification.currentStreak===0){
            //First ever login or streak is reset
            userGamification.currentStreak=1;
            userGamification.longestStreak=Math.max(userGamification.longestStreak || 0,1);
        }else if(daysDiff===1){
            //consecutive day--> increment the streak
            userGamification.currentStreak+=1;
            if(userGamification.currentStreak>userGamification.longestStreak){
                userGamification.longestStreak=userGamification.currentStreak;
            }
        }else if(daysDiff > 1){
            //Streak is broken
            userGamification.currentStreak=1;
        }
        //daysDiff==0 ==> no change as it is the same day
        userGamification.lastActivity=now;
        await userGamification.save();
        //Emit streak update
        if(socketManager && socketManager.emitToUser){
            console.log('Emitting streak_updated for', userId);
            socketManager.emitToUser(userId,'streak_updated',{
                currentStreak:userGamification.currentStreak,
                longestStreak:userGamification.longestStreak
            });
        }
        return userGamification.currentStreak;
    }catch(err){
        console.error('Error updating streak:', err);
        throw err;
    }
}