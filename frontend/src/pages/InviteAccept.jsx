// import { useContext, useEffect, useState } from 'react';
// import { useParams } from 'react-router-dom';
// import AuthContext from '../context/AuthContext';
// const InviteAccept=()=>{
//     const {inviteCode}=useParams();
//     const {user,setCurrentPage}=useContext(AuthContext);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [success, setSuccess] = useState(false);
    
//     const getAuthHeaders = () => ({
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || ''}`
//     });

//     useEffect(()=>{

//         console.log("InviteAccept mounted, inviteCode:", inviteCode);
//     console.log("User authenticated:", !!user);
//         //If not authenticated , redirect to login using context
//         if(!user){
//             //Store the invite link into session storage to use after login 
//             sessionStorage.setItem('pendingInvite',inviteCode);
//             setCurrentPage('login');
//             console.log('AFTER');
//             return;
//         }
//         const acceptInvitation=async()=>{
//             try{
//                 console.log("Sending invitation acceptance request for code:", inviteCode);
//                 setLoading(true);
//                 const response=await fetch(`http://localhost:3000/api/playlists/invite/accept/${inviteCode}`,{
//                     headers: getAuthHeaders()
//                 });
//                 console.log("Response status:", response.status);
//                 const data=await response.json();
//                 if(!response.ok){
//                     throw new Error(data.message || 'Failed to accept invitation');
//                 }
//                 //Set success
//                 setSuccess(true);
//                 setTimeout(()=>{
//                     setCurrentPage('playlist');
//                     //Store the playlistId in sessionStorage to expand it when playlist page loads
//                     sessionStorage.setItem('expandPlaylist',data.playlistId);
//                 },2000);
//             }catch(err){
//                  console.error("Error accepting invitation:", err);
//                 setError(err.message || 'Failed to accept invitation');
//             }finally{
//                 setLoading(false);
//             }
//         };
//         acceptInvitation();
//     },[inviteCode,user,setCurrentPage]);

  

//     return (
//         <div className="flex flex-col items-center justify-center min-h-screen bg-[#181818] text-white p-4">
//             <div className="bg-[#1e1e1e] p-8 rounded-lg shadow-lg max-w-md w-full">
//                 <h2 className="text-2xl font-bold text-center mb-6">Playlist Invitation</h2>
                
//                 {loading ? (
//                     <div className="text-center">
//                         <p className="mb-4">Processing your invitation...</p>
//                         <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
//                     </div>
//                 ) : error ? (
//                     <div className="text-center">
//                         <p className="text-red-400 mb-4">{error}</p>
//                         <button
//                             onClick={() => setCurrentPage('playlist')}
//                             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
//                         >
//                             Go to My Playlists
//                         </button>
//                     </div>
//                 ) : (
//                     <div className="text-center">
//                         <p className="text-green-400 mb-4">Successfully joined the playlist!</p>
//                         <p className="mb-4">Redirecting to the playlist page...</p>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }
// export default InviteAccept;



import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
const InviteAccept = () => {
    const { inviteCode } = useParams();
    const { user } = useContext(AuthContext);
    const {socket,joinPlaylist} =useSocket();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || ''}`
    });

    useEffect(() => {
        console.log("InviteAccept mounted, inviteCode:", inviteCode);
        console.log("User authenticated:", !!user);
        
        // If not authenticated, redirect to login
        if (!user) {
            // Store the invite code in sessionStorage to use after login
            sessionStorage.setItem('pendingInvite', inviteCode);
            navigate('/login');
            return;
        }
        
        const acceptInvitation = async () => {
            try {
                setLoading(true);
                console.log("Sending invitation acceptance request for code:", inviteCode);
                
                const response = await fetch(`http://localhost:3000/api/playlists/invite/accept/${inviteCode}`, {
                    headers: getAuthHeaders()
                });
                
                console.log("Response status:", response.status);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to accept invitation');
                }
                //Emit socket event to join the playlist room
                if(socket && data.playlistId){
                    console.log('Joining playlist room:',data.playlistId);
                    joinPlaylist(data.playlistId);
                    //Emit a custom event to notify that invitation was accepted
                    socket.emit('invitation_accepted',{
                        playlistId:data.playlistId,
                        userId:user._id,
                        username:user.name
                    });
                    socket.emit('playlist_updated',{
                        userId: user._id,
                        username: user.name,
                        action: 'invitation_accepted',
                        playlistId: data.playlistId
                    });
                }
                // Set success
                setSuccess(true);
                
                // Store the playlist ID to expand it when redirected
                sessionStorage.setItem('expandPlaylist', data.playlistId);
                
                // Redirect after a short delay
                setTimeout(() => {
                    navigate('/playlist');
                }, 2000);
            } catch (err) {
                console.error("Error accepting invitation:", err);
                setError(err.message || 'Failed to accept invitation');
            } finally {
                setLoading(false);
            }
        };
        
        acceptInvitation();
    }, [inviteCode, user, navigate]);

    if (!user) {
        return null; // Will redirect to login via useEffect
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#181818] text-white p-4">
            <div className="bg-[#1e1e1e] p-8 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-2xl font-bold text-center mb-6">Playlist Invitation</h2>
                
                {loading ? (
                    <div className="text-center">
                        <p className="mb-4">Processing your invitation...</p>
                        <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                ) : error ? (
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/playlist')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        >
                            Go to My Playlists
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-green-400 mb-4">Successfully joined the playlist!</p>
                        <p className="mb-4">Redirecting to the playlist page...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InviteAccept;
