
  
    
    

      
      
      
        

      

  
    
    

    

      
      
      

      

      

  
    
    

    

      
      
      

      

      

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white px-6 relative overflow-hidden font-sans">
      {/* Animated background elements - More diffused and artistic */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-600 blur-3xl opacity-8 animate-pulse-slow ${isLoaded ? '' : 'opacity-0'}`} style={{transitionDelay: '100ms'}}></div>
        <div className={`absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 blur-3xl opacity-8 animate-pulse-slow ${isLoaded ? '' : 'opacity-0'}`} style={{animationDelay: '2.5s', transitionDelay: '300ms'}}></div>
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-green-400 to-emerald-500 blur-3xl opacity-3 animate-pulse-slow ${isLoaded ? '' : 'opacity-0'}`} style={{animationDelay: '1.5s', transitionDelay: '500ms'}}></div>
      </div>
      
      {/* Custom CSS for animations and refined scrollbar */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInDown {
          animation: fadeInDown 0.8s ease-out forwards;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fadeInUp {
            animation: fadeInUp 0.8s ease-out forwards;
        }

        @keyframes pulse-slow {
            0%, 100% { transform: scale(1); opacity: 0.08; }
            50% { transform: scale(1.05); opacity: 0.12; }
        }
        .animate-pulse-slow {
            animation: pulse-slow 5s ease-in-out infinite alternate;
        }

        /* Custom scrollbar, though not critical for this component, ensures consistency */
        .scrollbar-thin {
            scrollbar-width: thin;
            scrollbar-color: #6d28d9 transparent; /* Thumb and track color - purple hue */
        }
        .scrollbar-thin::-webkit-scrollbar {
            width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
            background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
            background-color: #6d28d9; /* Deep purple */
            border-radius: 10px; /* More rounded */
            border: 2px solid transparent; /* Subtle border */
            background-clip: padding-box; /* Ensures border is outside thumb */
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background-color: #8b5cf6; /* Lighter purple on hover */
        }
      `}</style>

      {/* Logo with enhanced fade-in and artistic flair */}
      <div className={`relative mb-10 transform transition-all duration-500 hover:scale-105 opacity-0 ${isLoaded ? 'opacity-100 animate-fadeInDown' : ''}`}
           style={{
             transitionDelay: '400ms',
             transitionDuration: '800ms'
           }}>
        <h1 className="text-7xl font-extrabold text-white drop-shadow-xl text-center leading-none">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">ZENOVA</span>
        </h1>
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-4/5 h-2 bg-gradient-to-r from-transparent via-purple-600 to-transparent rounded-full shadow-lg opacity-70"></div>
      </div>
      
      <div className={`text-center mb-20 opacity-0 transition-all duration-1000 ${isLoaded ? 'opacity-100 animate-fadeInUp' : ''}`}
         style={{ transitionDelay: '600ms' }}>
        <p className="text-2xl text-gray-200 mb-2 max-w-2xl font-light tracking-wide">
          Discover harmony in your 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-medium"> soundscape</span>
        </p>
        <p className="text-lg text-gray-400 font-light">
          Less Noise. More <span className="text-cyan-400 font-medium">You</span>.
        </p>
      </div>
      {/* Container for the interactive buttons - using gradient fills and deeper shadows */}
      <div className={`relative flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-16 mb-16 opacity-0 transition-all duration-1000 transform translate-y-8 ${isLoaded ? 'opacity-100 translate-y-0 animate-fadeInUp' : ''}`}
           style={{
             transitionDelay: '800ms'
           }}>
        {/* Login button with artistic hover effects */}
        <button
          onClick={() => navigate("/login")}
          className="relative group bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-bold py-4 px-10 rounded-full border-2 border-transparent transition-all duration-300 
                     hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 transform overflow-hidden text-lg tracking-wide
                     after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:opacity-0 group-hover:after:opacity-100 after:transition-opacity after:duration-300 after:z-0"
        >
          Login
          <span className="absolute inset-0 z-0 rounded-full border-2 border-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
        </button>

        {/* Register button with artistic hover effects */}
        <button
          onClick={() => navigate("/register")}
          className="relative group bg-gradient-to-r from-emerald-600 to-blue-700 text-white font-bold py-4 px-10 rounded-full border-2 border-transparent transition-all duration-300 
                     hover:scale-105 hover:shadow-xl hover:shadow-blue-500/40 transform overflow-hidden text-lg tracking-wide
                     after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/10 after:to-transparent after:opacity-0 group-hover:after:opacity-100 after:transition-opacity after:duration-300 after:z-0"
        >
          Register
          <span className="absolute inset-0 z-0 rounded-full border-2 border-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
        </button>
      </div>
      
      {/* Feature highlights with glassmorphism cards and staggered fade-in */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-12 px-4 md:px-0">
        {/* Personalized */}
        <div 
          className={`text-center p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/15 shadow-2xl transform transition-all duration-500 hover:scale-[1.03] hover:bg-white/15 animate-fadeInUp opacity-0`}
          style={{ transitionDelay: `1000ms` }}
        >
          <i className="fa-solid fa-user-circle text-4xl text-purple-400 mb-4 drop-shadow-md"></i>
          <h3 className="text-xl font-semibold mb-2 text-purple-300">
            Personalized
          </h3>
          <p className="text-sm text-gray-300 font-light opacity-90">
            Tailored soundscapes just for your unique preferences.
          </p>
        </div>

        {/* Seamless */}
        <div 
          className={`text-center p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/15 shadow-2xl transform transition-all duration-500 hover:scale-[1.03] hover:bg-white/15 animate-fadeInUp opacity-0`}
          style={{ transitionDelay: `1200ms` }}
        >
          <i className="fa-solid fa-sync-alt text-4xl text-yellow-400 mb-4 drop-shadow-md"></i>
          <h3 className="text-xl font-semibold mb-2 text-yellow-300">
            Seamless
          </h3>
          <p className="text-sm text-gray-300 font-light opacity-90">
            Effortless integration and smooth user experience.
          </p>
        </div>

        {/* Premium */}
        <div 
          className={`text-center p-6 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/15 shadow-2xl transform transition-all duration-500 hover:scale-[1.03] hover:bg-white/15 animate-fadeInUp opacity-0`}
          style={{ transitionDelay: `1400ms` }}
        >
          <i className="fa-solid fa-star text-4xl text-emerald-400 mb-4 drop-shadow-md"></i>
          <h3 className="text-xl font-semibold mb-2 text-emerald-300">
            Premium
          </h3>
          <p className="text-sm text-gray-300 font-light opacity-90">
            Access to exclusive features and top-tier audio quality.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;