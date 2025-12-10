# Watchers – Watch Party & Video Call Web Application

A real-time video calling and watch party web application where users can call, chat, sync YouTube videos, upload media, and watch together.

Live Demo:  
https://watchers-watchparty-web-application.onrender.com

---

## Features

### Authentication
- Secure signup and login using MongoDB and Mongoose
- Password hashing with bcrypt
- Session-based authentication with express-session

### Real-Time Video Calling
- WebRTC peer-to-peer calling
- Socket.IO used for signaling:
  - offer
  - answer
  - icecandidate
  - end-call

### Online User System
- Users join with a username
- User list updates in real time
- Detects disconnects and removes users automatically

### Watch Party Mode
- Syncs YouTube video across all users
- Play and pause synchronization
- Supports uploaded videos
- Media sharing via base64 data URLs

### File Uploads
- Upload local videos using multer
- Files stored in the /uploads folder
- Uploaded videos are shareable with others instantly

### Pages
- /signup → User registration
- /login → User login
- / → Main application (requires login)

---

## Live Demo

Hosted on Render:  
https://watchers-watchparty-web-application.onrender.com

Use this link to test login, calling, chat, and watch-party features.

---

## Tech Stack

- Backend: Node.js, Express  
- Real-time: Socket.IO  
- Database: MongoDB (Mongoose)  
- Authentication: express-session, bcryptjs  
- File Handling: multer  
- Frontend: HTML, CSS, JavaScript (WebRTC + Socket.IO)

---

## Project Structure

```bash
.
├── app
│   ├── login.html
│   ├── signup.html
│   └── vc.html
├── public
│   ├── css
│   └── js
├── uploads
├── server.js
├── package.json
└── .env
