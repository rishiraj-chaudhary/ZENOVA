import { useGamification } from '../../context/GamificationContext';
const StreakCounter=({className=""})=>{
    const {state} = useGamification();
    return (
        <div className={`bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 ${className}`}>
            <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <i className="fa-solid fa-fire text-white text-lg"></i>
                </div>
                <div>
                <div className="text-white text-lg font-bold">{state.streak} days</div>
                <div className="text-gray-400 text-xs">Current streak</div>
                </div>
            </div>
        </div>
  );
}
export default StreakCounter;