// import { useContext, useEffect, useRef, useState } from 'react';
// import AuthContext from '../context/AuthContext';

// function Navbar() {
//     const { isAuthenticated, currentPage, setCurrentPage, logout } = useContext(AuthContext);
//     const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
//     const profileRef = useRef(null);

//     // Close dropdown when clicking outside
//     useEffect(() => {
//         function handleClickOutside(event) {
//             if (profileRef.current && !profileRef.current.contains(event.target)) {
//                 setProfileDropdownOpen(false);
//             }
//         }
        
//         document.addEventListener("mousedown", handleClickOutside);
//         return () => {
//             document.removeEventListener("mousedown", handleClickOutside);
//         };
//     }, [profileRef]);

//     return (
//         <nav className="bg-black border-b border-gray-800 fixed top-0 w-full z-50">
//             <div className="w-full px-4">
//                 <div className="flex justify-between h-16">
//                     <div className="flex">
//                         <div className="flex-shrink-0 flex items-center">
//                             <h1 className="text-xl font-bold text-white">ZENOVA</h1>
//                         </div>
//                         <div className="ml-6 flex space-x-8">
//                             <button
//                                 onClick={() => setCurrentPage('home')}
//                                 className={`${
//                                     currentPage === 'home'
//                                         ? 'border-orange-400 text-white'
//                                         : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-200'
//                                 } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
//                             >
//                                 Home
//                             </button>
//                             {isAuthenticated && (
//                                 <>
//                                     <button
//                                         onClick={() => setCurrentPage('profile')}
//                                         className={`${
//                                             currentPage === 'profile'
//                                                 ? 'border-orange-400 text-white'
//                                                 : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-200'
//                                         } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
//                                     >
//                                         Profile
//                                     </button>
//                                     <button
//                                         onClick={() => setCurrentPage('playlist')}
//                                         className={`${
//                                             currentPage === 'playlist'
//                                                 ? 'border-orange-400 text-white'
//                                                 : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-200'
//                                         } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
//                                     >
//                                         Playlists
//                                     </button>
//                                 </>
//                             )}
//                         </div>
//                     </div>
//                     <div className="ml-6 flex items-center relative" ref={profileRef}>
//                         {!isAuthenticated ? (
//                             <div className="flex space-x-4">
//                                 <button
//                                     onClick={() => setCurrentPage('login')}
//                                     className={`${
//                                         currentPage === 'login'
//                                             ? 'border-orange-400 text-white'
//                                             : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-200'
//                                     } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
//                                 >
//                                     Login
//                                 </button>
//                                 <button
//                                     onClick={() => setCurrentPage('register')}
//                                     className={`${
//                                         currentPage === 'register'
//                                             ? 'border-orange-400 text-white'
//                                             : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-200'
//                                     } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
//                                 >
//                                     Register
//                                 </button>
//                             </div>
//                         ) : (
//                             <div className="flex items-center">
//                                 <button
//                                     onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
//                                     className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-700 text-white focus:outline-none"
//                                 >
//                                     <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
//                                     </svg>
//                                 </button>
                                
//                                 {profileDropdownOpen && (
//                                     <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none" style={{top: '100%'}}>
//                                         <button
//                                             onClick={() => setCurrentPage('profile')}
//                                             className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
//                                         >
//                                             Your Profile
//                                         </button>
//                                         <button
//                                             onClick={() => setCurrentPage('settings')}
//                                             className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
//                                         >
//                                             Settings
//                                         </button>
//                                         <button
//                                             onClick={logout}
//                                             className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 w-full text-left"
//                                         >
//                                             Logout
//                                         </button>
//                                     </div>
//                                 )}
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </nav>
//     );
// }

// export default Navbar;


import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const {state}=useGamification();
    const navigate = useNavigate();
    
    const {dispatch} = useGamification();
    const handleLogout = () => {
        logout();
        dispatch({type:'RESET'});//Reset gamification state
        navigate('/');
    };
    
    return (
        <nav className="fixed top-0 left-0 right-0 bg-[#1e1e1e] shadow-md z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="text-xl font-bold text-[#e94c36]">ZENOVA</Link>
                    </div>
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                {/* Gamification Stats in navbar */}
                                <div className="hidden md:flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-1">
                                         <i className="fa-solid fa-coins text-yellow-400 text-sm"></i>
                                         <span className="text-white text-sm font-medium">{state.points}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-1">
                                        <i className="fa-solid fa-trophy text-orange-400 text-sm"></i>
                                        <span className="text-white text-sm font-medium">L{state.level}</span>
                                    </div>
                                    {state.streak > 0 && (
                                        <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-1">
                                            <i className="fa-solid fa-fire text-red-400 text-sm"></i>
                                            <span className="text-white text-sm font-medium">{state.streak}</span>
                                        </div>
                                    )}
                                </div>
                                <Link to="/playlist" className="text-white hover:text-[#e94c36] transition-colors">
                                    Playlists
                                </Link>
                                <Link to="/gamification" className="text-white hover:text-[#e94c36] transition-colors flex items-center space-x-1">
                                    <i className="fa-solid fa-gamepad text-sm"></i>
                                    <span>Achievements</span>
                                </Link>
                                <Link to="/profile" className="text-white hover:text-[#e94c36] transition-colors">
                                    Profile
                                </Link>
                                <button 
                                    onClick={handleLogout}
                                    className="bg-[#e94c36] hover:bg-[#ff6347] text-white px-4 py-2 rounded-md transition-colors"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-white hover:text-[#e94c36] transition-colors">
                                    Login
                                </Link>
                                <Link to="/register" className="bg-[#e94c36] hover:bg-[#ff6347] text-white px-4 py-2 rounded-md transition-colors">
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};




export default Navbar;


