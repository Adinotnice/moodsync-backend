// server.js
// MoodSync Backend — Main Entry Point
// Team: Synclub | JECRC University

require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const deviceId   = require("./middleware/deviceId");

// ─── Route imports ───────────────────────────────────────────
const chatRoute    = require("./routes/chat");
const emotionRoute = require("./routes/emotion");
const moviesRoute  = require("./routes/movies");
const songsRoute   = require("./routes/songs");
const historyRoute = require("./routes/history");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods:     ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());
app.use(deviceId); // attach deviceId to every request

// ─── MongoDB Connection ──────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ─── Routes ─────────────────────────────────────────────────
app.use("/api/chat",    chatRoute);
app.use("/api/emotion", emotionRoute);
app.use("/api/movies",  moviesRoute);
app.use("/api/songs",   songsRoute);
app.use("/api/history", historyRoute);

// ─── Health check ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "MoodSync Backend running ✅",
    version: "1.0.0",
    routes:  ["/api/chat", "/api/emotion", "/api/movies", "/api/songs", "/api/history"],
  });
});

// ─── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 MoodSync backend running on http://localhost:${PORT}`);
});
