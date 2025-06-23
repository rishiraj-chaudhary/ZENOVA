import { useEffect, useState } from 'react';
import { useGamification } from '../../context/GamificationContext';

const NotificationToast=()=>{
    const {state,dispatch}=useGamification();
    const [visible,setVisible]=useState(false);
    const [currentNotification,setCurrentNotification]=useState(null);
     // Debug logs
    console.log("Notifications in state:", state.notifications);
    console.log("Current notification:", currentNotification);
    console.log("Visible:", visible);
    // useEffect(()=>{
    //     const latestNotification=state.notifications[state.notifications.length-1];
    //     if(latestNotification && latestNotification !== currentNotification){
    //         setCurrentNotification(latestNotification);
    //         setVisible(true);
    //         //Auto dismiss after 3 sec
    //         setTimeout(()=>{
    //             setVisible(false);
    //                 setTimeout(()=>{
    //                     dispatch({type:'DISMISS_NOTIFICATION',id:latestNotification.id});
    //                 }, 300);
    //         }, 4000);
    //     }
    // },[state.notifications,currentNotification,dispatch]);
    useEffect(() => {
      // if(!visible || !currentNotification){
      //   return null;
      // }
    if (!visible && state.notifications.length > 0) {
        setCurrentNotification(state.notifications[0]);
        setVisible(true);
        setTimeout(() => {
            setVisible(false);
            setTimeout(() => {
                dispatch({ type: 'DISMISS_NOTIFICATION', id: state.notifications[0].id });
            }, 300);
        }, 4000);
    }
}, [state.notifications, visible, dispatch]);
    const getNotificationColor = (type) => {
        switch (type) {
            case 'points': return 'from-green-500 to-emerald-600';
            case 'level': return 'from-yellow-400 to-orange-500';
            case 'badge': return 'from-purple-500 to-pink-600';
            case 'streak': return 'from-blue-500 to-cyan-600';
            default: return 'from-indigo-500 to-purple-600';
        }
    };
    const getNotificationIcon=(type)=>{
        switch(type){
            case 'points': return 'fa-coins';
            case 'level': return 'fa-trophy';
            case 'badge': return 'fa-award';
            case 'streak': return 'fa-fire';
            default: return 'fa-star';
        }
    }
    if(!visible || !currentNotification){
        return null;
    }
//     return (
//   <div style={{zIndex: 9999, position: 'fixed', top: 20, right: 20, background: 'red', color: 'white', padding: 20}}>
//     {currentNotification.message}
//       <button onClick={() => dispatch({
//     type: 'POINTS_AWARDED',
//     payload: { points: 10, totalPoints: 100, level: 1 }
//   })}>
//     Test veaveravNotification
//   </button>
//   </div>
  
// );
    return (
    <div 
      className={`fixed top-6 right-6 z-50 transition-all duration-300 transform ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`bg-gradient-to-r ${getNotificationColor(currentNotification.type)} rounded-2xl p-4 shadow-2xl backdrop-blur-xl border border-white/20 max-w-sm`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <i className={`fa-solid ${getNotificationIcon(currentNotification.type)} text-white`}></i>
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm">{currentNotification.message}</p>
          </div>
          <button 
            onClick={() =>{
              setVisible(false);
              setTimeout(()=>{
                  if(currentNotification){
                      dispatch({type : 'DISMISS_NOTIFICATION' , id : currentNotification.id});
                      setCurrentNotification(null);
                    }
                  },300);
            }}
            className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors duration-200"
          >
            <i className="fa-solid fa-times text-white text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
export default NotificationToast;


