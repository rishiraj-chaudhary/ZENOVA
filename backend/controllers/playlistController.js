import crypto from 'crypto';
import QRCode from 'qrcode';
import MusicResource from "../models/MusicResource.js";
import Playlist from "../models/Playlist.js";
import User from '../models/user.js';
// export const createPlaylist = async (req, res) => {
//     try {
//         const userId = req.user._id;
//         const { name } = req.body;
      
//       // Convert userId string to MongoDB ObjectId
//       const userObjectId = new mongoose.Types.ObjectId(userId);
      
//       const newPlaylist = new Playlist({ 
//         userId: userObjectId, 
//         name, 
//         songs: [] 
//       });
      
//       await newPlaylist.save();
//       res.status(201).json(newPlaylist);
//     } catch (err) {
//       console.error("Error creating playlist:", err);
//       res.status(500).json({ message: 'Error creating playlist', error: err.message });
//     }
//   };

//INVITE BY USERNAME
export const inviteByUsername=async(req,res)=>{
    try{
        const ownerId=req.user._id;
        const {playlistId,username}=req.body;
        //Find the playlist and verify ownership
        const playlist=await Playlist.findOne({_id:playlistId,userId:ownerId});
        if(!playlist){
            return res.status(404).json({message: 'Playlist not found or you do not have permission'});
        }
        //Find user to invite
        const userToInvite=await User.findOne({name: username});
        if(!userToInvite){
            return res.status(404).json({ message: "User not found" });
        }
        //Check if user is already a collaborator
        if(playlist.collaborators && playlist.collaborators.some(id=> id.toString()===userToInvite._id.toString())){
            return res.status(400).json({ message: "User is already a collaborator" });
        }
        //Add user as a collaborator
        if(!playlist.collaborators){
            playlist.collaborators=[];
        }
        playlist.collaborators.push(userToInvite._id);
        await playlist.save();

        if(req.io){
            //Notify all users in the room about the new collaborator
            req.io.to(`playlist:${playlistId}`).emit('collaborator_added',{
                playlistId,
                collaborator:{
                    userId:userToInvite._id,
                    username: userToInvite.name
                },
                addedBy:{
                    userId:ownerId,
                    username:req.user.name
                }
            });
              // Notify the invited user directly
            req.io.to(`user:${userToInvite._id}`).emit('collaborator_added', {
                playlistId,
                collaborator: {
                    userId: userToInvite._id,
                    username: userToInvite.name
                },
                addedBy: {
                    userId: ownerId,
                    username: req.user.name
                }
            });
        }
        res.status(200).json({ 
            message: "Collaborator added successfully", 
            collaborator: {
                _id: userToInvite._id,
                name: userToInvite.name
            }
        });
    }catch(err){
        console.error("Error inviting collaborator:", err);
        res.status(500).json({ message: 'Error inviting collaborator', error: err.message });
    }
}

//Generate or refresh invite link
export const generateInviteLink=async(req,res)=>{
    try{
        const ownerId=req.user._id;
        const {playlistId}=req.params;
        // Find the playlist and verify ownership
        const playlist = await Playlist.findOne({ _id: playlistId, userId: ownerId });
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found or you don't have permission" });
        }
        //Generate new invite link
        const inviteCode=crypto.randomBytes(6).toString('hex');
        playlist.inviteLink={
            code:inviteCode,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
        }
        await playlist.save();
        //Generate full invite URL
        const baseUrl='http://localhost:5173' || process.env.FRONTEND_URL ;
        const inviteUrl=`${baseUrl}/invite/${inviteCode}`;
        res.status(200).json({ 
            message: "Invite link generated successfully",
            inviteLink: inviteUrl,
            expiresAt: playlist.inviteLink.expiresAt
        });
    }catch(err){
        console.error("Error generating invite link:", err);
        res.status(500).json({ message: 'Error generating invite link', error: err.message });
    }
}

//Generate QRCode for invitation
export const generateInviteQR=async(req,res)=>{
    try{
        const ownerId = req.user._id;
        const { playlistId } = req.params;
        
        // Find the playlist and verify ownership
        const playlist = await Playlist.findOne({ _id: playlistId, userId: ownerId });
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found or you don't have permission" });
        }
        //Generate or use existing invite code
        let inviteCode=playlist.inviteLink?.code;
        if(!inviteCode){
            inviteCode = crypto.randomBytes(6).toString('hex');
            playlist.inviteLink = {
                code: inviteCode,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            };
            await playlist.save();
        }
        //Generate full invite URL
        const baseUrl=process.env.FRONTEND_URL || 'http://localhost:5173';
        const inviteUrl = `${baseUrl}/invite/${inviteCode}`;
        const qrCodeDataURL=await QRCode.toDataURL(inviteUrl);
        res.status(200).json({ 
            message: "QR code generated successfully",
            inviteLink: inviteUrl,
            qrCode: qrCodeDataURL,
            expiresAt: playlist.inviteLink.expiresAt
        });

    }catch(err){
        console.error("Error generating QR code:", err);
        res.status(500).json({ message: 'Error generating QR code', error: err.message });
    }
}
//Accept invitation by code
export const acceptInvitation=async(req,res)=>{
    try{
        const userId=req.user._id;
        const {inviteCode}=req.params;
        //Find playlist with matching invitation and valid expiration 
        const playlist=await Playlist.findOne({'inviteLink.code':inviteCode,
            'inviteLink.expiresAt':{$gt: new Date()}
        });
        if(!playlist){
            return res.status(404).json({ message: "Invalid or expired invitation link" });
        }
        // Check if user is already a collaborator
        if (playlist.collaborators && playlist.collaborators.some(id => id.toString() === userId.toString())) {
            return res.status(200).json({ message: "You are already a collaborator on this playlist", playlistId: playlist._id });
        }
        // Add user to collaborators
        if (!playlist.collaborators) {
            playlist.collaborators = [];
        }
        
        playlist.collaborators.push(userId);
        await playlist.save();

        //Get user info for socket event
        const user=await User.findById(userId);
        //Emit socket event if socket is available
        if(req.io){
            //Join the user to the socket room
            req.io.to(`playlist:${playlist._id}`).emit('user_joined',{
                userId:userId,username:user.name,
                joinedVia:'invitation'
            });
        }
        
        res.status(200).json({ 
            message: "Successfully joined playlist as collaborator",
            playlistId: playlist._id
        });
        
    }catch(err){
        console.error("Error accepting invitation:", err);
        res.status(500).json({ message: 'Error accepting invitation', error: err.message });
    }
}

//Get all collaborators for a playlist
export const getCollaborators=async(req,res)=>{
    try{
        const userId=req.user._id;
        const {playlistId}=req.params;
        const playlist=await Playlist.findOne({
            _id:playlistId,
            $or:[{ userId:userId},
                {collaborators: userId}
            ]
        }).populate('collaborators','name email');
        if(!playlist){
            return res.status(404).json({message:"Playlist not found or you don't have access"});
        }
        res.status(200).json({ collaborators: playlist.collaborators || [] });
    }catch(err){
        console.error("Error getting collaborators:", err);
        res.status(500).json({ message: 'Error getting collaborators', error: err.message });
    }
}

//Remove collaborators function
export const removeCollaborator=async(req,res)=>{
    try{
        const ownerId=req.user._id;
        const {playlistId,userId}=req.params;
        //Find the playlist and verify ownership
        const playlist = await Playlist.findOne({ _id: playlistId, userId: ownerId });
        if(!playlist){
            return res.status(404).json({message:"Playlist not found or you don't have permission"});
        }

        //Get collaborator info before removing
        const collaborator=await User.findById(userId);
        if(!collaborator){
            return res.status(404).json({message: 'Collaborator not found'});
        }
        //Removing user from collaborator
        if(!playlist.collaborators || !playlist.collaborators.some(id=> id.toString() === userId.toString())){
            return res.status(400).json({ message: "User is not a collaborator on this playlist" });
        }

        //Remove user from collaborators
        playlist.collaborators=playlist.collaborators.filter(id=>id.toString() !==userId.toString());
        await playlist.save();

        //Emit socket event if socket is available
        if(req.io){
            req.io.to(`playlist:${playlistId}`).emit('collaborator_removed',{
                playlistId,
                removedCollaborator: {
                    userId: collaborator._id,
                    username: collaborator.name
                },
                removedBy: {
                    userId: ownerId,
                    username: req.user.name
                }
            });
        }
        //Notify the removed user personally 
        req.io.to(`user:${collaborator._id}`).emit('collaborator_removed',{
                playlistId,
                removedCollaborator: {
                    userId: collaborator._id,
                    username: collaborator.name
                },
                removedBy: {
                    userId: ownerId,
                    username: req.user.name
                }
            });
        res.status(200).json({ message: "Collaborator removed successfully" });
    }catch(err){
        console.log('Error removing collaborator',err);
        res.status(500).json({message:'Error removing collaborator',error:err.message});
    }
}

export const addSongToPlaylist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { playlistId, songId } = req.body;
        const song = await MusicResource.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }
        // const playlist = await Playlist.findById(playlistId);
        // First check if playlist belongs to user of if the user is a collaborator
        const playlist = await Playlist.findOne({ 
            _id: playlistId,
            $or:[{userId: userId},
                {collaborators:userId}
            ]
        });
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        const existingSong = playlist.songs.find(playlistSong => 
            playlistSong.musicId.toString() === songId.toString()
        );
        
        if (existingSong) {
            return res.status(409).json({ 
                message: 'Song already exists in this playlist',
                type: 'duplicate_song',
                songTitle: song.title,
                artist: song.artist,
                playlistName: playlist.name
            });
        }

        playlist.songs.push({
            musicId: song._id,
            title: song.title,
            artist: song.artist,
            audioUrl: song.audioUrl,
            genre: song.genre,
            spotifyUri: song.spotifyUri, // <-- Critical addition
            albumArt: song.albumArt,     // <-- Critical addition
            reason: 'Added by user'
        });
        await playlist.save();

        //Emit socket event if socket is available
        if(req.io){
            req.io.to(`playlist:${playlistId}`).emit('song_added',{
                playlistId,
                song:{
                    musicId: song._id,
                    title:song.title,
                    artist:song.artist
                },
                addedBy:{
                    userId,
                    username:req.user.name
                }
            });
        }
        console.log('PLAYLIST SONGS:',playlist.songs);
        res.status(200).json(playlist);
    } catch (err) {
        res.status(500).json({ message: 'Error adding song to playlist', err });
    }
};

// export const removeSongFromPlaylist = async (req, res) => {
//     try {
//         console.log('BACKEND');
//         const { musicId } = req.body;
//         const { playlistId } = req.body;
//         const playlist = await Playlist.findById(playlistId);
//         if (!playlist) {
//             return res.status(404).json({ message: "Playlist not found" });
//         }
//         playlist.songs = playlist.songs.filter(song => song.musicId.toString() !== musicId);
//         console.log('Song deleted');
//         await playlist.save();
//         res.status(200).json({ message: "Song removed successfully" });
//     } catch (err) {
//         res.status(500).json({ message: 'Error removing song from playlist', err });
//     }
// };
export const removeSongFromPlaylist = async (req, res) => {
    try {
        console.log('BACKEND');
        const userId = req.user._id;
        const { musicId, playlistId } = req.body;
        
       // Check if user is owner or collaborator
        const playlist = await Playlist.findOne({ 
            _id: playlistId,
            $or: [
                { userId: userId },
                { collaborators: userId }
            ]
        });
        
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found or you don't have permission" });
        }
        
        playlist.songs = playlist.songs.filter(song => song.musicId.toString() !== musicId);
        console.log('Song deleted');
        await playlist.save();

        //Emit socket event if socket is available
        if(req.io){
            req.io.to(`playlist:${playlistId}`).emit('song_removed',{
                playlistId,
                songId:musicId,
                removedBy:{
                    userId,
                    username: req.user.name
                }
            });
        }
        res.status(200).json({ message: "Song removed successfully" });
    } catch (err) {
        res.status(500).json({ message: 'Error removing song from playlist', err });
    }
};


// export const deletePlaylist = async (req, res) => {
//     try {
//         const { playlistId } = req.params;
//         await Playlist.findByIdAndDelete(playlistId);
//         res.status(200).json({ message: "Playlist deleted successfully" });
//     } catch (err) {
//         res.status(500).json({ message: 'Error deleting playlist', err });
//     }
// };
export const deletePlaylist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { playlistId } = req.params;
        
        // Find the playlist and verify ownership
        const playlist = await Playlist.findOne({ 
            _id: playlistId,
            userId: userId
        });
        
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found or you don't have permission" });
        }
        
        await Playlist.findByIdAndDelete(playlistId);
        res.status(200).json({ message: "Playlist deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting playlist', error: err.message });
    }
};


// export const getUserPlaylists = async (req, res) => {
//     try {
//       const { userId } = req.params;
//        // Validate userId format
//        if (!userId || typeof userId !== 'string' || userId.length !== 24) {
//         return res.status(400).json({ message: 'Invalid userId format' });
//     }
      
//       // Convert userId string to MongoDB ObjectId
//       const userObjectId = new mongoose.Types.ObjectId(userId);
      
//       const playlists = await Playlist.find({ userId: userObjectId });
//       res.status(200).json(playlists);
//     } catch (err) {
//       console.error("Error fetching playlists:", err);
//       res.status(500).json({ message: 'Error fetching playlists', error: err.message });
//     }
//   };
export const createPlaylist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name } = req.body;
        
        console.log("Creating playlist for user:", userId);
        
        const newPlaylist = new Playlist({ 
            userId: userId, 
            name, 
            songs: [] 
        });
        
        await newPlaylist.save();
        console.log("Created new playlist:", newPlaylist);
        
        res.status(201).json(newPlaylist);
    } catch (err) {
        console.error("Error creating playlist:", err);
        res.status(500).json({ message: 'Error creating playlist', error: err.message });
    }
};

// export const getUserPlaylists = async (req, res) => {
//     try {
//         const userId = req.user._id;
//         // Log the exact format of the userId
//         console.log("Getting playlists for user (raw):", userId);
//         console.log("User ID type:", typeof userId);
        
//         // If userId is a string, convert it to ObjectId
//         // const userIdObj = typeof userId === 'string' 
//         //     ? new mongoose.Types.ObjectId(userId) 
//         //     : userId;
            
//         // console.log("User ID after conversion:", userIdObj);
        
//         const playlists = await Playlist.find({ userId: userId });
        
//         // Log each playlist's userId for debugging
//         // playlists.forEach(playlist => {
//         //     console.log(`Playlist ${playlist._id} belongs to user ${playlist.userId}`);
//         // });
        
//         res.status(200).json(playlists);
//     } catch (err) {
//         console.error("Error fetching playlists:", err);
//         res.status(500).json({ message: 'Error fetching playlists', error: err.message });
//     }
// };
export const getUserPlaylists = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log("Getting playlists for user:", userId);
        
        //Find the playlists where the user is the owner or the collaborator
        const playlists=await Playlist.find({ $or:[
            {userId:userId},
            {collaborators:userId}
        ]});
        //Add a property to denote whether the user is a collaborator or the owner of the playlist
        const enhancedPlaylists=playlists.map(playlist=>{
            const isOwner=playlist.userId.toString()===userId.toString();
            return {
                ...playlist.toObject(),
                isOwner,
                isCollaborator: !isOwner
            }
        });
        res.status(200).json(enhancedPlaylists);
    } catch (err) {
        console.error("Error fetching playlists:", err);
        res.status(500).json({ message: 'Error fetching playlists', error: err.message });
    }
};



// Add this new function to your existing controller
export const createPlaylistFromVoice = async (req, res) => {
    try {
        const userId = req.user._id;
        const { command ,conversationHistory = []} = req.body;
        
        if (!command || typeof command !== 'string') {
            return res.status(400).json({ 
                message: 'Invalid voice command provided' 
            });
        }
        
        console.log(`Processing voice command: "${command}" for user:`, userId);
        
        // Extract playlist name from command
        let playlistName = '';
        let playlistType = null;
        
        // Common playlist types to detect
        const playlistTypes = {
            workout: ['workout', 'exercise', 'fitness', 'gym'],
            relaxation: ['relax', 'calm', 'chill', 'meditation', 'sleep'],
            focus: ['focus', 'study', 'concentration', 'work'],
            party: ['party', 'celebration', 'dance'],
            travel: ['travel', 'road trip', 'journey', 'vacation'],
            mood: ['happy', 'sad', 'energetic', 'motivated']
        };
        
        // Pattern matching for common phrases
        if (command.match(/create (?:a |an )?(new )?playlist (called|named|for|titled) (.*)/i)) {
            playlistName = command.match(/create (?:a |an )?(new )?playlist (called|named|for|titled) (.*)/i)[3];
        } 
        else if (command.match(/make (?:a |an )?(new )?playlist (called|named|for|titled) (.*)/i)) {
            playlistName = command.match(/make (?:a |an )?(new )?playlist (called|named|for|titled) (.*)/i)[3];
        }
        else if (command.match(/create (?:a |an )?(new )?(.*) playlist/i)) {
            playlistName = command.match(/create (?:a |an )?(new )?(.*) playlist/i)[2] + " playlist";
        }
        else if (command.match(/make (?:a |an )?(new )?(.*) playlist/i)) {
            playlistName = command.match(/make (?:a |an )?(new )?(.*) playlist/i)[2] + " playlist";
        }
        else {
            // Default case - use the whole command as a name
            playlistName = command.trim();
        }
        
        // Clean up playlist name
        playlistName = playlistName
            .replace(/[.!?]$/, '')  // Remove ending punctuation
            .trim();
            
        // If playlist name is too short, prefix it with "My"
        if (playlistName.length < 3) {
            playlistName = "My Playlist";
        }
        
        // Detect playlist type based on keywords
        const commandLower = command.toLowerCase();
        for (const [type, keywords] of Object.entries(playlistTypes)) {
            if (keywords.some(keyword => commandLower.includes(keyword))) {
                playlistType = type;
                break;
            }
        }
         // Prepare the payload for the recommendations endpoint
         const recommendationPayload = {
            userId: userId.toString(),
            message: command, // Use the voice command as the message
            conversationHistory // Include conversation history for context
        };
        
        console.log('Calling recommendations API with:', recommendationPayload);
        
        // 1. Get recommendations from chatbot endpoint
        const recommendationResponse = await fetch('http://localhost:3000/api/music/recommend/recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization
            },
            body: JSON.stringify(recommendationPayload)
        });
        
        if (!recommendationResponse.ok) {
            const errorData = await recommendationResponse.text();
            console.error('Recommendation API error:', errorData);
            throw new Error(`Failed to get recommendations: ${recommendationResponse.status} ${recommendationResponse.statusText}`);
        }
        
        // Parse the recommendation response
        const responseData = await recommendationResponse.json();
        console.log('Recommendation API response:', JSON.stringify(responseData, null, 2));
        
        // Extract songs from the response
        let songs = [];
        if (responseData.recommendations) {
            songs = responseData.recommendations;
            console.log('Found songs in recommendations:', songs.length);
        } else if (responseData.songs) {
            songs = responseData.songs;
            console.log('Found songs directly:', songs.length);
        } else {
            console.error('No songs found in API response. Response structure:', Object.keys(responseData));
            throw new Error('No songs found in recommendation response');
        }
        
        if (!Array.isArray(songs) || songs.length === 0) {
            throw new Error('No song recommendations available');
        }
        
        // 2. Create playlist with recommended songs
        const newPlaylist = new Playlist({
            userId: userId,
            name: playlistName,
            type: playlistType,
            songs: songs.map(song => ({
                musicId: song.musicId || song.id || `song-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                title: song.title,
                artist: song.artist,
                spotifyUri: song.spotifyUri || song.uri || song.spotifyUrl,
                albumArt: song.albumArt,
                genre: song.genre || 'Various',
                reason: song.reason || 'Voice recommendation'
            })),
            createdBy: 'voice',
            moodContext: responseData.detectedMood || null
        });
        
        await newPlaylist.save();
        
        
        console.log("Created new playlist from voice command:", newPlaylist);
        
        res.status(201).json({
            message: "Playlist created successfully from voice command",
            playlist: newPlaylist
        });
    } catch (err) {
        console.error("Error creating playlist from voice:", err);
        res.status(500).json({ 
            message: 'Error creating playlist from voice command', 
            error: err.message 
        });
    }
};
