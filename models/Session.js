// models/Session.js
// MongoDB schema for storing MoodSync chat sessions
// Only last 3 sessions per device are kept

const mongoose = require("mongoose");

// ─── Message Schema ──────────────────────────────────────────
const MessageSchema = new mongoose.Schema({
  role:      { type: String, enum: ["user", "bot"], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// ─── Recommendation Schema ───────────────────────────────────
const RecommendationSchema = new mongoose.Schema({
  id:     String,
  title:  String,
  artist: String, // for songs
  genre:  String, // for movies
  year:   String,
  rating: Number,
  link:   String,
  poster: String,
  type:   { type: String, enum: ["movie", "song"] },
});

// ─── Session Schema ──────────────────────────────────────────
const SessionSchema = new mongoose.Schema({
  // Device identifier (stored in browser localStorage)
  deviceId: {
    type:     String,
    required: true,
    index:    true,
  },

  // Recommendation type chosen by user
  recommendationType: {
    type: String,
    enum: ["movie", "song"],
    required: true,
  },

  // Full conversation history
  messages: [MessageSchema],

  // Emotion detected by Gemini
  detectedEmotion: {
    type: String,
    enum: ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"],
    default: "neutral",
  },

  // User self-expression inputs
  selectedEmojis: [String],
  selectedWords:  [String],
  skipped:        { type: Boolean, default: false },

  // Final recommendations shown to user
  recommendations: [RecommendationSchema],

  // Session timestamps
  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date },

  // Whether session is complete (recommendations were shown)
  isComplete: { type: Boolean, default: false },
});

// ─── Auto-delete old sessions (keep only last 3 per device) ──
SessionSchema.statics.keepLatestThree = async function (deviceId) {
  // Find all sessions for this device, sorted newest first
  const sessions = await this.find({ deviceId })
    .sort({ startedAt: -1 })
    .select("_id");

  // If more than 3, delete the oldest ones
  if (sessions.length > 3) {
    const toDelete = sessions.slice(3).map((s) => s._id);
    await this.deleteMany({ _id: { $in: toDelete } });
  }
};

module.exports = mongoose.model("Session", SessionSchema);
