import express from 'express';
import { analyzeMood, chatWithAI } from '../controllers/geminiController.js';

const router = express.Router();

router.post('/analyze-mood', analyzeMood);
router.post('/chat', chatWithAI);

export default router;