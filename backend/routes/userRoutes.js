import express from 'express';
import { analyzeMood } from '../controllers/moodController.js';
import { getUserProfile, updatePreferences } from '../controllers/userController.js';
import protect from '../middlewares/authMiddleware.js';
const router=express.Router();
router.get('/profile',protect,getUserProfile);
router.put('/preferences',protect,updatePreferences);
router.post('/analyze-mood',analyzeMood);
export default router;