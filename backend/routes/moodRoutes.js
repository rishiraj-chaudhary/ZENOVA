import express from 'express';
import { analyzeMood } from '../controllers/moodController.js';
const router=express.Router();
router.post('/analyze-mood',analyzeMood);
export default router;