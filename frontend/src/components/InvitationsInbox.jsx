import { useCallback, useEffect, useState } from "react";
import * as playlistAPI from "../api/playlistAPI.js";
import useSocketEvents from "../hooks/useSocketEvents.js";

/**
 * Playlist invitations awaiting a decision.
 *
 * Being invited used to mean being added: the playlist simply appeared in your
 * list. Now it waits here until you answer.
 */
const InvitationsInbox = ({ onAccepted }) => {
    const [invitations, setInvitations] = useState([]);
    const [respondingTo, setRespondingTo] = useState(null);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const { invitations: list } = await playlistAPI.fetchPendingInvitations();
            setInvitations(list ?? []);
        } catch (fetchError) {
            setError(fetchError.message);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // The invite lands on the recipient's personal room, so it shows up without
    // a reload.
    useSocketEvents({ invitation_received: refresh });

    const respond = async (invitationId, accept) => {
        setRespondingTo(invitationId);
        try {
            await playlistAPI.respondToInvitation({ invitationId, accept });
            setInvitations((current) => current.filter((i) => i._id !== invitationId));
            setError(null);
            if (accept) onAccepted?.();
        } catch (responseError) {
            setError(responseError.message);
        } finally {
            setRespondingTo(null);
        }
    };

    // The early return used to come first, so a failed load set an error that
    // could never render: the list is empty precisely when loading failed.
    if (invitations.length === 0 && !error) return null;

    return (
        <div className="mb-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-md border border-purple-700/20 rounded-2xl shadow-lg p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <i className="fa-solid fa-envelope-open-text text-purple-300" />
                Playlist invitations
                <span className="text-xs bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full">
                    {invitations.length}
                </span>
            </h3>

            {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

            <ul className="space-y-3">
                {invitations.map((invitation) => (
                    <li
                        key={invitation._id}
                        className="flex flex-wrap items-center justify-between gap-3 bg-black/20 rounded-xl px-4 py-3"
                    >
                        <div className="min-w-0">
                            <p className="text-white truncate">
                                {invitation.playlistId?.name ?? "A playlist"}
                            </p>
                            <p className="text-purple-200/70 text-sm">
                                from {invitation.invitedByUserId?.name ?? "someone"}
                                {invitation.playlistId?.songs?.length
                                    ? ` · ${invitation.playlistId.songs.length} songs`
                                    : ""}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={respondingTo === invitation._id}
                                onClick={() => respond(invitation._id, true)}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm"
                            >
                                Accept
                            </button>
                            <button
                                type="button"
                                disabled={respondingTo === invitation._id}
                                onClick={() => respond(invitation._id, false)}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm"
                            >
                                Decline
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default InvitationsInbox;
