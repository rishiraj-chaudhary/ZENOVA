import express from 'express';
import { awardPointsController, getUserStats } from '../controllers/gamificationController.js';
import protect from '../middlewares/authMiddleware.js';
const router=express.Router();

router.get('/stats/:userId',protect,getUserStats);
router.post('award-points',protect,awardPointsController);
export default router;