import { useContext, useEffect, useState } from 'react';
import { getLeaderboard, getUserStats } from '../api/gamificationAPI';
import BadgeCollection from '../components/Gamification/BadgeCollection.jsx';
import PointsDisplay from '../components/Gamification/PointsDisplay.jsx';
import StreakCounter from '../components/Gamification/StreakCounter.jsx';
import AuthContext from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';

const Gamification=()=>{
    const {user} =useContext(AuthContext);
    const { state,dispatch } = useGamification();
    const [leaderboard,setLeaderboard]=useState([]);
    const [loading,setLoading]=useState(true);
    const [activeTab,setActiveTab]=useState('overview');

    useEffect(()=>{
        const fetchGamificationData=async()=>{
            if(!user){
                return;
            }
            try{
                const token=sessionStorage.getItem('token');
                const [statsData,leaderboardData]=await Promise.all([getUserStats(user._id,token),getLeaderboard()]);
            
                dispatch({
                    type: 'SET_STATS',
                    payload: {
                        points: statsData.points,
                        level: statsData.level,
                        streak: statsData.streak,
                        badges: statsData.badges
                    }
                });
                
                setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
                setLoading(false);
            }catch(err){
                console.error('Error fetching gamification data:', err);
                setLoading(false);
            }
        }
        fetchGamificationData();
    },[user]);

    if(loading){
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
                <div className="text-white text-xl">Loading your achievements...</div>
            </div>
        );
    }
    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white p-6">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
            Your Musical Journey
          </h1>
          <p className="text-xl text-gray-300">Track your progress and compete with others</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex space-x-2">
            {[
              { id: 'overview', label: 'Overview', icon: 'fa-chart-line' },
              { id: 'badges', label: 'Badges', icon: 'fa-award' },
              { id: 'leaderboard', label: 'Leaderboard', icon: 'fa-trophy' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {/* Stats Cards */}
            <PointsDisplay className="col-span-1" />
            <StreakCounter className="col-span-1" />
            
            {/* Level Progress */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-star text-white text-lg"></i>
                </div>
                <div>
                  <div className="text-white text-lg font-bold">Level {state.level}</div>
                  <div className="text-gray-400 text-xs">Your current level</div>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-orange-600 h-2 rounded-full transition-all duration-300" 
                  style={{width: `${(state.points % 500) / 5}%`}}
                ></div>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {500 - (state.points % 500)} points to next level
              </div>
            </div>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="mb-12">
            <BadgeCollection limit={null} className="max-w-4xl mx-auto" />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                <i className="fa-solid fa-trophy text-yellow-400"></i>
                <span>Top Players</span>
              </h3>
              
              <div className="space-y-4">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <div 
                    key={entry.userId}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 ${
                      index < 3 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' 
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-gray-700 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-white font-medium">{entry.username}</div>
                        <div className="text-gray-400 text-sm">Level {entry.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{entry.totalPoints}</div>
                      <div className="text-gray-400 text-sm">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default Gamification;