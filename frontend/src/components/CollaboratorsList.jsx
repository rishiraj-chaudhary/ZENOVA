import { useCallback, useContext, useEffect, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
const CollaboratorsList=({playlistId,isOwner})=>{
    const [collaborators,setCollaborators]=useState([]);
    const [loading,setLoading]=useState(true);
    const {user} =useContext(AuthContext);
    const {socket,notifyCollaboratorRemoved}=useSocket();
    const [error, setError] = useState(null);
    const getAuthHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || ''}`
    }), []);
    //Fetch Collaborators
    const fetchCollaborators=useCallback(async()=>{
        try{
            setLoading(true);
            const response=await fetch(`http://localhost:3000/api/playlists/${playlistId}/collaborators`,{
                headers:getAuthHeaders()
            });
            if(!response.ok){
                throw new Error('Failed to fetch collaborators');
            }
            const data=await response.json();
            setCollaborators(data.collaborators || []);
            setError(null);
        }catch(err){
            setError('Failed to load collaborators')
            console.log(err);
        }finally{
            setLoading(false);
        }
    },[playlistId,getAuthHeaders]);

    //Remove a collaborator
    const removeCollaborator= async(userId,username)=>{
        if(!isOwner){
            return;
        }
        try{
            setLoading(true);
            const response=await fetch(`http://localhost:3000/api/playlists/${playlistId}/collaborators/${userId}`,{
                method:'DELETE',
                headers: getAuthHeaders()
            });
            if(!response.ok){
                throw new Error('Failed to remove collaborator');
            }
            //Emit socket event
            notifyCollaboratorRemoved(playlistId,userId,username);
            setCollaborators(collaborators.filter(c=> c._id !==userId));
            setError(null);
        }catch(err){
            setError('Failed to remove collaborator');
        }finally{
            setLoading(false);
        }
    }
    
    //Listen for socket events
    useEffect(()=>{
        if(!socket){
            return;
        }
        const handleCollaboratorAdded=(data)=>{
            if(data.playlistId===playlistId){
                console.log('Collaborator added event received');
                fetchCollaborators();
            }
        };
        const handleCollaboratorRemoved=(data)=>{
            if (data.playlistId === playlistId) {
                console.log('Collaborator removed event received');
                fetchCollaborators();
            }
        }

        socket.on('collaborator_added', handleCollaboratorAdded);
        socket.on('collaborator_removed', handleCollaboratorRemoved);

        return () => {
            socket.off('collaborator_added', handleCollaboratorAdded);
            socket.off('collaborator_removed', handleCollaboratorRemoved);
        };

        
    },[socket,playlistId,fetchCollaborators]);

    //Fetch all collaborators on mount and when playlistId changes
    useEffect(() => {
        if (playlistId) {
            fetchCollaborators();
        }
    }, [playlistId,fetchCollaborators]);

    if(collaborators.length===0 && !loading){
        return null;
    }
    return (
    <div className="mt-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-md border border-purple-700/20 rounded-2xl shadow-lg p-5 animate-fade-in-up relative">
        {/* Decorative top border */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 opacity-60 rounded-t-2xl"></div>

        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <i className="fa-solid fa-users-line text-purple-400 mr-2 text-sm"></i> Collaborators
        </h3>
        {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-md mb-3 animate-fade-in text-xs">
                <i className="fa-solid fa-exclamation-triangle mr-1 text-red-300 text-xs"></i> {error}
            </div>
        )}
        {loading ? (
            <div className="flex flex-col justify-center items-center text-gray-400 py-4">
                <i className="fa-solid fa-sync fa-spin text-xl mb-2 text-purple-300"></i>
                <p className="text-sm">Loading collaborators...</p>
            </div>
        ) : collaborators.length === 0 ? (
            <div className="text-gray-400 text-center py-4 bg-white/5 border border-white/10 rounded-lg shadow-inner text-sm font-light">
                <i className="fa-solid fa-user-slash text-2xl mb-2 text-purple-300"></i>
                <p>No collaborators yet. Share your playlist!</p>
            </div>
        ) : (
            <ul className="space-y-3">
                {collaborators.map((collaborator) => (
                    <li
                        key={collaborator._id}
                        className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg shadow-sm transition-all duration-300 hover:bg-white/10 hover:scale-[1.005]"
                    >
                        <div className="flex items-center">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center text-white font-bold text-sm mr-3 shadow-md ring-1 ring-blue-500/30">
                                {collaborator.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-white">{collaborator.name}</div>
                                <div className="text-xs text-gray-400 font-light">{collaborator.email}</div>
                            </div>
                        </div>
                        {isOwner && (
                            <button
                                className="text-red-400 hover:text-red-300 transition-colors duration-200 p-2 rounded-full hover:bg-white/10"
                                onClick={() => removeCollaborator(collaborator._id, collaborator.name)}
                                title={`Remove ${collaborator.name}`}
                            >
                                <i className="fa-solid fa-user-minus text-sm"></i>
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </div>
);
}
export default CollaboratorsList;