const checkSession=(req,res,next)=>{
    if(req.session.user){
        next();//pass the control to the next middleware or route handler
    }else{
        res.status(401).json({message:'Unauthorized'});
    }
}
export default checkSession;