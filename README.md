Music Therapy Platform
An AI-powered collaborative music therapy platform that helps users discover, create, and share therapeutic playlists through intelligent mood analysis and real-time collaboration.
Created by RISHIRAJ, an undergraduate at NSUT, this platform bridges the gap between technology and mental health by making music therapy accessible to everyone.

# TECHNOLOGIES USED

https://nodejs.org/en 

https://expressjs.com/

https://www.mongodb.com/

https://socket.io/

https://ai.google.dev/

https://developer.spotify.com/

# Project Overview
1.1 Problem Statement

Traditional music therapy is expensive and requires professional sessions
Finding therapeutic music for specific emotional states is challenging
Mental health support lacks community connection and personalization
Students need accessible stress management tools

1.2 Solution
An intelligent platform combining AI mood analysis with collaborative playlist creation, gamification for engagement, and real-time synchronization for community building.
1.3 Target Users

University students dealing with stress and anxiety
Young professionals managing work-life balance
Individuals seeking accessible mental health support
Music therapy practitioners and students


# Technologies Used
   
2.1 Backend Core
Node.js v18+ - JavaScript runtime with event-driven architecture
Express.js v4.21+ - Web framework for RESTful APIs
ES6 Modules - Modern import/export syntax
2.2 Database
MongoDB v6+ - NoSQL document database for flexible data structures
Mongoose v8.13 - ODM library with schema validation and middleware support

2.3 Authentication & Security
JWT (jsonwebtoken v9.0) - Stateless authentication tokens
bcryptjs v3.0 - Password hashing with salt generation
express-session v1.18 - Session management middleware
express-validator v7.2 - Input validation and sanitization
CORS v2.8 - Cross-origin resource sharing configuration

2.4 Real-Time Communication
Socket.io v4.8 - Bidirectional event-based communication
WebSocket Protocol - Full-duplex communication for collaboration

2.5 AI & External APIs
Google Gemini AI 2.0 Flash - Natural language processing for mood analysis
@google/generative-ai v0.24 - Official Google AI SDK
Spotify Web API - Music catalog access and metadata
spotify-web-api-node v5.0 - Node.js wrapper for Spotify API

2.6 Development Tools
Nodemon v3.1 - Auto-restart development server
dotenv v16.4 - Environment variable management
ESLint - Code linting and style enforcement

2.7 Additional Libraries
qrcode v1.5 - QR code generation for playlist sharing
crypto - Secure token generation for invitations
axios v1.8 - HTTP client for API requests

# System Architecture
3.1 High-Level Architecture
┌─────────────────────────────────────────────────────────────┐
│                 MUSIC THERAPY PLATFORM                      │
└─────────────────────────────────────────────────────────────┘

         ┌─────────────────┐              ┌─────────────────┐
         │   Client Tier   │              │ Application Tier│
         ├─────────────────┤              ├─────────────────┤
         │ React Frontend  │──────────────│ Express Server  │
         │ Mobile App      │   HTTP/WS    │ Node.js Runtime │
         │ Desktop Client  │              │ API Gateway     │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ Authentication                 │ Business Logic
                 │                                ▼
                 │                        ┌─────────────────┐
                 │                        │ Service Layer   │
                 │                        ├─────────────────┤
                 │                        │ Auth Service    │
                 │                        │ Music Service   │
                 │                        │ Playlist Service│
                 │                        │ Socket Manager  │
                 │                        │ Gamification   │
                 │                        └─────────────────┘
                 │                                │
                 │ Real-time Updates              │ Data Access
                 ▼                                ▼
         ┌─────────────────┐              ┌─────────────────┐
         │  WebSocket Tier │              │   Data Tier     │
         ├─────────────────┤              ├─────────────────┤
         │ Socket.io Server│──────────────│ MongoDB Atlas   │
         │ Room Management │   Persist    │ Session Store   │
         │ Event Broadcasting             │ Cache Layer     │
         │ Presence Tracking│              │ External APIs   │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ Notifications                  │ Integration
                 │                                ▼
                 │                        ┌─────────────────┐
                 │                        │ External APIs   │
                 │                        ├─────────────────┤
                 │                        │ Gemini AI API  │
                 │                        │ Spotify Web API│
                 │                        │ YouTube API     │
                 │                        │ OAuth Providers │
                 │                        └─────────────────┘
                 │
                 └────────────────────────────────────────────┘
3.2 MVC Architecture Pattern
<pre>
┌────────────────────────┐     ┌──────────────────────────── ┐     ┌────────────────────────────┐
│        MODELS          │     │         CONTROLLERS         │     │           VIEWS            │
├────────────────────────┤     ├──────────────────────────── ┤     ├────────────────────────────┤
│ • User.js              │◄──► | • AuthController            │◄──► │ • React Frontend           │
│ • Playlist.js          │     │ • MusicController           │     │ • API Responses (JSON)     │
│ • MusicResource.js     │     │ • PlaylistController        │     │                            │
│ • Gamification.js      │     │ • GeminiController          │     │                            │
│ • Badge.js             │     │ • GamificationController    │     │                            │
└────────────────────────┘     └──────────────────────────── ┘     └────────────────────────────┘
</pre>

# Project Structure
┌─────────────────────────────────────────────────────────────┐
│              PROJECT STRUCTURE HIERARCHY                    │
└─────────────────────────────────────────────────────────────┘

         ┌─────────────────┐              ┌─────────────────┐
         │     config/     │              │  controllers/   │
         ├─────────────────┤              ├─────────────────┤
         │ database.js     │──────────────│ authController  │
         │ gamification.js │   provides   │ musicController │
         │                 │   settings   │ playlistCtrl    │
         │                 │              │ geminiController│
         │                 │              │ userController  │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ configures                     │ implements
                 │                                ▼
                 │                        ┌─────────────────┐
                 │                        │   middlewares/  │
                 │                        ├─────────────────┤
                 │                        │ authMiddleware  │
                 │                        │ gamificationMW  │
                 │                        │ errorHandler    │
                 │                        │ sessionMW       │
                 │                        └─────────────────┘
                 │                                │
                 │ data definitions               │ processes
                 ▼                                ▼
         ┌─────────────────┐              ┌─────────────────┐
         │     models/     │              │     routes/     │
         ├─────────────────┤              ├─────────────────┤
         │ user.js         │◄─────────────│ authRoutes      │
         │ Playlist.js     │   validates  │ musicRoutes     │
         │ MusicResource   │              │ playlistRoutes  │
         │ Gamification    │              │ userRoutes      │
         │ Badge.js        │              │ leaderboardRt   │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ data schemas                   │ API endpoints
                 │                                ▼
                 │                        ┌─────────────────┐
                 │                        │    services/    │
                 │                        ├─────────────────┤
                 │                        │ badgeService    │
                 │                        │ pointsService   │
                 │                        │ socketManager   │
                 │                        │ leaderboardSvc  │
                 │                        └─────────────────┘
                 │                                │
                 │ utilities                      │ business logic
                 ▼                                ▼
         ┌─────────────────┐              ┌─────────────────┐
         │     utils/      │              │   server.js     │
         ├─────────────────┤              ├─────────────────┤
         │ passwordUtils   │──────────────│ Express App     │
         │ cryptoUtils     │   supports   │ Socket.io Setup │
         │                 │              │ Route Mounting  │
         │                 │              │ Error Handling  │
         └─────────────────┘              └─────────────────┘

# Database Architecture
5.1 MongoDB Schema Design
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                          │
└─────────────────────────────────────────────────────────────┘

         ┌─────────────────┐              ┌─────────────────┐
         │     Users       │              │   Playlists     │
         ├─────────────────┤              ├─────────────────┤
         │ _id (ObjectId)  │──────────────│ _id (ObjectId)  │
         │ name            │      owns    │ userId (Ref)    │
         │ email           │              │ name            │
         │ password        │              │ collaborators[] │
         │ preferences[]   │              │ songs[]         │
         │ moodTracking[]  │              │ inviteLink      │
         │ createdAt       │              │ createdAt       │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ has                            │ contains
                 │                                ▼
                 │                        ┌─────────────────┐
                 │                        │ MusicResources  │
                 │                        ├─────────────────┤
                 │                        │ _id (ObjectId)  │
                 │                        │ title           │
                 │                        │ artist          │
                 │                        │ spotifyId       │
                 │                        │ audioUrl        │
                 │                        │ genre           │
                 │                        │ moodTags[]      │
                 │                        │ albumArt        │
                 │                        └─────────────────┘
                 │
                 ▼
         ┌─────────────────┐              ┌─────────────────┐
         │ Gamification    │              │     Badges      │
         ├─────────────────┤              ├─────────────────┤
         │ _id (ObjectId)  │              │ _id (ObjectId)  │
         │ userId (Ref)    │              │ name            │
         │ totalPoints     │              │ description     │
         │ level           │              │ requirement     │
         │ currentStreak   │              │ rarity          │
         │ badges[]        │──────────────│ icon            │
         │ lastActivity    │   earned     │ category        │
         └─────────────────┘              └─────────────────┘
                 │                                │
                 │ through                        │
                 └────────────┬───────────────────┘
                              │
                              ▼
                      ┌─────────────────┐
                      │   UserBadges    │
                      ├─────────────────┤
                      │ _id (ObjectId)  │
                      │ userId (Ref)    │
                      │ badgeId (Ref)   │
                      │ earnedAt        │
                      │ isDisplayed     │
                      └─────────────────┘

         ┌─────────────────┐              ┌─────────────────┐
         │  Leaderboard    │              │ Recommendations │
         ├─────────────────┤              ├─────────────────┤
         │ _id (ObjectId)  │              │ _id (ObjectId)  │
         │ type            │              │ userId (Ref)    │
         │ period          │              │ recommendedMusic│
         │ entries[]       │              │ generatedAt     │
         │ lastUpdated     │              │ mood            │
         └─────────────────┘              └─────────────────┘
5.2 Entity Relationships
User (1) ──owns────────── (Many) Playlists
User (Many) ──collaborates── (Many) Playlists
User (1) ──has──────────── (1) Gamification
User (1) ──earns────────── (Many) UserBadges
User (1) ──receives────── (Many) Recommendations
Playlist (Many) ──contains── (Many) MusicResources
Badge (1) ──awarded─────── (Many) UserBadges

# Application Flow Diagrams
   
6.1 User Authentication Flow
<pre>
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    User     │    │  Frontend   │    │   Backend   │    │  Database   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
   1.  │ Enter Credentials │                   │                   │
       ├──────────────────►│                   │                   │
   2.  │                   │ POST /auth/login  │                   │
       │                   ├──────────────────►│                   │
   3.  │                   │                   │ bcrypt.compare()  │
       │                   │                   │ validate user     │
       │                   │                   ├──────────────────►│
   4.  │                   │                   │ user data         │
       │                   │                   │◄──────────────────┤
   5.  │                   │                   │ jwt.sign()        │
       │                   │                   │ create session    │
       │                   │                   │ award points      │
   6.  │                   │ JWT + user data   │                   │
       │                   │◄──────────────────┤                   │
   7.  │ Success + token   │                   │                   │
       │◄──────────────────┤-------------------|-------------------|
  </pre>
       
6.2 AI Music Recommendation Flow
<pre>
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    User     │  │  Frontend   │  │   Backend   │  │  Gemini AI  │  │ Spotify API │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       │               │               │               │               │
   1.  │ "I'm stressed"│               │               │               │
       ├──────────────►│               │               │               │
   2.  │               │ POST /music/  │               │               │
       │               │ recommendations│              │               │
       │               ├──────────────►│               │               │
   3.  │               │               │ genAI.generate│               │
       │               │               │ Content()     │               │
       │               │               ├──────────────►│               │
   4.  │               │               │mood:"stressed"│               │
       │               │               │ songs: [...]  │               │
       │               │               │◄──────────────┤               │
   5.  │               │               │ spotifyApi.   │               │
       │               │               │ searchTracks()│               │
       │               │               ├───────────────────────────────►│
   6.  │               │               │ track metadata│               │
       │               │               │◄───────────────────────────────┤
   7.  │               │               │ save to DB    │               │
       │               │               │ award points  │               │
   8.  │               │recommendations│               │               │
       │               │ + reasons     │               │               │
       │               │◄──────────────┤               │               │
   9.  │ music therapy │               │               │               │
       │ playlist      │               │               │               │
       │◄──────────────┤---------------|---------------|---------------|
  </pre>
       
6.3 Real-Time Collaboration Flow
<pre>
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   User A    │  │   User B    │  │  Socket.io  │  │  Database   │
│             │  │             │  │  Manager    │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       │               │               │               │
   1.  │ join playlist │               │               │
       ├───────────────────────────────►│              │
   2.  │               │               │ socket.join() │
       │               │               │ track user    │
   3.  │               │ user A joined │               │
       │               │◄──────────────┤               │
   4.  │ add song      │               │               │
       ├───────────────────────────────│               │
   5.  │               │               │update playlist│
       │               │               ├──────────────►│
   6.  │               │               │ io.to().emit()│
       │               │ song added    │               │
       │               │◄──────────────┤               │
   7.  │ confirmation  │               │               │
       │◄──────────────────────────────┤               │
   8.  │               │               │ award points  │
   9.  │               │ add song      │               │
       │               ├──────────────►│               │
  10.  │               │               │ merge changes │
       │               │               ├──────────────►│
  11.  │ both songs    │ both songs    │               │
       │ visible       │ visible       │               │
       │◄──────────────┼──────────────►│---------------|

  </pre>
6.4 Gamification System Flow
<pre>
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ User Action │  │ Middleware  │  │ Points      │  │ Badge       │
│             │  │             │  │ Service     │  │ Service     │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       │               │               │               │
   1.  │ create        │               │               │
       │ playlist      │               │               │
       ├──────────────►│               │               │
   2.  │               │ trackAction() │               │
       │               │ intercept     │               │
       │               │ response      │               │
   3.  │               │ success (200) │               │
       │               ├──────────────►│               │
   4.  │               │               │ awardPoints() │
       │               │               │ +10 points    │
       │               │               │ checkLevel()  │
   5.  │               │               │ checkBadges() │
       │               │               ├──────────────►│
   6.  │               │               │ badge earned! │
       │               │               │◄──────────────┤
   7.  │               │ socketManager │               │
       │               │ .emitToUser() │               │
   8.  │ real-time     │ level up!     │               │
       │ notifications │ badge earned! │               │
       │◄──────────────┤               │               │
   9.  │               │ update        │               │
       │---------------│ leaderboard   |---------------|
  
</pre>
       
6.5 Playlist Collaboration Cycle
┌─────────────────────────────────────────────────────────────┐
│                COLLABORATION LIFECYCLE                      │
└─────────────────────────────────────────────────────────────┘

    ┌─────────────────┐
    │ Create Playlist │
    └─────────────────┘
            │
            ▼
    ┌─────────────────┐    ┌─────────────────┐
    │ Generate Invite │───►│ Share via QR/   │
    │ Link/QR Code    │    │ Link/Username   │
    └─────────────────┘    └─────────────────┘
            │                       │
            ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐
    │ Accept          │◄───│ Receive         │
    │ Invitation      │    │ Invitation      │
    └─────────────────┘    └─────────────────┘
            │
            ▼
    ┌─────────────────┐
    │ Join WebSocket  │
    │ Room            │
    └─────────────────┘
            │
            ▼
    ┌─────────────────┐    ┌─────────────────┐
    │ Real-time       │◄──►│ Add/Remove      │
    │ Collaboration   │    │ Songs           │
    └─────────────────┘    └─────────────────┘
            │                       │
            ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐
    │ Award Points &  │    │ Sync Changes    │
    │ Badges          │    │ to All Users    │
    └─────────────────┘    └─────────────────┘
    

# Security Architecture

7.1 Multi-Layer Security
<pre>
┌─────────────────────────────────────────────────────────────-┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────-|
│ 7.1.1 Network Layer                                          │
│   HTTPS/TLS Encryption, CORS Protection, Rate Limiting       │
├───────────────────────────────────────────────────────────── ┤
│ 7.1.2 Application Layer                                      │
│   JWT Token Validation, Session Management,Input Sanitization│
├───────────────────────────────────────────────────────────── ┤
│ 7.1.3 Authentication Layer                                   │
│   bcrypt Password Hashing, Token Expiration                  │
├───────────────────────────────────────────────────────────── ┤
│ 7.1.4 Data Layer                                             │
│   MongoDB Authentication, Encrypted Fields, Access Control   │
└─────────────────────────────────────────────────────────────-┘
  </pre>

# Core Features

8.1 AI-Powered Intelligence

Mood Analysis: Gemini AI analyzes text for emotional context
Smart Recommendations: 3-5 songs with therapeutic reasoning
Conversational Assistant: Interactive chat for music therapy guidance
Learning Algorithm: Improves based on user feedback

8.2 Playlist Management

Real-time Collaboration: Multiple users edit simultaneously
Voice Commands: "Create relaxing playlist" generates automatically
Smart Invitations: QR codes, secure links, username invites
Conflict Resolution: Handles simultaneous edits gracefully

8.3 Gamification System

5 Levels: Beginner (0) → Explorer (40) → Curator (500) → Therapist (1500) → Master (5000) points
Achievement Badges: Common, rare, epic, legendary with specific requirements
Live Leaderboards: All-time, monthly, weekly rankings
Streak Bonuses: Daily login rewards and consistency tracking

8.4 Real-Time Features

Live Sync: Instant updates across all devices
Presence Indicators: See who's actively editing
Change Attribution: Track who made which modifications
WebSocket Communication: Low-latency real-time updates


# API Overview
    
9.1 Core Endpoints
CategoryEndpointMethodDescriptionAuth/api/auth/registerPOSTUser registration with bcryptAuth/api/auth/loginPOSTJWT + session authenticationMusic/api/music/recommend/recommendationsPOSTAI mood analysis + SpotifyPlaylists/api/playlists/createPOSTCreate playlist with gamificationPlaylists/api/playlists/create-from-voicePOSTVoice command playlistCollaboration/api/playlists/invite/usernamePOSTInvite by usernameCollaboration/api/playlists/invite/qr/:playlistIdPOSTGenerate QR codeGamification/api/gamification/stats/:userIdGETUser progress statsLeaderboard/api/leaderboardGETCurrent rankings

# Installation & Setup
    
10.1 Prerequisites
bashNode.js >= 18.0.0
MongoDB >= 6.0.0
npm >= 8.0.0

10.2 Quick Start
bash# Clone and install
git clone https://github.com/your-username/music-therapy-platform.git
cd music-therapy-platform
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development
npm run dev

10.3 Environment Variables
envMONGO_URI=mongodb://127.0.0.1:27017/therapy
JWT_SECRET=your_secure_secret_key
GEMINI_API_KEY=your_gemini_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
PORT=3000
FRONTEND_URL=http://localhost:5173

# Contributing
    
11.1 Development Guidelines

Follow ESLint configuration for code consistency
Write tests for new features
Update documentation for API changes
Use conventional commit messages

11.2 How to Contribute

Fork the repository
Create feature branch (git checkout -b feature/amazing-feature)
Commit changes (git commit -m 'Add amazing feature')
Push to branch (git push origin feature/amazing-feature)
Open Pull Request


# License & Support

License: MIT License
Created by: RISHIRAJ, NSUT Undergraduate
Support: GitHub Issues
Community: GitHub Discussions


Built with ❤️ for mental health, music therapy, and human connection
"In a world full of noise, sometimes the right song is the clearest voice of healing"
