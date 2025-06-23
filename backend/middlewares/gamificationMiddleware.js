
//Middleware to test user actions and award points and badges
// const trackAction=(action)=>{
    //     return async(req,res,next)=>{
        //         //Store original res.json and res.send methods
        //         let pointsAwarded = false;
        //         const originalJson=res.json;
        //         const originalSend=res.send;
        
        //         //Run middleware by overriding res.json
        //         res.json=function(data){
            //             //Only award points if original action is successful
            //             if(res.statusCode>=200 && res.statusCode<=300 && req.user?.id){
                //                 //Award points asynchronously
                //                 setImmediate(async ()=>{
                    //                     try{
                        //                         await awardPoints(req.user.id,action,req.socketManager);
                        //                         console.log('sent points request from middleare to service');
                        //                         await checkAndAwardBadges(req.user.id,req.socketManager);
                        //                     }catch(err){
                            //                         console.error('Gamification error:', err);
                            //                     }
                            //                 });
                            //             }
                            //             return originalJson.call(this,data);
                            //         };
                            //         res.send=function(data){
                                //              if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
                                    //                 setImmediate(async () => {
                                        //                 try {
                                            //                     await awardPoints(req.user.id, action, req.socketManager);
                                            //                     await checkAndAwardBadges(req.user.id, req.socketManager);
                                            //                 } catch (error) {
                                                //                     console.error('Gamification error:', error);
                                                //                 }
                                                //                 });
                                                //             }
                                                //             return originalSend.call(this, data);
                                                //         };
                                                //         next();
                                                //     };
                                                // }
                                                
import { checkAndAwardBadges } from "../services/badgeService.js";
import { awardPoints, updateStreak } from "../services/pointsService.js";
        const trackAction = (action) => {
            return async (req, res, next) => {
        let pointsAwarded = false; // <-- Add this flag
        const originalJson = res.json;
        const originalSend = res.send;

        function awardIfNeeded(data) {
            if (!pointsAwarded && res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
                pointsAwarded = true;
                setImmediate(async () => {
                    try {
                        await awardPoints(req.user.id, action, req.socketManager);
                        
                        await checkAndAwardBadges(req.user.id, req.socketManager);

                    } catch (err) {
                        console.error('Gamification error:', err);
                    }
                });
            }
        }

        res.json = function (data) {
            awardIfNeeded(data);
            return originalJson.call(this, data);
        };
        res.send = function (data) {
            awardIfNeeded(data);
            return originalSend.call(this, data);
        };
        next();
    };
};
const trackDailyLogin = async (req, res, next) => {
    console.log('trackDailyLogin middleware running');
    if (req.user?.id) {
        setImmediate(async () => {
            try {
                await awardPoints(req.user.id, 'DAILY_LOGIN', req.socketManager);
                console.log('Daily login points!!');
                await updateStreak(req.user.id, req.socketManager); 
                console.log('Calling Streak Update');
                await checkAndAwardBadges(req.user.id, req.socketManager);
                console.log('Giving badges!!');
            } catch (err) {
                console.error('Daily login tracking error:', err);
            }
        });
    }else{
        console.log('This is not running');
    }
    next();
};
// //Middleware to track daily logins streaks 
// const trackDailyLogin=async(req,res,next)=>{
//     if(req.user?.id){
//         setImmediate(async(req,res)=>{
//             try{
//                 await awardPoints(req.user.id,'DAILY_LOGIN',req.socketManager);
//                 await updateStreak();
//                 console.log('Daily login points!!');
//                 await checkAndAwardBadges(req.user.id,req.socketManager);
//             }catch(err){
//                 console.error('Daily login tracking error:', err);
//             }
//         });
//     }
//     next();
// }
export { trackAction, trackDailyLogin };

