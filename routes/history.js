// routes/history.js
// Returns last 3 chat sessions for a device
// GET /api/history

const express = require("express");
const Session = require("../models/Session");
const router  = express.Router();

// ─── GET /api/history ────────────────────────────────────────
// Headers: x-device-id
// Returns: { sessions[] } — last 3 complete sessions
router.get("/", async (req, res) => {
  try {
    const deviceId = req.deviceId;

    const sessions = await Session.find({
      deviceId,
      isComplete: true,
    })
      .sort({ startedAt: -1 })
      .limit(3)
      .select(
        "recommendationType detectedEmotion messages recommendations startedAt completedAt selectedEmojis selectedWords skipped"
      );

    res.json({ sessions });
  } catch (err) {
    console.error("History route error:", err);
    res.status(500).json({ error: "Server error", sessions: [] });
  }
});

module.exports = router;
