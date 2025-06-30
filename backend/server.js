import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import "express-async-errors";
import session from 'express-session';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from "./config/database.js";
import errorHandler from "./middlewares/errorHandler.js";
import { initializeDefaultBadges } from "./services/badgeService.js";
// Import routes
import authRoutes from './routes/authRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import geminiRoutes from './routes/geminiRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import musicRoutes from './routes/musicRoutes.js';
import playlistRoutes from './routes/playlistRoutes.js';
import userRoutes from './routes/userRoutes.js';
import SocketManager from "./services/socketManager.js";

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB().then(() => {
  // Initialize badges after database is connected
  console.log('Starting badge initialization...');
  initializeDefaultBadges();
}).catch((err) => {
  console.error('Database connection failed, skipping badge initialization');
});
const server=http.createServer(app);

//session options
const sessionOptions={
  secret:'mysupersecretcode',
  resave:false,
  saveUninitialized:false
}
//Initializing badges database
initializeDefaultBadges();

app.use(session(sessionOptions));
// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow  Vite frontend
  credentials: true // Important for cookies
}));
app.use(express.json());

//Initializing Socket.io with cors configuration
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://6862e0d66e3cfca404b2bb65--enchanting-smakager-13714c.netlify.app'
        process.env.FRONTEND_URL,
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS for WebSocket'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});
const socketManager= new SocketManager(io);
// Routes
app.get("/", (req, res) => {
  res.send("Server is running...");
});
app.use((req,res,next)=>{
  req.socketManager=socketManager;
  req.io=io;
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/music/recommend', musicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/gamification',gamificationRoutes);
app.use('/api/leaderboard',leaderboardRoutes);
// Global Error Handler
app.use(errorHandler);
const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
server.listen(PORT,()=> console.log(`Server running on port ${PORT}`));
