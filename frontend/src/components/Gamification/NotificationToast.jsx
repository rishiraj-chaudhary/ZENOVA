import { useEffect, useState } from "react";
import { useGamification } from "../../context/GamificationContext.jsx";

const DISPLAY_MS = 4000;
const FADE_MS = 300;

const NotificationToast = () => {
    const { state, dispatch } = useGamification();
    const [visible, setVisible] = useState(false);
    const [currentNotification, setCurrentNotification] = useState(null);

    /**
     * Shows one queued notification at a time. Both timers are cleared on
     * cleanup — the previous version left them running, so a notification
     * arriving during a fade could dismiss the wrong entry after unmount.
     */
    useEffect(() => {
        const [next] = state.notifications;
        if (visible || !next) return undefined;

        setCurrentNotification(next);
        setVisible(true);

        let fadeTimer;
        const hideTimer = setTimeout(() => {
            setVisible(false);
            fadeTimer = setTimeout(
                () => dispatch({ type: "DISMISS_NOTIFICATION", id: next.id }),
                FADE_MS
            );
        }, DISPLAY_MS);

        return () => {
            clearTimeout(hideTimer);
            clearTimeout(fadeTimer);
        };
    }, [state.notifications, visible, dispatch]);

    const dismissNow = () => {
        setVisible(false);
        if (currentNotification) {
            dispatch({ type: "DISMISS_NOTIFICATION", id: currentNotification.id });
            setCurrentNotification(null);
        }
    };

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
            onClick={dismissNow}
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


