import { useState } from "react";
import * as playlistAPI from "../api/playlistAPI.js";
import useUserSearch from "../hooks/useUserSearch.js";

const FEEDBACK_TIMEOUT_MS = 3000;

const PlaylistInvitation = ({ playlistId, playlistName, isOwner }) => {

    const [username, setUsername] = useState("");
    const [inviteLink, setInviteLink] = useState("");
    const [qrCode, setQrCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState("username");
    const { results: userResults, searching } = useUserSearch(username);

    const announce = (message) => {
        setSuccess(message);
        setTimeout(() => setSuccess(null), FEEDBACK_TIMEOUT_MS);
    };

    // All three invite actions share the same loading/error handling.
    const runInviteAction = async (action) => {
        setLoading(true);
        setError(null);

        try {
            await action();
        } catch (actionError) {
            setError(actionError.message);
        } finally {
            setLoading(false);
        }
    };

    const inviteByUsername = (event) => {
        event.preventDefault();
        if (!username.trim()) return undefined;

        return runInviteAction(async () => {
            await playlistAPI.inviteByUsername({ playlistId, username });

            announce(`Invited ${username} successfully`);
            setUsername("");
        });
    };

    const generateLink = () =>
        runInviteAction(async () => {
            const { inviteLink: link } = await playlistAPI.generateInviteLink(playlistId);
            setInviteLink(link);
            setQrCode("");
        });

    const generateQR = () =>
        runInviteAction(async () => {
            const { inviteLink: link, qrCode: code } =
                await playlistAPI.generateInviteQR(playlistId);
            setInviteLink(link);
            setQrCode(code);
        });

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            announce("Link copied to clipboard!");
        } catch {
            setError("Failed to copy link");
        }
    };

    if (!isOwner) {
        return null;
    }
    
    return (
        <div className="mt-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-md border border-purple-700/20 rounded-2xl shadow-lg p-5 mb-5 animate-fade-in-up relative">
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 opacity-60 rounded-t-2xl"></div>

            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <i className="fa-solid fa-user-plus text-purple-400 mr-2 text-sm"></i> Invite Collaborators
            </h3>
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-md mb-3 animate-fade-in text-xs">
                    <i className="fa-solid fa-exclamation-triangle mr-1 text-red-300 text-xs"></i> {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-200 p-3 rounded-md mb-3 animate-fade-in text-xs">
                    <i className="fa-solid fa-check-circle mr-1 text-green-300 text-xs"></i> {success}
                </div>
            )}
            <div className="flex border-b border-white/10 mb-4">
                <button
                    className={`py-2 px-4 text-sm font-medium transition-colors duration-300 ${activeTab === 'username' ? 'border-b-2 border-purple-500 text-purple-300' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={() => setActiveTab('username')}
                >
                    By Username
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium transition-colors duration-300 ${activeTab === 'link' ? 'border-b-2 border-purple-500 text-purple-300' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={() => setActiveTab('link')}
                >
                    Invite Link
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium transition-colors duration-300 ${activeTab === 'qr' ? 'border-b-2 border-purple-500 text-purple-300' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={() => setActiveTab('qr')}
                >
                    QR Code
                </button>
            </div>

            {activeTab === 'username' && (
                <form onSubmit={inviteByUsername} className="mb-4 animate-fade-in">
                    <label htmlFor="invite-username" className="sr-only">
                        Search for a collaborator by name
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            id="invite-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Start typing a name…"
                            autoComplete="off"
                            className="flex-grow p-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-300 text-sm shadow-inner"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-3 sm:py-2 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg transition-all duration-300 shadow-md font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending…' : 'Invite'}
                        </button>
                    </div>

                    {searching && (
                        <p className="mt-2 text-xs text-gray-400">Searching…</p>
                    )}

                    {userResults.length > 0 && (
                        <ul className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/30 p-1">
                            {userResults.map((candidate) => (
                                <li key={candidate._id}>
                                    <button
                                        type="button"
                                        onClick={() => setUsername(candidate.name)}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                    >
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">
                                            {candidate.name.charAt(0).toUpperCase()}
                                        </span>
                                        {candidate.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </form>
            )}
            
            {activeTab === 'link' && (
                <div className="mb-4 animate-fade-in">
                    {inviteLink ? (
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={inviteLink}
                                    readOnly
                                    className="flex-grow p-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all duration-300 text-sm shadow-inner"
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className="px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg hover:scale-103 transition-all duration-300 shadow-md hover:shadow-blue-500/30 font-semibold text-sm"
                                >
                                    Copy
                                </button>
                            </div>
                            <p className="text-sm text-gray-400 font-light">
                                This link expires in 7 days. Anyone with this link can join your playlist.
                            </p>
                            <button
                                onClick={generateLink}
                                disabled={loading}
                                className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate new link
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-lg shadow-inner">
                            <p className="mb-3 text-gray-300 text-sm">
                                Generate a link to invite others to collaborate on '<span className="font-semibold text-purple-300">{playlistName}</span>'
                            </p>
                            <button
                                onClick={generateLink}
                                disabled={loading}
                                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:scale-103 transition-all duration-300 shadow-md hover:shadow-green-500/20 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Generating...' : 'Generate Invite Link'}
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'qr' && (
                <div className="mb-4 animate-fade-in">
                    {qrCode ? (
                        <div className="space-y-4 flex flex-col items-center p-4 bg-white/5 border border-white/10 rounded-lg shadow-inner">
                            <img src={qrCode} alt="Invitation QR Code" className="w-48 h-48 rounded-lg shadow-md border border-white/10 p-2 bg-white"/>
                            <p className="text-sm text-gray-400 font-light">Scan this QR code to join the playlist.</p>
                            <button
                                onClick={generateQR}
                                disabled={loading}
                                className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate new QR Code
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-white/5 border border-white/10 rounded-lg shadow-inner">
                            <p className="mb-3 text-gray-300 text-sm">
                                Generate a QR code to invite others to '<span className="font-semibold text-purple-300">{playlistName}</span>'
                            </p>
                            <button
                                onClick={generateQR}
                                disabled={loading}
                                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:scale-103 transition-all duration-300 shadow-md hover:shadow-green-500/20 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Generating...' : 'Generate QR Code'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PlaylistInvitation;
