class SocketManager{
    constructor(io){
        this.io=io;
        this.rooms=new Map();//Map to track users in each playlist room
        this.initialize();
    }
    initialize(){
            this.io.on('connection',(socket)=>{
                console.log('A user connected:',socket.id);
    
            //handle joining a playlist room
            socket.on('join_playlist',(data)=>{
                const {playlistId,userId,username}=data;
                this.handleJoinPlaylist(socket,playlistId,userId,username);
            });
            socket.on('register_user', (data) => {
                const { userId } = data;
                if (userId) {
                    socket.join(`user:${userId}`);
                    console.log(`Socket ${socket.id} joined user room user:${userId}`);
                }
            });

            //Handle leaving a playlist room
            socket.on('leave_playlist',(data)=>{
                const {playlistId,userId}=data;
                this.handleLeavePlaylist(socket,playlistId,userId);
            });
            //handle adding a song to playlist
            socket.on('add_song',(data)=>{
                const {playlistId,song,userId,username}=data;
                this.handleAddSong(socket,playlistId,song,userId,username);
            });
            //handle removing a song from playlist
            socket.on('remove_song',(data)=>{
                const {playlistId,songId,userId,username}=data;
                this.handleRemoveSong(socket,playlistId,songId,userId,username);
            });
            //handle reordering songs
            socket.on('reorder_songs',(data)=>{
                const { playlistId, newOrder, userId, username } = data;
                this.handleReorderSongs(socket, playlistId, newOrder, userId, username);
            });
            //Handle collaborator added event
            socket.on('collaborator_added',(data)=>{
                const {playlistId,userId,username,collaboratorId,collaboratorName}=data;
                this.handleCollaboratorAdded(socket,playlistId,userId,username,collaboratorId,collaboratorName);
            })
            //Handle accepting invite
            socket.on('invitation_accepted',(data)=>{
                const { playlistId, userId, username } = data;
                this.handleInvitationAccepted(socket, playlistId, userId, username);
            })
            //Handle removing a collaborator
            socket.on('collaborator_removed',(data)=>{
                const {playlistId, userId, username, removedCollaboratorId, removedCollaboratorName}=data;
                this.handleCollaboratorRemoved(socket, playlistId, userId, username, removedCollaboratorId, removedCollaboratorName);
            })
            //Handle playlist updated
            socket.on('playlist_updated',(data)=>{
                const { playlistId, userId, username } = data;
                this.handlePlaylistUpdated(socket, playlistId, userId, username);
            });
            
            //Handle disconnection
            socket.on('disconnect',()=>{
                this.handleDisconnect(socket);
            });

        });
    }

    handlePlaylistUpdated(socket,playlistId,userId,username){
        const roomId=`playlist:${playlistId}`;
            //Add user to the room tracking
            if(!this.rooms.has(roomId)){
                this.rooms.set(roomId,new Map());
            }
            this.rooms.get(roomId).set(userId,{
                socketId:socket._id,
                username
            });
            //Get all users in the room
            const usersInRoom=Array.from(this.rooms.get(roomId).entries()).map(([id,data])=>({
                userId:id,
                username:data.username
            }));

            //Broadcast to everyone in the room that someone has joined
            this.io.to(roomId).emit('playlist_updated',{
                userId,
                username,
                users: usersInRoom,
            });
    }
    emitToUser(userId, event, data) {
        const userRoom = `user:${userId}`;
        this.io.to(userRoom).emit(event, data);
        console.log(`Emitted ${event} to user ${userId}:`, data);
    }


    handleCollaboratorRemoved(socket, playlistId, userId, username, removedCollaboratorId, removedCollaboratorName){
        const roomId=`playlist:${playlistId}`;
        //Broadcast to everyone in the room that a collaborator was removed
        this.io.to(roomId).emit('collaborator_removed',{
            playlistId,
            removedCollaborator: {
                userId: removedCollaboratorId,
                username: removedCollaboratorName
            },
            removedBy: {
                userId,
                username
            }
        });

        console.log(`User ${username} (${userId}) removed ${removedCollaboratorName} as collaborator from playlist ${playlistId}`);
    }


    handleCollaboratorAdded(socket, playlistId, userId, username, collaboratorId, collaboratorName){
        const roomId=`playlist:${playlistId}`;
        //Broadcast to everyone in the room that a collaborator was added
        this.io.to(roomId).emit('collaborator_added',{
            playlistId,
            collaborator: {
                userId: collaboratorId,
                username: collaboratorName
            },
            addedBy: {
                userId,
                username
            }
        });
        console.log(`User ${username} (${userId}) added ${collaboratorName} as collaborator to playlist ${playlistId}`);
    }
    
    handleJoinPlaylist(socket,playlistId,userId,username){
        const roomId=`playlist:${playlistId}`;

        //Joing the socket to the room
        socket.join(roomId);
        //Store the user data in socket for easy access
        socket.userData={
            currentRoom: roomId,
            userId,
            username
        };
        //Track users in the room
        if(!this.rooms.has(roomId)){
            this.rooms.set(roomId,new Map());
        }
        this.rooms.get(roomId).set(userId,{
            socketId:socket.id,
            username
        });

        //Get all users in the room
        const usersInRoom=Array.from(this.rooms.get(roomId).entries()).map(([id,data])=>({
            userId:id,
            username:data.username
        }));
        //Broadcast to everyone in the room that someone has joined the room
        this.io.to(roomId).emit('user_joined',{
            userId,
            username,
            users:usersInRoom
        });
        console.log(`User ${username} (${userId}) joined playlist ${playlistId}`);
    }


        handleLeavePlaylist(socket,playlistId,userId){
            const roomId=`playlist:${playlistId}`;
            //Remove user from the room tracking
            if(this.rooms.has(roomId)){
                const username=this.rooms.get(roomId).get(userId)?.username;
                this.rooms.get(roomId).delete(userId);

                //If room is empty, remove it
                if(this.rooms.get(roomId).size===0){
                    this.rooms.delete(roomId);
                }else{
                    //Get remaining users
                    const usersInRoom=Array.from(this.rooms.get(roomId).entries()).map(([id,data])=>({
                        userId:id,
                        username:data.username
                    }));
                
                    //Notify others that user left
                    this.io.to(roomId).emit('user_left',{
                        userId,
                        username,
                        users:usersInRoom
                    })
                }
            }
            //Leave the socket room
            socket.leave(roomId);
            socket.userData=null;
            console.log(`User ${userId} left playlist ${playlistId}`);
        }

        handleDisconnect(socket){
            console.log('User disconnected: ',socket.id);
            //If user was in a playlist room, handle leaving
            if(socket.userData){
                const {currentRoom,userId,username}=socket.userData;
                const playlistId=currentRoom.split(':')[1];
                if(this.rooms.has(currentRoom)){
                    this.rooms.get(currentRoom).delete(userId);

                    //If room get empty --> remove it
                    if(this.rooms.get(currentRoom).size===0){
                        this.rooms.delete(currentRoom);
                    }else{
                        //get remaining users
                        const usersInRoom=Array.from(this.rooms.get(currentRoom).entries()).map(([id,data])=>({
                            userId:id,
                            username:data.username
                        }));

                        //notify them that user has left
                        this.io.to(currentRoom).emit('user_left',{
                            userId,
                            username,
                            users:usersInRoom
                        });
                    }
                }
            }
        }
        
        handleAddSong(socket, playlistId, song, userId, username){
            const roomId=`playlist:${playlistId}`;
            //broadcast to everyone that song has been added
            this.io.to(roomId).emit('song_added',{
                playlistId,
                song,
                addedBy: {
                    userId,
                    username
                }
            })
            console.log(`User ${username} (${userId}) added a song to playlist ${playlistId}`);
        }

        handleRemoveSong(socket, playlistId, songId, userId, username){
            const roomId=`playlist:${playlistId}`;
            //broadcast to everyone that song has been removed
            this.io.to(roomId).emit('song_removed',{
                playlistId,
                songId,
                removedBy: {
                    userId,
                    username
                }
            });
            console.log(`User ${username} (${userId}) removed a song from playlist ${playlistId}`);
        }
        handleReorderSongs(socket, playlistId, newOrder, userId, username){
            const roomId=`playlist:${playlistId}`;
            //broadcast to everyone that song has been removed
            this.io.to(roomId).emit('songs_reordered',{
                playlistId,
                newOrder,
                reorderedBy: {
                    userId,
                    username
                }
            });
            console.log(`User ${username} (${userId}) reordered songs in playlist ${playlistId}`);
        }

        handleInvitationAccepted(socket,playlistId,userId,username){
            const roomId=`playlist:${playlistId}`;
            //Add user to the room tracking
            if(!this.rooms.has(roomId)){
                this.rooms.set(roomId,new Map());
            }
            this.rooms.get(roomId).set(userId,{
                socketId:socket._id,
                username
            });
            //Get all users in the room
            const usersInRoom=Array.from(this.rooms.get(roomId).entries()).map(([id,data])=>({
                userId:id,
                username:data.username
            }));

            //Broadcast to everyone in the room that someone has joined
            this.io.to(roomId).emit('user_joined',{
                userId,
                username,
                users: usersInRoom,
                joinedVia: 'invitation'
            });
            console.log(`User ${username} (${userId}) accepted invitation to playlist ${playlistId}`);
        }
}
export default SocketManager;