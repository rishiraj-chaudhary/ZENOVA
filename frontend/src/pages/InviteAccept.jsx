import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { acceptInvitation } from "../api/playlistAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";

const REDIRECT_DELAY_MS = 2000;

const InviteAccept = () => {
    const { inviteCode } = useParams();
    const { user, loading: authLoading } = useAuth();
    const { joinPlaylist } = useSocket();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Wait for the session restore to finish before deciding the user is a
        // guest, otherwise a page refresh on this route bounces to login.
        if (authLoading) return undefined;

        if (!user) {
            sessionStorage.setItem("pendingInvite", inviteCode);
            navigate("/login");
            return undefined;
        }

        let redirectTimer;

        const join = async () => {
            try {
                const { playlistId } = await acceptInvitation(inviteCode);

                // The accept endpoint broadcasts to the room; the client only
                // needs to start listening to it.
                joinPlaylist(playlistId);

                sessionStorage.setItem("expandPlaylist", playlistId);
                redirectTimer = setTimeout(() => navigate("/playlist"), REDIRECT_DELAY_MS);
            } catch (joinError) {
                setError(joinError.message);
            } finally {
                setLoading(false);
            }
        };

        join();

        return () => clearTimeout(redirectTimer);
        // The socket helpers are stable for a given connection; re-running on
        // their identity would retry the invitation on every reconnect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inviteCode, user, authLoading, navigate]);

    if (!user) {
        return null; // Will redirect to login via useEffect
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-viewport bg-[#181818] text-white p-4">
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
