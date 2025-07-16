// import axios from 'axios';
// import React, { useContext, useState } from "react";
// import AuthContext from '../context/AuthContext';
// const Register = () => {
//     const {setCurrentPage}=useContext(AuthContext);
//     const [name,setName]=useState("");
//     const [email,setEmail]=useState("");
//     const [password,setPassword]=useState("");
//     const handleRegister=async (event)=>{
//         event.preventDefault();
//         try{
//             await axios.post('http://localhost:3000/api/auth/register',{name,email,password});
//             // alert('Registration successfull!');
//             setCurrentPage('login');
//         }catch(err) {
//           if (err.response && err.response.data) {
//               if (err.response.data.error) {
//                   // Handle validation errors array
//                   const errorMessages = err.response.data.error.map(e => e.msg).join(', ');
//                   alert(`Validation failed: ${errorMessages}`);
//               } else if (err.response.data.message) {
//                   // Handle custom message error
//                   alert(err.response.data.message);
//               } else {
//                   alert('Registration failed');
//               }
//           } else {
//               alert('Registration failed');
//           }
//       }
//     }
//   return (
//     <div className="flex justify-center items-center min-h-screen bg-gray-900">
//             <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white w-96">
//                 <h2 className="text-3xl font-bold text-center text-blue-400 drop-shadow-lg">Register</h2>
//                 <form onSubmit={handleRegister} className="space-y-4 mt-5">
//                     <input
//                         type="text"
//                         placeholder="Full Name"
//                         value={name}
//                         onChange={(e) => setName(e.target.value)}
//                         className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
//                         required
//                     />
//                     <input
//                         type="email"
//                         placeholder="Email"
//                         value={email}
//                         onChange={(e) => setEmail(e.target.value)}
//                         className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
//                         required
//                     />
//                     <input
//                         type="password"
//                         placeholder="Password"
//                         value={password}
//                         onChange={(e) => setPassword(e.target.value)}
//                         className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
//                         required
//                     />
//                     <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-md transition">
//                         Register
//                     </button>
//                 </form>
//                 <p className="text-center mt-4">
//                     Already have an account?{" "}
//                     <button onClick={() => setCurrentPage('login')} className="text-blue-400 hover:underline">
//                         Login
//                     </button>
//                 </p>
//             </div>
//         </div>
//   );
// };

// export default Register; 


import axios from 'axios';
import { useState } from "react";
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    
    const handleRegister = async (event) => {
        event.preventDefault();
        try {
            await axios.post('https://zenova-qfsf.onrender.com/api/auth/register', { name, email, password });
            navigate('/login');
        } catch (err) {
            if (err.response && err.response.data) {
                if (err.response.data.error) {
                    // Handle validation errors array
                    const errorMessages = err.response.data.error.map(e => e.msg).join(', ');
                    alert(`Validation failed: ${errorMessages}`);
                } else if (err.response.data.message) {
                    // Handle custom message error
                    alert(err.response.data.message);
                } else {
                    alert('Registration failed');
                }
            } else {
                alert('Registration failed');
            }
        }
    };
    
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white w-96">
                <h2 className="text-3xl font-bold text-center text-blue-400 drop-shadow-lg">Register</h2>
                <form onSubmit={handleRegister} className="space-y-4 mt-5">
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                        required
                    />
                    <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-md transition">
                        Register
                    </button>
                </form>
                <p className="text-center mt-4">
                    Already have an account?{" "}
                    <button onClick={() => navigate('/login')} className="text-blue-400 hover:underline">
                        Login
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Register;
