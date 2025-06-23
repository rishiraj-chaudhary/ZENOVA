// import { useContext } from 'react';
// import { BrowserRouter, Route, Routes } from 'react-router-dom';
// import Navbar from "./components/Navbar";
// import AuthContext, { AuthProvider } from './context/AuthContext';
// import { SocketProvider } from './context/SocketContext';
// import Home from "./pages/Home";
// import InviteAccept from './pages/InviteAccept';
// import Login from "./pages/Login";
// import Playlist from "./pages/Playlist";
// import Profile from "./pages/Profile";
// import Register from "./pages/Register";
// const AppContent = () => {

//     const { currentPage } = useContext(AuthContext);

//     let PageComponent;
//     if (currentPage === "login") PageComponent = <Login />;
//     else if (currentPage === "register") PageComponent = <Register />;
//     else if (currentPage === "profile") PageComponent = <Profile />;
//     else if (currentPage === "playlist") PageComponent = <Playlist />;
//     else if (currentPage === "invite") PageComponent=<InviteAccept/>
//     else PageComponent = <Home />;

//     return (
//         <BrowserRouter>
//             <div>
//                 {currentPage !== 'home' && <Navbar/>}
//                 <div className="pt-16"> {/* padding to offset fixed navbar */}
//                     <Routes>
//                         <Route path="/invite/:inviteCode" element={<InviteAccept />} />
//                         <Route path="*" element={PageComponent} />
//                     </Routes>
//                 </div>
//             </div>
            
//         </BrowserRouter>
//     );
// };


// function App() {
//     return (
//         <AuthProvider>
//             <SocketProvider>
//                 <AppContent />
//             </SocketProvider>
//         </AuthProvider>
//     );
// }

// export default App;

// // <div>
// //                 {currentPage!=='home' && <Navbar/>}
// //                 <div className="pt-16"> {/* padding to offset fixed navbar */}
// //                     {PageComponent}
// //                 </div>
// //             </div>

// import { useContext } from 'react';
// import { BrowserRouter, Route, Routes } from 'react-router-dom';
// import Navbar from "./components/Navbar";
// import AuthContext, { AuthProvider } from './context/AuthContext';
// import { SocketProvider } from './context/SocketContext';
// import Home from "./pages/Home";
// import InviteAccept from './pages/InviteAccept';
// import Login from "./pages/Login";
// import Playlist from "./pages/Playlist";
// import Profile from "./pages/Profile";
// import Register from "./pages/Register";

// const AppContent = () => {
//     const { currentPage } = useContext(AuthContext);

//     let PageComponent;
//     if (currentPage === "login") PageComponent = <Login />;
//     else if (currentPage === "register") PageComponent = <Register />;
//     else if (currentPage === "profile") PageComponent = <Profile />;
//     else if (currentPage === "playlist") PageComponent = <Playlist />;
//     else if (currentPage === "invite") PageComponent = <InviteAccept />
//     else PageComponent = <Home />;

//     return (
//         <BrowserRouter>
//             <div>
//                 {currentPage !== 'home' && <Navbar/>}
//                 <div className="pt-16"> {/* padding to offset fixed navbar */}
//                     <Routes>
//                         <Route path="/invite/:inviteCode" element={<InviteAccept />} />
//                         <Route path="*" element={PageComponent} />
//                     </Routes>
//                 </div>
//             </div>
//         </BrowserRouter>
//     );
// };

// function App() {
//     return (
//         <AuthProvider>
//             <SocketProvider>
//                 <AppContent />
//             </SocketProvider>
//         </AuthProvider>
//     );
// }

// export default App;




import { useContext } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Navbar from "./components/Navbar";
import SpotifyCallback from './components/SpotifyCallback';
import AuthContext, { AuthProvider } from './context/AuthContext';
// import { GamificationProvider } from './context/GamificationContext';
import NotificationToast from './components/Gamification/NotificationToast';
import { GamificationProvider } from './context/GamificationContext';
import { SocketProvider } from './context/SocketContext';
import { SpotifyAuthProvider } from './context/SpotifyAuthContext';
import Gamification from './pages/Gamification';
import Home from "./pages/Home";
import InviteAccept from './pages/InviteAccept';
import Login from "./pages/Login";
import Playlist from "./pages/Playlist";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
const AppContent = () => {
    const { user, loading } = useContext(AuthContext);

    // Show loading indicator while checking authentication status
    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    return (
        <BrowserRouter>
            {/* Only render Navbar when user is authenticated or on public routes */}
            {(user || window.location.pathname === '/login' || window.location.pathname === '/register') && 
                <Navbar />
            }
            {/* Global Real-Time notifications */}
            <NotificationToast/>
            
            <div className={user || window.location.pathname === '/login' || window.location.pathname === '/register' ? "pt-16" : ""}>
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/spotify-callback" element={<SpotifyCallback />} />
                    <Route path="/invite/:inviteCode" element={<InviteAccept />} />
                    <Route 
                        path="/gamification" 
                        element={user ? <Gamification /> : <Navigate to="/login" />} 
                    />
                    {/* Protected routes */}
                    <Route 
                        path="/profile" 
                        element={user ? <Profile /> : <Navigate to="/login" />} 
                    />
                    <Route 
                        path="/playlist" 
                        element={user ? <Playlist /> : <Navigate to="/login" />} 
                    />
                    
                    {/* Fallback route */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
};

function App() {
    return (
       <AuthProvider>
            <SpotifyAuthProvider>
                <SocketProvider>
                    <GamificationProvider>
                        <AppContent />
                    </GamificationProvider>
                </SocketProvider>
            </SpotifyAuthProvider>
        </AuthProvider>
    );
}

export default App;
