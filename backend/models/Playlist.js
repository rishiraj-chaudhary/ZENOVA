import crypto from 'crypto';
import mongoose from 'mongoose';
const playlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    collaborators:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }],
    inviteLink:{
        code:{
            type:String,
            default:()=> crypto.randomBytes(6).toString('hex')
        },
        expiresAt:{
            type:Date,
            default:()=> new Date(Date.now() + 7*24*60*60*1000)//7 days
        }
    },
    
    
    songs: [{
        musicId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MusicResource'
        },
        title: String,
        artist: String,
        audioUrl: String,
        spotifyUri:String ,
        albumArt:String ,
        genre: String,
        reason: String
    }]
}, { timestamps: true });

const Playlist = mongoose.model('Playlist', playlistSchema);
export default Playlist;