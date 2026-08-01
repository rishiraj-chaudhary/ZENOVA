import { createContext, useContext, useEffect, useReducer } from 'react';
import { useSocket } from './SocketContext';

const GamificationContext=createContext();
const initialState={
    points: 0,
    level: 1,
    streak: 0,
    badges: [],
    // Level-bar data, computed server-side from the one source of truth for
    // the thresholds.
    progress: null,
    notifications: []
};
function gamificationReducer(state,action){
    switch(action.type){
        case 'SET_STATS':
            return {...state,...action.payload};
        case 'POINTS_AWARDED':
            return {
                ...state,
                points:action.payload.totalPoints,
                level:action.payload.level,
                progress:action.payload.progress ?? state.progress,
                notifications:[
                    ...state.notifications,
                    {
                        type:'points',
                        message:`+${action.payload.points} points!`,
                        id:Date.now()
                    }
                ]
            }
        /**
         * Awards granted while no socket was open — the login bonus lands
         * during the login request itself — arrive together on connect. One
         * toast for the lot, rather than a stack of them.
         */
        case 'AWARDS_MISSED': {
            const { points, awards } = action.payload;
            if (!points) return state;

            const detail = awards?.length > 1 ? ` (${awards.length} rewards)` : '';

            return {
                ...state,
                notifications: [
                    ...state.notifications,
                    {
                        type: 'points',
                        message: `+${points} points while you were away${detail}`,
                        id: Date.now(),
                    },
                ],
            };
        }
        case 'LEVEL_UP':
            return {
                ...state,
                level:action.payload.level,
                notifications:[
                    ...state.notifications,
                    {
                        type:'level',
                        message:`Level Up! You reached Level ${action.payload.level}!`,
                        id:Date.now()
                    }
                ]
            }
        case 'BADGE_EARNED':
            if (!action.payload.badge){
                return state;
            }
            return {
                ...state,
                badges:[...state.badges,action.payload.badge],
                notifications:[
                    ...state.notifications,
                    {
                        type: 'badge',
                        message:`New badge: ${action.payload.badge.name}!`,
                        id:Date.now()
                    }
                ]
            }
        case 'STREAK_UPDATED': {
            const { currentStreak, reset, graceUsed } = action.payload;

            // A broken streak was being announced as an achievement —
            // "Streak updated: 1 days!" — which reads as congratulation at the
            // exact moment the user lost something.
            const message = reset
                ? "Streak restarted — day 1. Picking it back up is the hard part."
                : graceUsed
                  ? `Streak kept at ${currentStreak} days. We covered the gap for you.`
                  : `${currentStreak} day streak!`;

            return {
                ...state,
                streak: currentStreak,
                notifications: [
                    ...state.notifications,
                    { type: reset ? 'info' : 'streak', message, id: Date.now() },
                ],
            };
        }
        case 'DISMISS_NOTIFICATION':
            return  {
                ...state,
                notifications: state.notifications.filter(n=> n.id!==action.id)
            }
        case 'RESET':
            return { ...initialState };
        default:
            return state;
    }
}

export function GamificationProvider({children}){
    const {socket}=useSocket();
    const [state,dispatch]=useReducer(gamificationReducer,initialState);
    useEffect(()=>{
        if(!socket){
            return;
        }
        socket.on('points_awarded', data =>{
            console.log('Received points_awarded:', data);
            dispatch({ type: 'POINTS_AWARDED', payload: data })
        });
        socket.on('awards_missed', data =>
            dispatch({ type: 'AWARDS_MISSED', payload: data })
        );
        socket.on('level_up', data =>{
            console.log('Received level_up:', data);
            dispatch({ type: 'LEVEL_UP', payload: data })
        });
        socket.on('badge_earned', data =>{
            console.log('Received badge_earned:', data);
            dispatch({ type: 'BADGE_EARNED', payload: data })
        });
        socket.on('streak_updated', data =>{
            console.log('Received streak_updated:', data);
            dispatch({ type: 'STREAK_UPDATED', payload: data })
        });
        return ()=>{
            socket.off('points_awarded');
            socket.off('awards_missed');
            socket.off('level_up');
            socket.off('badge_earned');
            socket.off('streak_updated');
        };
    },[socket,dispatch]);
    return (
        <GamificationContext.Provider value={{state,dispatch}}>
            {children}
        </GamificationContext.Provider>
    );
}
export const useGamification=()=> useContext(GamificationContext);