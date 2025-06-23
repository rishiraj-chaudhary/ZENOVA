
import { createContext, useEffect, useContext as useReactContext, useState } from 'react';
import { io } from 'socket.io-client'; //connects frontend to backend socket-io server
import AuthContext from './AuthContext';

//Create context
export const SocketContext=createContext();
//custom hook to use SocketContext
export const useSocket=()=> 
    useReactContext(SocketContext);
export const SocketProvider=({children})=>{
    const [socket,setSocket]=useState(null);//holds socket.io-client instance
    const [connected,setConnected]=useState(false);//whether socket.io is connected to backend server or not
    const {user}=useReactContext(AuthContext);
    //get authenticated user from authContext
    useEffect(()=>{
        //only connect if user is verified
        if(!user){
            return;
        }
        //connect to the socket server
        const socketInstance=io('http://localhost:3000',{
            reconnection:true,
            reconnectionAttempts:5,
            reconnectionDelay:1000,
        });
        //set up event listeners
        socketInstance.on('connect',()=>{
            console.log('Socket connected');
            setConnected(true);
            // Register user room for personal events
            if (user && user._id) {
                socketInstance.emit('register_user', { userId: user._id });
            }
        });
        socketInstance.on('disconnect',()=>{
            console.log('Socket disconnected');
            setConnected(false);
        });
        socketInstance.on('connect_error',(err)=>{
            console.log('Socket connection error:',err);
            setConnected(false);
        });
        setSocket(socketInstance);

        //clean up on unmount
        return ()=>{
            console.log('Disconnecting socket');
            socketInstance.disconnect();
        };
    },[user]);
    //function to join a playlist room
    //emits 'join_playlist' event to the backend with the following data(playlistId,userId:user._id,username: user.name);
    const joinPlaylist=(playlistId)=>{
        if(socket && user && connected){
            socket.emit('join_playlist',{
                playlistId,
                userId:user._id,
                username: user.name
            });
        }
    }
    //function to emit add song event to backend
    const addSong=(playlistId,song)=>{
        if(socket && user && connected){
            socket.emit('add_song',{
                playlistId,
                song,
                userId:user._id,
                username:user.name
            });
        }
    }
    //function to leave a playlist room
    const leavePlaylist=(playlistId)=>{
        if(socket && user && connected){
            socket.emit('leave_playlist',{
                playlistId,
                userId:user._id
            });
        }
    }
    //function to emit add song event to backend
    const removeSong=(playlistId,songId)=>{
        if(socket && user && connected){
            socket.emit('remove_song',{
                playlistId,
                songId,
                userId:user._id,
                username:user.name
            });
        }
    }
    //function to emit add song event to backend
    const reorderSongs=(playlistId,newOrder)=>{
        if(socket && user && connected){
            socket.emit('reorder_songs',{
                playlistId,
                newOrder,
                userId:user._id,
                username:user.name
            });
        }
    }
    //Function to notify about collaborator accepted
    const notifyCollaboratorAdded=(playlistId, collaboratorId, collaboratorName)=>{
        if(socket && user && connected){
            console.log('Emitting collaborator_added event:',{
                playlistId,
                userId: user._id,
                username: user.name,
                collaboratorId,
                collaboratorName
            });
            socket.emit('collaborator_added',{
                playlistId,
                userId: user._id,
                username: user.name,
                collaboratorId,
                collaboratorName
            });
        }

    }
    //Function to notify about invitation accepted
    const notifyInvitationAccepted=(playlistId)=>{
        if(socket && user && connected){
            socket.emit('invitation_accepted',{
                playlistId,
                userId: user._id,
                username: user.name
            });
        }
    }
    const notifyCollaboratorRemoved=(playlistId, removedCollaboratorId, removedCollaboratorName)=>{
        if(socket && user && connected){
                console.log('Emitting collaborator_removed event:', {
                playlistId,
                userId: user._id,
                username: user.name,
                removedCollaboratorId,
                removedCollaboratorName
            });
            socket.emit('collaborator_removed',{
                playlistId,
                userId: user._id,
                username: user.name,
                removedCollaboratorId,
                removedCollaboratorName
            });
        }
    }

    const notifyPlaylistUpdate=()=>{
        if(socket && user && connected){
            socket.emit('playlist_updated',{
                userId:user._id,
                username:user.name
            });
        }
    }
    return(
        <SocketContext.Provider value={{socket,connected,joinPlaylist,leavePlaylist,addSong,removeSong,reorderSongs,notifyCollaboratorAdded,notifyInvitationAccepted,notifyCollaboratorRemoved,notifyPlaylistUpdate}}>
            {children}
        </SocketContext.Provider>
    )
}
export default SocketContext;