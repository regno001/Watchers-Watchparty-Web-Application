// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import multer from "multer";
import fs from "fs";
import mongoose from "mongoose";
import session from "express-session";
import bcrypt from "bcryptjs";

const app = express();
const server = createServer(app);
const io = new Server(server);
const allusers = {};

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- MongoDB ----------
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not set");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// User model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed
});

const User = mongoose.model("User", userSchema);

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret";

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);


// static files
app.use(express.static("public"));
app.use("/uploads", express.static(join(__dirname, "uploads")));

// ---------- Auth middleware ----------
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// ---------- Multer (uploads) ----------
const uploadsPath = join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  const videoPath = `/uploads/${req.file.filename}`;
  res.json({ success: true, path: videoPath });
});

// ---------- Auth API routes ----------

// Signup API
app.post("/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });

    req.session.user = { id: user._id, username: user.username };
    res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login API
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    req.session.user = { id: user._id, username: user.username };
    res.json({ message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Logout API
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// ---------- Pages ----------

// PUBLIC: signup page
app.get("/signup", (req, res) => {
  res.sendFile(join(__dirname, "app", "signup.html"));
});

// PUBLIC: login page
app.get("/login", (req, res) => {
  res.sendFile(join(__dirname, "app", "login.html"));
});

// PROTECTED: main VC page
app.get("/", requireLogin, (req, res) => {
  res.sendFile(join(__dirname, "app", "vc.html"));
});

// ---------- Socket.IO ----------
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-user", (username) => {
    allusers[username] = { username, id: socket.id };
    io.emit("joined", allusers);
  });

  socket.on("offer", ({ from, to, offer }) => {
    if (allusers[to]) io.to(allusers[to].id).emit("offer", { from, to, offer });
  });

  socket.on("answer", ({ from, to, answer }) => {
    if (allusers[from])
      io.to(allusers[from].id).emit("answer", { from, to, answer });
  });

  socket.on("icecandidate", ({ to, candidate }) => {
    if (allusers[to]) io.to(allusers[to].id).emit("icecandidate", { candidate });
  });

  socket.on("end-call", ({ from, to }) => {
    if (allusers[to]) io.to(allusers[to].id).emit("end-call", { from, to });
  });

  socket.on("call-ended", ([from, to]) => {
    if (allusers[from]) io.to(allusers[from].id).emit("call-ended", [from, to]);
    if (allusers[to]) io.to(allusers[to].id).emit("call-ended", [from, to]);
  });

  socket.on("chat-message", (data) => {
    socket.broadcast.emit("chat-message", data);
  });

  socket.on("sync-youtube-video", ({ videoId, timestamp }) => {
    if (videoId)
      socket.broadcast.emit("sync-youtube-video", { videoId, timestamp });
  });

  socket.on("play-video", (timestamp) => {
    socket.broadcast.emit("play-video", timestamp);
  });

  socket.on("pause-video", (timestamp) => {
    socket.broadcast.emit("pause-video", timestamp);
  });

  socket.on("video-uploaded", (path) => {
    socket.broadcast.emit("video-uploaded", path);
  });

  socket.on("youtube-loaded", (url) => {
    socket.broadcast.emit("youtube-loaded", url);
  });

  socket.on("media-uploaded", ({ dataUrl, type }) => {
    socket.broadcast.emit("media-uploaded", { dataUrl, type });
  });

  socket.on("disconnect", () => {
    for (const username in allusers) {
      if (allusers[username].id === socket.id) {
        delete allusers[username];
        io.emit("user-disconnected", username);
        break;
      }
    }
  });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 7000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

