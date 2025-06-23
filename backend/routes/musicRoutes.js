// import express from 'express';
// import { getMusicRecommendations, getSpotifyEmbed } from '../controllers/musicController.js';
// const router=express.Router();
// router.post('/',getMusicRecommendations);
// router.get('/spotify/embed/:trackId', getSpotifyEmbed);
// export default router;

import express from 'express';
import {
    getMusicRecommendations,
    getSpotifyAuthUrl,
    getSpotifyEmbed,
    handleSpotifyCallback
} from '../controllers/musicController.js';

const router = express.Router();

// Music recommendation routes
router.post('/recommendations', getMusicRecommendations);
router.get('/spotify/embed/:trackId', getSpotifyEmbed);
router.get('/spotify/auth',getSpotifyAuthUrl);
router.get('/spotify/callback',handleSpotifyCallback);
export default router;