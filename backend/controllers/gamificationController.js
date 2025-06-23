import { UserBadge } from '../models/Badge.js';
import Gamification from '../models/Gamification.js';
import { checkAndAwardBadges } from '../services/badgeService.js';
import { awardPoints } from '../services/pointsService.js';

export const getUserStats=async(req,res)=>{
    try{
        const {userId}=req.params;
        const gamification=await Gamification.findOne({userId});
        const badges=await UserBadge.find({userId}).populate('badgeId');
        res.json({
            points: gamification?.totalPoints || 0,
            level: gamification?.level || 1,
            streak: gamification?.currentStreak || 0,
            playlistsShared: gamification?.playlistsShared || 0,
            dailyLogins: gamification?.dailyLogins || 0,
            badges: badges.map(ub => ub.badgeId)
        });
    }catch(err){
        res.status(500).json({ error: err.message }); 
    }
}

export const awardPointsController = async(req,res)=>{
    try{
        const {userId,action}=req.body;
        const socketManager=req.socketManager;
        const result=await awardPoints(userId,action,socketManager);
        await checkAndAwardBadges(userId,socketManager);
        res.json(result);
    }catch(err){
        res.status(500).json({ error: err.message });
    }
}