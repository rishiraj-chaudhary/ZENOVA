
const API_BASE_URL = import.meta.env.PROD 
  ? '/api'  
  : 'http://localhost:3000/api'; 

export const SOCKET_URL = import.meta.env.PROD 
  ? window.location.origin  
  : 'http://localhost:3000';  

export default API_BASE_URL;
