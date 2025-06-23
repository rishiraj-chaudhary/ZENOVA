import user from '../models/user.js';
export const getUserProfile=async(req,res)=>{
    try{
        const Newuser=await user.findById(req.user.id).select('-password'); //Extracts user ID from the JWT Token (Authentication)
        if(!Newuser){
            res.status(500).json({message:'user not found'});
        }
        res.json(Newuser);
    }catch(err){
        res.status(500).json({message:'Server error',err});
    }
}
export const updatePreferences=async(req,res)=>{
    try{
        const Newuser=await user.findById(req.user.id);// Extracts user ID from the JWT Token (Authentication)
        if(!Newuser){
            res.status(500).json({message:'user not found'});
        }
        Newuser.preferences=req.body.preferences||Newuser.preferences;
        await Newuser.save();
        res.json({message:'user saved successfully',preferences:Newuser.preferences});
    }catch(err){
        res.status(500).json({message:'Server error',err});
    }
}

