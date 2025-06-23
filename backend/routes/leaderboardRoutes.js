import express from 'express';
import { fetchLeaderBoard } from '../controllers/leaderboardController.js';
const router=express.Router();

router.get('/',fetchLeaderBoard);
export default router;