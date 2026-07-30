import { useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import useSocketEvents from "../hooks/useSocketEvents.js";

const PresenceIndicator = ({ playlistId }) => {
    const { joinPlaylist } = useSocket();
    const [activeUsers, setActiveUsers] = useState([]);

    // The server sends the full roster with join/leave events, so it is the
    // authoritative list; collaborator events only adjust it optimistically.
    const replaceRoster = (data) => setActiveUsers(data.users ?? []);

    useSocketEvents({
        user_joined: replaceRoster,
        user_left: replaceRoster,

        collaborator_added: ({ collaborator }) => {
            if (!collaborator?.userId) return;

            setActiveUsers((current) =>
                current.some((entry) => entry.userId === collaborator.userId)
                    ? current
                    : [...current, collaborator]
            );
            joinPlaylist(playlistId);
        },

        collaborator_removed: ({ removedCollaborator }) => {
            if (!removedCollaborator?.userId) return;

            setActiveUsers((current) =>
                current.filter((entry) => entry.userId !== removedCollaborator.userId)
            );
            joinPlaylist(playlistId);
        },
    });

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