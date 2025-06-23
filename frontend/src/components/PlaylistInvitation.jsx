// import { useState } from 'react';
// const PlaylistInvitation=({playlistId,playlistName,isOwner})=>{
//     const [username, setUsername] = useState('');
//     const [inviteLink, setInviteLink] = useState('');
//     const [qrCode, setQrCode] = useState('');
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
//     const [success, setSuccess] = useState(null);
//     const [activeTab, setActiveTab] = useState('username');//handles the method of invitation (link,qr,username)--> default is username
//     const getAuthHeaders=()=>({
//         'Content-type':'application/json',
//         'Authorization':`Bearer ${sessionStorage.getItem('token') || ''}`
//     });
//     //Invite by username
//     const inviteByUsername=async(e)=>{
//         e.preventDefault();
//         if(!username.trim()){//trim--> removes leading or trailing white spaces from a string
//             return;
//         }
//         try{
//             setLoading(true);
//             setError(null);
//             const response=await fetch('http://localhost:3000/api/playlists/invite/username',{
//                 method:'POST',
//                 headers: getAuthHeaders(),
//                 body: JSON.stringify({playlistId,username})
//             });
//             if(!response.ok){//built in boolean in response object (true when value is 200-299)
//                 const errorData=await response.json();
//                 throw new Error(errorData.message || 'Failed to generate invite link');
//             }
//             const data=await response.json();
//             setSuccess(`Invited ${username} successfully`);
//             setUsername('');
//             setTimeout(()=> setSuccess(null),3000);
//         }catch(err){
//             setError(err.message || 'Failed to invite user');
//         }finally{
//             setLoading(false);
//         }
//     };
//     //Generate invite link
//     const generateLink=async()=>{
//         try{
//             setLoading(true);
//             setError(null);
//             const response=await fetch(`http://localhost:3000/api/playlists/invite/link/${playlistId}`,{
//                 method:'POST',
//                 headers: getAuthHeaders()
//             });
//             if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(errorData.message || 'Failed to generate invite link');
//             }
//             const data=await response.json();
//             setInviteLink(data.inviteLink);
//             setQrCode('');//Clear QR when generating new invite link
            
//         }catch(err){
//             setError(err.message || 'Failed to generate invite link');
//         }finally{
//             setLoading(false);
//         }
//     }

//     //Generate QR code
//     const generateQR=async()=>{
//         try{
//             setLoading(true);
//             setError(null);
//             const response=await fetch(`http://localhost:3000/api/playlists/invite/qr/${playlistId}`,{
//                 method:'POST',
//                 headers:getAuthHeaders()
//             });
//             if(!response.ok){
//                 const errorData=await response.json();
//                 throw new Error(errorData.message || 'Failed to generate QR code');
//             }
//             const data = await response.json();
//             setInviteLink(data.inviteLink);
//             setQrCode(data.qrCode);
//         }catch(err){
//             setError(err.message || 'Failed to generate QR code');
//         }finally{
//             setLoading(false);
//         }
//     }

//     //Copy to clipboard
//     const copyToClipboard=()=>{
//         navigator.clipboard.writeText(inviteLink)
//             .then(()=>{
//                 setSuccess('Link copied to clipboard!');
//                 setTimeout(()=> setSuccess(null),3000);
//             })
//             .catch(()=>{
//                 setError('Failed to copy to link');
//             })
//     }
//     if(!isOwner){
//         return;//Only show invitation options to owner of the playlist
//     }
//     return (
//         <div className="mt-4 bg-[#2a2a2a] rounded-md p-4">
//             <h3 className="text-lg font-semibold mb-3">
//                 Invite Collaborators
//             </h3>
//             {error && (
//                 <div className="bg-red-900 text-red-200 p-2 rounded mb-3">
//                     {error}
//                 </div>
//             )}
//             {success && (
//                 <div className="bg-green-900 text-green-200 p-2 rounded mb-3">
//                     {success}
//                 </div>
//             )}
//             <div className="flex border-b border-[#444] mb-4">
//                 <button className={`py-2 px-4 ${activeTab === 'username' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`} 
//                         onClick={()=> setActiveTab('username')}
//                 >
//                     By Username

//                 </button>
//                 <button
//                     className={`py-2 px-4 ${activeTab === 'link' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
//                     onClick={() => setActiveTab('link')}
//                 >
//                     Invite Link
//                 </button>
//                 <button
//                     className={`py-2 px-4 ${activeTab === 'qr' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
//                     onClick={() => setActiveTab('qr')}
//                 >
//                     QR Code
//                 </button>
//             </div>

//             {activeTab === 'username' && (
//                 <form onSubmit={inviteByUsername} className="mb-4">
//                     <div className="flex gap-2">
//                         <input type='text' value={username} onChange={(e)=> setUsername(e.target.value)} placeholder='Enter username' className="flex-grow p-2 bg-[#333] text-white rounded focus:ring-2 focus:ring-blue-400 outline-none" required/>
//                         <button type='submit' disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" >
//                             {loading ? 'Sending...' :'Invite'}
//                         </button>
//                     </div>
//                 </form>
//             )}
//             {activeTab==='link' && (
//                 <div className="mb-4">
//                     {inviteLink? (
//                         <div className="space-y-3">
//                             <div className="flex gap-2">
//                                 <input type='text' value={inviteLink} readOnly className="flex-grow p-2 bg-[#333] text-white rounded focus:ring-2 focus:ring-blue-400 outline-none"/>
//                                 <button onClick={copyToClipboard} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
//                                     Copy
//                                 </button>
//                             </div>
//                             <p className="text-sm text-gray-400">
//                                 This link expires in 7 days. Anyone with this link can join your playlist.
//                             </p>
//                             <button onClick={generateLink} disabled={loading} className="text-sm text-blue-400 hover:text-blue-300">
//                                 Generate new link
//                             </button>
//                         </div>
//                     ) : (
//                         <div className="text-center">
//                             <p className="mb-3 text-gray-300">
//                                 Generate a link to invite others to collaborate on '{playlistName}'
//                             </p>
//                             <button onClick={generateLink} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
//                                 {loading ? 'Generating...' : 'Generate Invite Link'}
//                             </button>
//                         </div>
//                     )}
//                 </div>
//             )}
//             {activeTab === 'qr' && (
//                 <div className="mb-4">
//                     {qrCode ? (
//                         <div className="space-y-3 flex flex-col items-center">
//                             <img src={qrCode} alt='Invitation QR Code' className="w-48 h-48"/>
//                             <p className="text-sm text-gray-400"> Scan this QR code to join the playlist</p>
//                             <button onClick={generateQR} disabled={loading} className="text-sm text-blue-400 hover:text-blue-300" >
//                                 Generate new QR Code
//                             </button>
//                         </div>
//                     ) : (
//                         <div className="text-center">
//                             <p className="mb-3 text-gray-300">
//                                 Generate a QR code to invite others to '{playlistName}'
//                             </p>
//                             <button onClick={generateQR} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
//                                 {loading ? 'Generating...' : 'Generate new QR Code'}

//                             </button>
//                         </div>
//                     )}
//                 </div>
//             )}

//         </div>
//     )

// }
// export default PlaylistInvitation;

import { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const PlaylistInvitation = ({ playlistId, playlistName, isOwner }) => {
    const {user} =useContext(AuthContext);
    const {socket,notifyCollaboratorAdded} =useSocket();
    const [username, setUsername] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState('username');
    
    const getAuthHeaders = () => ({
        'Content-type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token') || ''}`
    });
    
    // Invite by username
    const inviteByUsername = async (e) => {
        e.preventDefault();
        if (!username.trim()) {
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('http://localhost:3000/api/playlists/invite/username', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ playlistId, username })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to invite user');
            }
            const data = await response.json();
            //Emit socket event for real-time notification
            // if(socket && data.collaborator && data.collaborator._id){
            //     console.log('Emitting collaborator_added event:',{
            //         playlistId,
            //         userId: user._id,
            //         username: user.name,
            //         collaboratorId: data.collaborator._id,
            //         collaboratorName: data.collaborator.name
            //     });
            //     socket.emit('collaborator_added',{
            //         playlistId,
            //         userId: user._id,
            //         username: user.name,
            //         collaboratorId: data.collaborator._id,
            //         collaboratorName: data.collaborator.name
            //     });
            // }
            //Emit socket event for real time notification
            if(data.collaborator && data.collaborator._id){
                notifyCollaboratorAdded(playlistId,data.collaborator._id,data.collaborator.name);
            }
            console.log('User invited from frontend:',username);
            setSuccess(`Invited ${username} successfully`);
            setUsername('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message || 'Failed to invite user');
        } finally {
            setLoading(false);
        }
    };
    
    // Generate invite link
    const generateLink = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`http://localhost:3000/api/playlists/invite/link/${playlistId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate invite link');
            }
            const data = await response.json();
            setInviteLink(data.inviteLink);
            setQrCode('');
        } catch (err) {
            setError(err.message || 'Failed to generate invite link');
        } finally {
            setLoading(false);
        }
    };

    // Generate QR code
    const generateQR = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`http://localhost:3000/api/playlists/invite/qr/${playlistId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate QR code');
            }
            const data = await response.json();
            setInviteLink(data.inviteLink);
            setQrCode(data.qrCode);
        } catch (err) {
            setError(err.message || 'Failed to generate QR code');
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteLink)
            .then(() => {
                setSuccess('Link copied to clipboard!');
                setTimeout(() => setSuccess(null), 3000);
            })
            .catch(() => {
                setError('Failed to copy link');
            });
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
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            className="flex-grow p-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all duration-300 text-sm shadow-inner"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg hover:scale-103 transition-all duration-300 shadow-md hover:shadow-purple-500/30 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending...' : 'Invite'}
                        </button>
                    </div>
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
