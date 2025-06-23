import { useGamification } from '../../context/GamificationContext';
const PointsDisplay = ({ className = "" }) => {
  const { state } = useGamification();

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
        {/* Points Badge */}
      <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-3 shadow-lg hover:scale-105 transition-all duration-300 hover:shadow-purple-500/25">
        <div className="flex items-center space-x-2">
          <i className="fa-solid fa-coins text-white text-sm"></i>
          <div className="text-white">
            <div className="text-lg font-bold">{state.points}</div>
            <div className="text-xs opacity-80">Points</div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl animate-pulse opacity-20"></div>
      </div>

      {/* Level Badge */}
      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-lg hover:scale-105 transition-all duration-300 hover:bg-white/20">
        <div className="flex items-center space-x-2">
          <i className="fa-solid fa-trophy text-yellow-400 text-sm"></i>
          <div className="text-white">
            <div className="text-lg font-bold">Level {state.level}</div>
            <div className="text-xs text-gray-400">Current</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsDisplay;
