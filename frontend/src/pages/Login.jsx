// import axios from 'axios';
// import { useContext, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import AuthContext from '../context/AuthContext';
// const Login=()=>{
//     const {setCurrentPage,login}=useContext(AuthContext);
//     const navigate=useNavigate();
//     const[password,setPassword]=useState("");
//     const[email,setEmail]=useState("");


//     const handleSpotifyLogin=()=>{
//       const clientId='16295502c33340ef96f6e40b7857c589';
//       const redirectUrl = 'http://localhost:5173/spotify-callback';
//       const scope = encodeURIComponent([
//         'streaming',
//         'user-read-email',
//         'user-read-private',
//         'user-modify-playback-state',
//         'user-read-playback-state',
//         'user-library-read',
//         'playlist-read-private',
//       ].join(' '));
//       const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scope}`;
//       window.location.href = authUrl;
//     }


//     const handleLogin = async (event) => {
//       event.preventDefault();
//       try {
//         const response = await axios.post('https://zenova-qfsf.onrender.com/api/auth/login', { email, password });
        
//         console.log('Full login response:', response);
//         console.log('Response data structure:', JSON.stringify(response.data, null, 2));
        
//         const { data } = response;
        
//         if (!data.user) {
//           throw new Error('Invalid user data received');
//         }
        
//         // Log token specifically to see its structure
//         console.log('Token in response:', data.user.token || data.token);
        
//         // Clear any existing data
//         // localStorage.clear();
        
//         // Try both possible locations for the token
//         const token = data.user.token || data.token;
        
//         sessionStorage.setItem('token', token);
//         sessionStorage.setItem('userId', data.user._id);
        
//         console.log('Token saved to localStorage:', localStorage.getItem('token'));
        
//         // alert('Login successful');
//         login({
//           ...data.user,
//         });
//       } catch (err) {
//         console.error('Login Error:', err.response?.data || err.message);
//         alert(err.response?.data?.message || 'Login Failed');
//       }
//     }
//     return (    
//       <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
//       <div className="w-full max-w-md p-8 space-y-8 bg-[#1e1e1e] rounded-2xl shadow-lg">
//         <h2 className="text-3xl font-bold text-center text-[#e94c36]">Welcome Back</h2>
//         <form className="space-y-6" onSubmit={handleLogin}>
//           <input
//             type="email"
//             placeholder="Email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             className="w-full p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
//             required
//           />
//           <input
//             type="password"
//             placeholder="Password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             className="w-full p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
//             required
//           />
//           <button
//             type="submit"
//             className="w-full p-3 bg-[#e94c36] hover:bg-[#ff6347] text-white rounded-full font-semibold transition-all duration-300"
//           >
//             Login
//           </button>
//           <button
//             type="button"
//             onClick={handleSpotifyLogin}
//             className="w-full p-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-semibold transition-all duration-300"
//           >
//             Login with Spotify
//           </button>
//         </form>
//         <p className="text-center text-sm">
//           Don't have an account?{" "}
//           <span
//             onClick={() => setCurrentPage('register')}
//             className="text-orange-400 hover:underline cursor-pointer"
//           >
//             Register
//           </span>
//         </p>
//       </div>
//     </div>
//     );

// }
// export default Login; 


import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserStats } from '../api/gamificationAPI';
import AuthContext from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    
    useEffect(() => {
        // Check for pending invitation after component mounts
        const pendingInvite = sessionStorage.getItem('pendingInvite');
        if (pendingInvite && sessionStorage.getItem('token')) {
            // If already logged in and has pending invite, redirect to it
            sessionStorage.removeItem('pendingInvite');
            navigate(`/invite/${pendingInvite}`);
        }
    }, [navigate]);
    
    const handleSpotifyLogin = () => {
        const clientId = '16295502c33340ef96f6e40b7857c589';
        const redirectUrl = 'http://localhost:5173/spotify-callback';
        const scope = encodeURIComponent([
            'streaming',
            'user-read-email',
            'user-read-private',
            'user-modify-playback-state',
            'user-read-playback-state',
            'user-library-read',
            'playlist-read-private',
        ].join(' '));
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scope}`;
        window.location.href = authUrl;
    };
    const {dispatch}=useGamification();
    const handleLogin = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('https://zenova-qfsf.onrender.com/api/auth/login', { email, password });
            
            const { data } = response;
            
            if (!data.user) {
                throw new Error('Invalid user data received');
            }
            
            // Get token from response
            const token = data.user.token || data.token;
            
            // Store in sessionStorage
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('userId', data.user._id);
            
            // Call login function from context
            await login({
                ...data.user,
            });
            const stats=await getUserStats(data.user._id,token);
            dispatch({type:'SET_STATS',payload:{
                points: stats.points,
                level: stats.level,
                streak: stats.streak,
                badges: stats.badges
            }});
            // Check for pending invitation
            const pendingInvite = sessionStorage.getItem('pendingInvite');
            if (pendingInvite) {
                sessionStorage.removeItem('pendingInvite');
                navigate(`/invite/${pendingInvite}`);
            } else {
                navigate('/profile');
            }
        } catch (err) {
            console.error('Login Error:', err.response?.data || err.message);
            alert(err.response?.data?.message || 'Login Failed');
        }
    };
    
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-[#1e1e1e] rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-[#e94c36]">Welcome Back</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-[#2c2c2c] text-white rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full p-3 bg-[#e94c36] hover:bg-[#ff6347] text-white rounded-full font-semibold transition-all duration-300"
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={handleSpotifyLogin}
                        className="w-full p-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-semibold transition-all duration-300"
                    >
                        Login with Spotify
                    </button>
                </form>
                <p className="text-center text-sm">
                    Don't have an account?{" "}
                    <span
                        onClick={() => navigate('/register')}
                        className="text-orange-400 hover:underline cursor-pointer"
                    >
                        Register
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Login;
