import axios from 'axios';
import { createContext, useEffect, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [currentPage, setCurrentPage] = useState('home');
    const [spotifyToken, setSpotifyToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // ✅ Compute isAuthenticated based on user state
    const isAuthenticated = !!user;

    // useEffect(() => {
    //     const checkAuthStatus = async () => {
    //         try {
    //             const token = sessionStorage.getItem('token');
    //             const userId = sessionStorage.getItem('userId');
                
    //             if (token && userId) {
    //                 const { data } = await axios.get(`http://localhost:3000/api/users/${userId}`, {
    //                     headers: {
    //                         Authorization: `Bearer ${token}`
    //                     }
    //                 });
    //                 setUser(data);
    //             }
    //         } catch (err) {
    //             console.log('Not authenticated');
    //             sessionStorage.removeItem('token');
    //             sessionStorage.removeItem('userId');
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     checkAuthStatus();
    // }, []);
    useEffect(() => {
        const checkAuthStatus = async () => {
          try {
            const token = sessionStorage.getItem('token');
            const userId = sessionStorage.getItem('userId');
            
            // Only attempt to fetch user data if both token and userId exist
            if (token && userId) {
              try {
                const { data } = await axios.get(`http://localhost:3000/api/users/profile`, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });
                setUser(data);
              } catch (err) {
                // Only log an error if we actually had credentials to check
                console.log('Authentication failed - clearing stored credentials');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('userId');
              }
            }
          } finally {
            setLoading(false);
          }
        };
        
        checkAuthStatus();
      }, []);

    const login = async (userData) => {
        setUser(userData);
        setCurrentPage('profile');
        return true;
    };

    const logout = async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (token) {
                await axios.post('http://localhost:3000/api/auth/logout', {}, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            }
        } catch (err) {
            console.error('Logout Error:', err);
        } finally {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('userId');
            // if (user) {
            //     sessionStorage.removeItem(`chat_messages_${user.id}`);
            // }
            setUser(null);
            setCurrentPage('home');
            setSpotifyToken(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            currentPage,
            setCurrentPage,
            spotifyToken, 
            setSpotifyToken,
            loading,
            isAuthenticated  // ✅ Add this line
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;

