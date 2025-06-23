import { Badge, UserBadge } from '../models/Badge.js';
import Gamification from '../models/Gamification.js';
import Playlist from '../models/Playlist.js';

 //Check badge requirements
export const checkBadgeRequirement=async(userId,badge,userGamification)=>{
    const {type,value}=badge.requirement;
    switch(type){
        case 'playlist_count' :
            const playlistCount = await Playlist.countDocuments({userId});
            return playlistCount>=value;
        case 'streak_days':
            return userGamification.currentStreak>=value;
        case 'playlists_shared':
            return userGamification.playlistsShared >= value;
        case 'daily_logins':
            return userGamification.dailyLogins >= value;
        default: 
            console.warn(`Unknown badge requirement type : ${type}`);
            return false;
    }
}
export const awardBadge=async(userId,badgeId,socketManager)=>{
    try{
        const existingUserBadge=await UserBadge.findOne({userId,badgeId});
        if(existingUserBadge){
            return false;//user already has this badge 
        }
        //Create new userBadge record
        const userBadge=new UserBadge({
            userId,
            badgeId
        });
        await userBadge.save();
        //Update user's gamification
        const userGamification=await Gamification.findOne({userId});
        if(userGamification){
            userGamification.badges.push(badgeId);
            await userGamification.save();
        }
        //Get badge details
        const badge=await Badge.findById(badgeId);
        //Real time notification
        if(socketManager && socketManager.emitToUser){
            socketManager.emitToUser(userId,'badge_earned',{
                badge:{
                    id: badge._id,
                    name: badge.name,
                    description: badge.description,
                    rarity: badge.rarity,
                    icon: badge.icon,
                    category: badge.category
                },
                earnedAt:userBadge.earnedAt
            });
        }
        console.log(`Badge "${badge.name}" awarded to user ${userId}`);
        return true;
    }catch(err){
        console.error('Error awarding badge:', err);
        throw err;
    }
}
export const checkAndAwardBadges=async(userId,socketManager)=>{
    try{
        const userGamification=await Gamification.findOne({userId});
        if(!userGamification){
            console.log(`No gamification record found for user ${userId}`);
            return 0;
        }
        //Get all active badges
        const allBadges=await Badge.find({isActive : true});
        //Get badges user already has
        const userBadges=await UserBadge.find({userId});
        const earnedBadgeIds=userBadges.map(ub=> ub.badgeId.toString());
        let newBadgesAwarded=0;
        for(const badge of allBadges){
            //Skip if user already has this badge
            if(earnedBadgeIds.includes(badge._id.toString())){
                continue;
            }
            //Check if user meets requirements
            const meetsRequirement=await checkBadgeRequirement(userId,badge,userGamification);
            if(meetsRequirement){
                const awarded=await awardBadge(userId,badge._id,socketManager);
                if(awarded){
                    newBadgesAwarded++;
                }
            }
        }
        return newBadgesAwarded;
    }catch(err){
        console.error('Error checking badges:', err);
        throw err;
    }
}
//Get user badges
export const getUserBadges=async(userId)=>{
    try{
        const userBadges=await UserBadge.find({userId}).populate('badgeId').sort({earnedAt : -1});
        return userBadges.map(userBadge => ({
            ...userBadge.badgeId.toObject(),
            earnedAt: userBadge.earnedAt,
            isDisplayed: userBadge.isDisplayed
        }));
    }catch(err){
        console.error('Error getting user badges:', err);
        throw err;
    }
}
//Initialize default badges in the db
export const initializeDefaultBadges=async()=>{
    try{
        const {BADGES} =await import ('../config/gamification.js');
        for(const badgeData of BADGES){
            const existingBadge=await Badge.findOne({name: badgeData.name});
            if(!existingBadge){
                const badge=new Badge({
                    ...badgeData,
                    icon: badgeData.icon || '/icons/badge-default.svg',
                    pointsReward: badgeData.pointsReward || 0,
                    isActive: true
                });
                await badge.save();
                console.log(`Created badge: ${badge.name}`);
            }
        }
    }catch(err){
        console.error('Error initializing badges:', err);
    }
}