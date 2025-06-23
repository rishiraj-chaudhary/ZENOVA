import axios from 'axios';
const API_URL='http://localhost:3000/api/users';
export const getUserProfile=async (token)=>{
    try{
        const res=await axios.get(`${API_URL}/profile`,{
            headers:{Authorization: `Bearer ${token}`}
        });
        return res.data;
    }catch(err){
        console.log('Error fetching profile', err);
        return null;
    }
}
export const updatePreferences=async (token,preferences)=>{
    try{
        const res=await axios.put(`${API_URL}/preferences`,{preferences},{
            headers:{Authorization: `Bearer ${token}`}
        });
        return res.data;
    }catch(err){
        console.log('Error updating preferences', err);
        return null;
    }
}