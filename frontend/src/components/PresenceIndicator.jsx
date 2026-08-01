import { useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import useSocketEvents from "../hooks/useSocketEvents.js";

const PresenceIndicator = ({ playlistId }) => {
    const { joinPlaylist } = useSocket();
    const [activeUsers, setActiveUsers] = useState([]);
    const [denied, setDenied] = useState(false);

    // The server sends the full roster with join/leave events, so it is the
    // authoritative list; collaborator events only adjust it optimistically.
    const replaceRoster = (data) => setActiveUsers(data.users ?? []);

    useSocketEvents({
        user_joined: replaceRoster,
        user_left: replaceRoster,

        // Being added as a collaborator is not the same as being in the room.
        // Inserting them here showed people under "Who's Listening" who had
        // never opened the playlist, until the next real roster event corrected
        // it. Re-joining is enough: the server answers with the true roster.
        collaborator_added: () => joinPlaylist(playlistId),

        collaborator_removed: ({ removedCollaborator }) => {
            if (!removedCollaborator?.userId) return;

            // Removal is immediate — the server has already evicted their
            // sockets — so dropping them locally avoids showing a ghost.
            setActiveUsers((current) =>
                current.filter((entry) => entry.userId !== removedCollaborator.userId)
            );
            joinPlaylist(playlistId);
        },

        // The server refuses rooms the user is not a member of. Nothing
        // listened for it, so a denied join looked identical to an empty room.
        join_denied: (data) => {
            if (data.playlistId !== playlistId) return;
            setDenied(true);
        },
    });

    if (denied) {
        return (
            <div className="relative my-10 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-100 max-w-3xl w-full mx-auto">
                You no longer have access to this playlist&apos;s live session.
            </div>
        );
    }

    return (
        <div className="relative my-10 p-8 rounded-2xl bg-gradient-to-br from-[#1DB954]/20 to-[#191414]/30 backdrop-blur-xl border border-white/10 text-white max-w-3xl w-full mx-auto shadow-2xl transition-all duration-500">
          <h3 className="text-xl font-bold mb-6 text-[#1DB954] tracking-wide uppercase">
            Who&apos;s Listening ({activeUsers.length})
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