import mongoose from 'mongoose';

const challengeSchema=new mongoose.Schema({
    title:{
        type:String,
        required:true
    },
    decription:String,
    type:{
        type:String,
        enum:['weekly', 'monthly', 'custom'],
        default:'weekly'
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    goalType: { 
        type: String, 
        required: true 
    }, // e.g., 'points', 'playlists_created', 'songs_added'
    goalValue: { 
        type: Number, 
        required: true 
    },
    reward: { 
        type: String 
    }, // e.g., 'badge', 'points', 'trophy'
    isActive: { 
        type: Boolean, 
        default: true
    }
},{
    timestamps:true
});
