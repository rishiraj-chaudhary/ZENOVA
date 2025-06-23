import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Chatbot from '../components/Chatbot.jsx';
import AuthContext from '../context/AuthContext';
const Profile=()=>{
  const {user,logout}=useContext(AuthContext);
  const navigate = useNavigate();
  const[preferences,setPreferences]=useState('');
  const[isDragging,setIsDragging]=useState(false);
  const[position,setPosition]=useState({x:window.innerWidth-80,y:window.innerHeight-80});
  const[isOpen,setIsOpen]=useState(false);

  const startDrag=()=>{
    setIsDragging(true);
  }
  const handlePlayOnYouTube = () => {
    navigate('/music', { state: { title: song.title, artist: song.artist, url: song.url } });
  };
  const handleSavePreferences = async () => {
    if (!user) {
      alert('Please login to save your preferences');
      return;
    }
    
    const token = localStorage.getItem("token");
    console.log("Token:", token); // Check if token exists
    
    try {
      console.log("Making request to:", "http://localhost:5000/api/users/preferences");
      console.log("With data:", { preferences });
      
      const response = await fetch("http://localhost:3000/api/users/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ preferences })
      });
      
      const data = await response.json();
      console.log("Response:", data);
      
      if (response.ok) {
        alert('Preferences saved successfully');
      } else {
        alert(data.message || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Error details:', error);
      alert('Error saving preferences. Please check the console for details.');
    }
  };
  const onDrag=(event)=>{
    if(isDragging){
      setPosition({
        x:event.clientX,
        y:event.clientY
      });
    }
  }
  const handlePreferencesChange = (e) => {
    setPreferences(e.target.value);
  }
  const stopDrag=()=>{
    setIsDragging(false);
  }
  const handleProfileToggle=()=>{
    setIsOpen(!isOpen);
  }
  return (
    <div className='relative' onMouseMove={onDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag}>
      {/* Chatbot */}
      <Chatbot/>
      {/* draggable button */}
      <button className="fixed bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors cursor-grab"
      style={{top: `${position.y}px`,
      left: `${position.x}px`,
      zIndex: 1000,}}
      onMouseDown={startDrag}
      // onMouseMove={onDrag}
      // onMouseUp={stopDrag}
      // onMouseLeave={stopDrag}
      onClick={handleProfileToggle}
      >
        <i className="fa-solid fa-user"></i>
      </button>
      {/* Profile window only open when isOpen is true */}
      {isOpen && (
        <div className="fixed bg-gray-800 p-5 rounded-lg shadow-lg w-80 text-white z-50"
        style={{
          top: `${position.y + 60}px`, // Adjust position near the button
          left: `${position.x - 90}px`, // Align window near the button
        }}
        >
          <h2 className="text-xl font-semibold">Profile</h2>
          {user ? (
            <div className="mt-4">
              <h3 className="font-bold text-lg">{user.name || 'User'}</h3>
              <p className="text-sm text-gray-400">{user.email || 'No email'}</p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Music Preferences 
                </label>
                <textarea
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
                  rows="3"
                  value={preferences}
                  onChange={handlePreferencesChange}
                  placeholder="What kind of music do you enjoy?">
                </textarea>
              </div>
              <div className="flex justify-between mt-4">
                <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded" onClick={handleSavePreferences}>
                  Save
                </button>
                <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded" onClick={logout}>
                  Logout
                </button>
              </div>
              {/* Recommended songs */}
              <div>
                <h3>Recommended Songs</h3>
              </div>
            </div>
          ):(
            <div className="text-center py-4">
              <p>Please login to view your profile</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default Profile;