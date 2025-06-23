import { useContext, useEffect, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
const PresenceIndicator=({playlistId})=>{
    const {socket,joinPlaylist} =useSocket();
    const {user} =useContext(AuthContext);
    const [activeUsers,setActiveUsers]=useState([]);
    useEffect(()=>{
        if(!socket){
            return;
        }
      //   // Request current users in room when component mounts
      // if (playlistId) {
      //     // Trigger the server to send back the current users
      //     socket.emit('join_playlist', {
      //         playlistId,
      //         userId: user._id,
      //         username: user.name
      //     });
      // }
        //Listener for user joined event from backend
        const handleUserJoined=(data)=>{
            console.log('User joined:',data);
            setActiveUsers(data.users);
        }
        //Listener for user joined event from backend
        const handleUserLeft=(data)=>{
            console.log('User left:',data);
            setActiveUsers(data.users);
        }
        //Listen for collaborator added event
        const handleCollaboratorAdded=(data)=>{
          console.log('Collaborator added:',data);
          // Add the new collaborator to the active users if they're not already there
            if (data.collaborator && data.collaborator.userId && data.collaborator.username) {
                setActiveUsers(prev => {
                    // Check if user already exists
                    const exists = prev.some(u => u.userId === data.collaborator.userId);
                    if (exists) return prev;
                    return [...prev, { 
                        userId: data.collaborator.userId, 
                        username: data.collaborator.username 
                    }];
                });
            }
            // Refresh the room by rejoining
            joinPlaylist(playlistId);
        }

        //Listen for collaborator removed event
        const handleCollaboratorRemoved=(data)=>{
          console.log('Collaborator removed:', data);
          if(data.removedCollaborator && data.removedCollaborator.userId){
            setActiveUsers(prev=>prev.filter(user=> user.userId!=data.removedCollaborator.userId));
          }
          //refresh
          joinPlaylist(playlistId);
        }
        socket.on('user_joined',handleUserJoined);
        socket.on('collaborator_removed',handleCollaboratorRemoved);
        socket.on('user_left',handleUserLeft);
        socket.on('collaborator_added', handleCollaboratorAdded);
        //clean up
        return ()=>{
            socket.off('user_joined', handleUserJoined);
            socket.off('collaborator_removed',handleCollaboratorRemoved);
            socket.off('user_left', handleUserLeft);
            socket.off('collaborator_added', handleCollaboratorAdded);
        }
    },[socket,playlistId,joinPlaylist]);
    return (
        <div className="relative my-10 p-8 rounded-2xl bg-gradient-to-br from-[#1DB954]/20 to-[#191414]/30 backdrop-blur-xl border border-white/10 text-white max-w-3xl w-full mx-auto shadow-2xl transition-all duration-500">
          <h3 className="text-xl font-bold mb-6 text-[#1DB954] tracking-wide uppercase">
            Who's Listening ({activeUsers.length})
          </h3>
      
          <div className="flex flex-wrap gap-5">
            {activeUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center bg-white/10 backdrop-blur-sm border border-white/10 px-5 py-3 rounded-full hover:scale-105 transform transition-transform duration-300 shadow-sm"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-[#1DB954] text-black font-extrabold rounded-full mr-3 text-base relative">
                  {user.username.charAt(0).toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black"></span>
                </div>
                <span className="text-sm font-medium text-white">{user.username}</span>
              </div>
            ))}
          </div>
        </div>
      );
};
export default PresenceIndicator;