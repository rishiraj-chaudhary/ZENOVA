import { useGamification } from '../../context/GamificationContext';

const BadgeCollection = ({ limit = 5, className = "" }) => {
    const { state } = useGamification();
    const displayBadges = limit ? state.badges.filter(Boolean).slice(0, limit) : state.badges.filter(Boolean);
    
    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'from-yellow-400 via-orange-400 to-red-500';
            case 'epic': return 'from-purple-400 via-pink-400 to-indigo-500';
            case 'rare': return 'from-blue-400 via-cyan-400 to-teal-500';
            case 'common': return 'from-gray-400 via-slate-400 to-gray-600';
            default: return 'from-gray-400 via-slate-400 to-gray-600';
        }
    };

    const getRarityGlow = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'shadow-yellow-400/50';
            case 'epic': return 'shadow-purple-400/50';
            case 'rare': return 'shadow-blue-400/50';
            case 'common': return 'shadow-gray-400/30';
            default: return 'shadow-gray-400/30';
        }
    };

    const getRarityBorder = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'border-yellow-400/60';
            case 'epic': return 'border-purple-400/60';
            case 'rare': return 'border-blue-400/60';
            case 'common': return 'border-gray-400/40';
            default: return 'border-gray-400/40';
        }
    };

    if (displayBadges.length === 0) {
        return (
            <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-8 ${className}`}>
                <div className="text-center">
                    <div className="relative mb-4">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-400/20 to-gray-600/20 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-medal text-3xl text-gray-400"></i>
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-500/30 rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-question text-xs text-gray-400"></i>
                        </div>
                    </div>
                    <h4 className="text-gray-300 font-medium mb-1">No Badges Yet</h4>
                    <p className="text-sm text-gray-500">Complete challenges to earn your first badge!</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-6 overflow-hidden ${className}`}>
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
            
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-400/30 animate-pulse">
                            <i className="fa-solid fa-award text-white text-xl"></i>
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                            <i className="fa-solid fa-check text-xs text-white"></i>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200">
                            Badge Collection
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                                <p className="text-gray-300 text-sm font-medium">{state.badges.length} badges earned</p>
                            </div>
                            {state.badges.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 px-2 py-1 rounded-full border border-yellow-400/30">
                                    <span className="text-xs text-yellow-300 font-medium">Active</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {limit && state.badges.length > limit && (
                    <div className="relative group">
                        <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <span className="text-sm text-gray-200 font-medium">+{state.badges.length - limit} more</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                    </div>
                )}
            </div>
            
            {/* Badges Grid */}
            <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {displayBadges.map((badge, index) => {
                    if (!badge) return null;
                    
                    return (
                        <div 
                            key={badge.id || index}
                            className="relative group cursor-pointer transform transition-all duration-500 hover:-translate-y-3 hover:scale-105"
                            style={{animationDelay: `${index * 100}ms`}}
                        >
                            {/* Badge Container */}
                            <div className="relative">
                                {/* Outer Glow Ring */}
                                {/* <div className={`absolute -inset-2 bg-gradient-to-br ${getRarityColor(badge.rarity)} rounded-3xl blur-md opacity-0 group-hover:opacity-60 transition-all duration-500 animate-pulse`}></div> */}
                                
                                {/* Inner Glow Effect */}
                                {/* <div className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(badge.rarity)} rounded-2xl blur-sm opacity-20 group-hover:opacity-40 transition-opacity duration-300`}></div> */}
                                
                                {/* Badge */}
                                <div className={`relative mt-10 w-22 h-22 bg-gradient-to-br ${getRarityColor(badge.rarity)} rounded-2xl flex items-center justify-center shadow-2xl border-2 ${getRarityBorder(badge.rarity)} group-hover:shadow-3xl transition-all duration-500 group-hover:rotate-3`}>
                                    {/* Badge Icon Background */}
                                    <div className="absolute  inset-2 bg-white/10 rounded-xl"></div>
                                    <i className={`${badge.icon} text-2xl text-white drop-shadow-2xl relative z-10 transform group-hover:scale-110 transition-transform duration-300`}></i>
                                    
                                    {/* Shine Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    
                                    {/* Sparkle Effects */}
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-ping"></div>
                                    <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-white/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-ping" style={{animationDelay: '0.5s'}}></div>
                                </div>

                                {/* Enhanced Rarity Indicator */}
                                <div className={`absolute -top-0 -right-0 w-7 h-7 bg-gradient-to-br ${getRarityColor(badge.rarity)} rounded-full border-2 border-white/40 flex items-center justify-center shadow-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300`}>
                                    {badge.rarity === 'legendary' && <i className="fa-solid fa-crown text-xs text-white animate-pulse"></i>}
                                    {badge.rarity === 'epic' && <i className="fa-solid fa-gem text-xs text-white"></i>}
                                    {badge.rarity === 'rare' && <i className="fa-solid fa-star text-xs text-white"></i>}
                                    {badge.rarity === 'common' && <i className="fa-solid fa-circle text-xs text-white opacity-80"></i>}
                                </div>

                                {/* Progress Ring for Legendary */}
                                {/* {badge.rarity === 'legendary' && (
                                    <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400/30">
                                        <div className="absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r from-yellow-400 via-transparent to-yellow-400 bg-clip-border animate-spin" style={{animationDuration: '3s'}}></div>
                                    </div>
                                )} */}
                            </div>
                            
                            {/* Badge Name */}
                            <div className="mt-4 text-center">
                                <h4 className="text-white text-sm font-semibold truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-yellow-300 group-hover:via-orange-300 group-hover:to-red-300 transition-all duration-300 mb-1">
                                    {badge.name}
                                </h4>
                                <div className="flex items-center justify-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getRarityColor(badge.rarity)} animate-pulse`}></div>
                                    <p className="text-gray-300 text-xs capitalize font-medium">{badge.rarity}</p>
                                </div>
                            </div>
                            
                            {/* Enhanced Tooltip */}
                            <div className="absolute mb-38 bottom-0 left-1/2 transform -translate-x-1/2 mt-3 px-5 py-4 bg-black/95 backdrop-blur-md text-white text-sm rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-30 shadow-2xl border border-white/20">
                                <div className="flex items-center space-x-2 mb-2">
                                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getRarityColor(badge.rarity)}`}></div>
                                    <div className="font-semibold text-white">{badge.name}</div>
                                </div>
                                <div className="text-gray-300 text-xs leading-relaxed max-w-xs">{badge.description}</div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                                    <span className="text-xs text-gray-400 capitalize">{badge.rarity}</span>
                                    <div className="flex space-x-1">
                                        {[...Array(badge.rarity === 'legendary' ? 5 : badge.rarity === 'epic' ? 4 : badge.rarity === 'rare' ? 3 : 2)].map((_, i) => (
                                            <i key={i} className="fa-solid fa-star text-xs text-yellow-400"></i>
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-black/95"></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Achievement Summary */}
            {displayBadges.length > 0 && (
                <div className="relative mt-8 pt-6 border-t border-gradient-to-r from-transparent via-white/20 to-transparent">
                    <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                                    <i className="fa-solid fa-chart-bar text-white text-sm"></i>
                                </div>
                                <div>
                                    <span className="text-white font-semibold text-sm">Collection Progress</span>
                                    <p className="text-gray-400 text-xs">Rarity distribution</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 justify-end">
                                {['legendary', 'epic', 'rare', 'common'].map(rarity => {
                                    const count = displayBadges.filter(badge => badge?.rarity === rarity).length;
                                    return count > 0 ? (
                                        <div key={rarity} className="group relative">
                                            <div className="flex items-center space-x-2 bg-gradient-to-r from-black/20 to-black/10 px-3 py-2 rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105">
                                                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getRarityColor(rarity)} shadow-lg group-hover:animate-pulse`}></div>
                                                <span className="text-gray-200 text-xs font-medium capitalize">{rarity}</span>
                                                <div className="bg-white/20 px-2 py-0.5 rounded-full">
                                                    <span className="text-white text-xs font-bold">{count}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Hover tooltip for rarity info */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-20 border border-white/10">
                                                <div className="flex items-center space-x-1">
                                                    {[...Array(rarity === 'legendary' ? 5 : rarity === 'epic' ? 4 : rarity === 'rare' ? 3 : 2)].map((_, i) => (
                                                        <i key={i} className="fa-solid fa-star text-xs text-yellow-400"></i>
                                                    ))}
                                                </div>
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                                            </div>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    
                    </div>
                </div>
            )}
        </div>
    );
};

export default BadgeCollection;