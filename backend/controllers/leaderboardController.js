import { getLeaderboard } from "../services/leaderboardService.js";

export const fetchLeaderBoard=async(req,res)=>{
    try{
        const {type='alltime',period='all'}=req.query;
        const entries=await getLeaderboard(type,period);
        res.json({entries});
    }catch(err){
        res.status(500).json({ message: 'Error fetching leaderboard', error: err.message });
    }
}