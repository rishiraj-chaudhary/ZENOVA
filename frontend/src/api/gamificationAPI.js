export const getUserStats=async(userId,token)=>{
    try{
        const response=await fetch(`http://localhost:3000/api/gamification/stats/${userId}`,{
            method:'GET',
            headers:{
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if(!response.ok){
            throw new Error('Failed to fetch user stats');
        }
        return await response.json();
    }catch(err){
        console.error('Error fetching user stats:', err);
        throw err;
    }
}

export const getLeaderboard=async(type='alltime',period='all')=>{
    try{
        const response=await fetch(`http://localhost:3000/api/leaderboard?type=${type}&period=${period}`,{
            method:'GET',
            headers:{
                'Content-type':'application/json'
            }
        });
        if(!response.ok){
            throw new Error('Failed to fetch leaderboard');
        }
        const data=await response.json();
        return data.entries || [];
    }catch(err){
        console.error('Error fetching leaderboard:', err);
        throw err;
    }
}