import express from 'express';
import { acceptInvitation, addSongToPlaylist, createPlaylist, createPlaylistFromVoice, deletePlaylist, generateInviteLink, generateInviteQR, getCollaborators, getUserPlaylists, inviteByUsername, removeCollaborator, removeSongFromPlaylist } from '../controllers/playlistController.js';
import protect from '../middlewares/authMiddleware.js';
import { trackAction } from '../middlewares/gamificationMiddleware.js';
const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

router.post('/create',trackAction('PLAYLIST_CREATED'),createPlaylist);
router.post('/addsong',trackAction('SONG_ADDED'),addSongToPlaylist);
router.post('/removesong',removeSongFromPlaylist);
router.delete('/delete/:playlistId', deletePlaylist);
// router.get('/:userId', getUserPlaylists);
// New route for voice playlist creation
router.post('/create-from-voice',trackAction('PLAYLIST_CREATED'), createPlaylistFromVoice);
router.get('/my-playlists', getUserPlaylists); // Changed from '/:userId' to '/my-playlists'
//Collaboration routes
router.post('/invite/username',trackAction('PLAYLIST_SHARED'),inviteByUsername);
router.post('/invite/link/:playlistId', trackAction('PLAYLIST_SHARED'),generateInviteLink);
router.post('/invite/qr/:playlistId',trackAction('PLAYLIST_SHARED'),generateInviteQR);
router.get('/invite/accept/:inviteCode', acceptInvitation);
router.get('/:playlistId/collaborators', getCollaborators);
router.delete('/:playlistId/collaborators/:userId', removeCollaborator);
export default router;