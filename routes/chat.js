// routes/chat.js
// Handles Gemini API conversation calls
// POST /api/chat

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

// ─── POST /api/chat ──────────────────────────────────────────
// Body: { sessionId, userTexts[], systemPrompt }
// Returns: { reply, sessionId }
router.post("/", async (req, res) => {
  try {
    const { sessionId, userMessage, userTexts, systemPrompt, recommendationType, role } = req.body;
    const deviceId = req.deviceId;

    // ── Call Gemini ──────────────────────────────────────────
    const contents = [
      {
        role:  "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role:  "model",
        parts: [{ text: "Understood! I will follow these instructions carefully." }],
      },
      ...(userTexts || []).map((t) => ({
        role:  "user",
        parts: [{ text: t }],
      })),
    ];

    const geminiRes = await httpsFetch(
      `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contents }),
      }
    );

    const geminiData = geminiRes.data;

    if (geminiData.error) {
      console.error("Gemini error:", geminiData.error.message);
      return res.status(500).json({
        error: "Gemini API error",
        message: geminiData.error.message,
      });
    }

    const reply =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Tell me more about how you're feeling!";

    // ── Save message to session ──────────────────────────────
    let session;
    if (sessionId) {
      // Add to existing session
      session = await Session.findById(sessionId);
      if (session) {
        if (userMessage) {
          session.messages.push({ role: "user",    content: userMessage });
        }
        session.messages.push({ role: "bot", content: reply });
        await session.save();
      }
    } else {
      // Create new session
      session = new Session({
        deviceId,
        recommendationType: recommendationType || "movie",
        messages: [
          ...(userMessage ? [{ role: "user", content: userMessage }] : []),
          { role: "bot", content: reply },
        ],
      });
      await session.save();

      // Keep only last 3 sessions for this device
      await Session.keepLatestThree(deviceId);
    }

    res.json({ reply, sessionId: session._id });
  } catch (err) {
    console.error("Chat route error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

module.exports = router;
