// import cors from "cors";
// import dotenv from "dotenv";
// import express from "express";
// import "express-async-errors";
// import path from 'path';
// import { fileURLToPath } from 'url';
// import session from 'express-session';
// import http from 'http';
// import { Server } from 'socket.io';
// import connectDB from "./config/database.js";
// import errorHandler from "./middlewares/errorHandler.js";
// import { initializeDefaultBadges } from "./services/badgeService.js";
// // Import routes
// import authRoutes from './routes/authRoutes.js';
// import gamificationRoutes from './routes/gamificationRoutes.js';
// import geminiRoutes from './routes/geminiRoutes.js';
// import leaderboardRoutes from './routes/leaderboardRoutes.js';
// import musicRoutes from './routes/musicRoutes.js';
// import playlistRoutes from './routes/playlistRoutes.js';
// import userRoutes from './routes/userRoutes.js';
// import SocketManager from "./services/socketManager.js";

// dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const app = express();

// // Connect to MongoDB
// connectDB().then(() => {
//   console.log('Database connected successfully');
//   console.log('Starting badge initialization...');
//   initializeDefaultBadges();
// }).catch((err) => {
//   console.error('Database connection failed:', err);
//   // Don't exit in production, but log the error
//   if (process.env.NODE_ENV !== 'production') {
//     process.exit(1);
//   }
// });

// const server = http.createServer(app);

// // Session options - use environment variable for secret
// const sessionOptions = {
//   secret: process.env.SESSION_SECRET || 'mysupersecretcode',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production', // HTTPS in production
//     maxAge: 24 * 60 * 60 * 1000 // 24 hours
//   }
// };

// app.use(session(sessionOptions));

// // CORS Configuration - Updated for Railway
// app.use(cors({
//   origin: [
//     'http://localhost:5173',        // Vite dev server
//     'http://localhost:3000',        // Local backend
//     process.env.FRONTEND_URL,       // Railway production URL
//     /\.railway\.app$/               // Any Railway subdomain
//   ],
//   credentials: true
// }));

// app.use(express.json());

// // Socket.io with updated CORS - Fixed missing comma
// const io = new Server(server, {
//   cors: {
//     origin: function (origin, callback) {
//       const allowedOrigins = [
//         'http://localhost:5173',
//         'http://localhost:3000',
//         'https://6862e0d66e3cfca404b2bb65--enchanting-smakager-13714c.netlify.app',
//         process.env.FRONTEND_URL // Fixed: Added missing comma above
//       ];
      
//       // Allow requests with no origin (mobile apps, etc.)
//       if (!origin) return callback(null, true);
      
//       // Check if origin is allowed or matches Railway pattern
//       if (allowedOrigins.includes(origin) || /\.railway\.app$/.test(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS for WebSocket'));
//       }
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     credentials: true
//   }
// });

// const socketManager = new SocketManager(io);

// // Middleware to add socket manager to requests
// app.use((req, res, next) => {
//   req.socketManager = socketManager;
//   req.io = io;
//   next();
// });

// // API Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/music/recommend', musicRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/gemini', geminiRoutes);
// app.use('/api/playlists', playlistRoutes);
// app.use('/api/gamification', gamificationRoutes);
// app.use('/api/leaderboard', leaderboardRoutes);

// // Health check endpoint
// app.get("/api/health", (req, res) => {
//   res.json({ 
//     status: "Server is running...", 
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV || 'development'
//   });
// });

// // Serve static files from React build (ONLY in production)
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
//   // Catch all handler for React Router
//   app.get('*', (req, res) => {
//     if (!req.path.startsWith('/api')) {
//       res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
//     }
//   });
// } else {
//   // Development root route
//   app.get("/", (req, res) => {
//     res.json({ 
//       message: "ZENOVA Music Therapy Backend API", 
//       environment: "development",
//       frontend: "http://localhost:5173"
//     });
//   });
// }

// // Global Error Handler (must be last)
// app.use(errorHandler);

// const PORT = process.env.PORT || 3000;

// server.listen(PORT, () => {
//   console.log(` ZENOVA Server running on port ${PORT}`);
//   console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(` Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
// });

// export default app;

// server.js - Updated for Render deployment
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
connectDB();

const server = http.createServer(app);

// Session options optimized for Render
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // For cross-origin
  }
}

// Initialize badges database
initializeDefaultBadges();

app.use(session(sessionOptions));

// CORS configuration for Render
const allowedOrigins = [
  'http://localhost:5173', // Development
  'http://localhost:3000', // Development
  'https://localhost:5173', // Development HTTPS
  process.env.FRONTEND_URL, // Production frontend URL from env
  // Add common Vercel patterns
  /https:\/\/.*\.vercel\.app$/,
  /https:\/\/.*\.netlify\.app$/,
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      }
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.io configuration for Render
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
  allowEIO3: true // Enable Engine.IO v3 compatibility
});

const socketManager = new SocketManager(io);

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main route
app.get("/", (req, res) => {
  res.json({ 
    message: "🎵 ZENOVA Music Therapy API is running!",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    websockets: "enabled"
  });
});

// Middleware to add socket manager to requests
app.use((req, res, next) => {
  req.socketManager = socketManager;
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/music/recommend', musicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use(errorHandler);

// Use Render's PORT environment variable or fallback
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Socket.io enabled with transports: websocket, polling`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
