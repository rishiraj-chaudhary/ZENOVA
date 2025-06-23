import { createContext, useContext, useEffect, useReducer } from 'react';
import { useSocket } from './SocketContext';

const GamificationContext=createContext();
const initialState={
    points: 0,
    level: 1,
    streak: 0,
    badges: [],
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
                notifications:[
                    ...state.notifications,
                    {
                        type:'points',
                        message:`+${action.payload.points} points!`,
                        id:Date.now()
                    }
                ]
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
        case 'STREAK_UPDATED':
            return {
                ...state,
                streak:action.payload.currentStreak,
                notifications:[
                    ...state.notifications,
                    {
                        type:'streak',
                        message:`Streak updated: ${action.payload.currentStreak} days!`,
                        id:Date.now()
                    }
                ]
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
    //dispatch--> the function used to send actions to the reducer (gamificationreducer), which updates the state 
    useEffect(()=>{
        if(!socket){
            return;
        }
        socket.on('points_awarded', data =>{
            console.log('Received points_awarded:', data);
            dispatch({ type: 'POINTS_AWARDED', payload: data })
        });
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