import { useCallback, useEffect, useState } from "react";
import * as playlistAPI from "../api/playlistAPI.js";
import useSocketEvents from "../hooks/useSocketEvents.js";

const CollaboratorsList = ({ playlistId, isOwner }) => {
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCollaborators = useCallback(async () => {
        try {
            const { collaborators: list } = await playlistAPI.fetchCollaborators(playlistId);
            setCollaborators(list);
            setError(null);
        } catch (fetchError) {
            setError(fetchError.message);
        } finally {
            setLoading(false);
        }
    }, [playlistId]);

    useEffect(() => {
        if (playlistId) fetchCollaborators();
    }, [playlistId, fetchCollaborators]);

    // Only react to events for the playlist this list is showing.
    const refreshIfSamePlaylist = (data) => {
        if (data.playlistId === playlistId) fetchCollaborators();
    };

    useSocketEvents({
        collaborator_added: refreshIfSamePlaylist,
        collaborator_removed: refreshIfSamePlaylist,
    });

    const removeCollaborator = async (userId) => {
        if (!isOwner) return;

        try {
            setLoading(true);
            // The server broadcasts collaborator_removed and evicts their
            // sockets; emitting from here as well produced a duplicate event.
            await playlistAPI.removeCollaborator({ playlistId, userId });
            setCollaborators((current) => current.filter((c) => c._id !== userId));
            setError(null);
        } catch (removeError) {
            setError(removeError.message);
        } finally {
            setLoading(false);
        }
    };

    // Same reason as InvitationsInbox: bailing on an empty list hid the error
    // that explains why the list is empty.
    if (collaborators.length === 0 && !loading && !error) {
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
                                {/* Email removed: the server no longer discloses other
                                    collaborators' addresses, and it should never have. */}
                                <div className="text-xs text-gray-400 font-light">Collaborator</div>
                            </div>
                        </div>
                        {isOwner && (
                            <button
                                className="text-red-400 hover:text-red-300 transition-colors duration-200 p-2 rounded-full hover:bg-white/10"
                                onClick={() => removeCollaborator(collaborator._id)}
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