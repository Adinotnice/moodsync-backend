// routes/emotion.js
// Handles emotion detection using Gemini
// POST /api/emotion

const express = require("express");
const Session = require("../models/Session");
const router  = express.Router();

// ─── HTTPS fetch helper with Content-Length support ──────────
function httpsFetch(reqUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(reqUrl);
    const bodyData = options.body ? Buffer.from(options.body) : null;
    const headers = { ...options.headers };
    if (bodyData) headers["Content-Length"] = bodyData.length;
    const reqOpts = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   options.method || "GET",
      headers,
    };
    const req = require("https").request(reqOpts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on("error", reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`;
const VALID_EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"];

// ─── POST /api/emotion ───────────────────────────────────────
// Body: { sessionId, userTexts[], selectedEmojis[], selectedWords[], skipped }
// Returns: { emotion, sessionId }
router.post("/", async (req, res) => {
  try {
    const {
      sessionId,
      userTexts   = [],
      selectedEmojis = [],
      selectedWords  = [],
      skipped        = false,
    } = req.body;

    // ── Build emotion detection prompt ───────────────────────
    const allInput = [
      ...userTexts,
      selectedWords.join(" "),
      selectedEmojis.join(" "),
    ]
      .filter(Boolean)
      .join(". ");

    const prompt = `You are an emotion classifier. Based on the following text from a user describing their mood, respond with ONLY one word — the single dominant emotion from this list: joy, sadness, anger, fear, surprise, disgust, neutral. No explanation, no punctuation, just the single word.\n\nUser input: ${allInput}`;

    // ── Call Gemini ──────────────────────────────────────────
    const geminiRes = await httpsFetch(
      `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    const geminiData = geminiRes.data;

    if (geminiData.error) {
      console.error("Gemini emotion error:", geminiData.error.message);
      return res.status(500).json({ error: "Gemini API error", emotion: "neutral" });
    }

    const raw     = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    const emotion = VALID_EMOTIONS.includes(raw) ? raw : "neutral";

    // ── Update session with emotion and self-expression ──────
    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, {
        detectedEmotion: emotion,
        selectedEmojis,
        selectedWords,
        skipped,
      });
    }

    res.json({ emotion });
  } catch (err) {
    console.error("Emotion route error:", err);
    res.status(500).json({ error: "Server error", emotion: "neutral" });
  }
});

module.exports = router;
