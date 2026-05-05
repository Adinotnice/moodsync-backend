// routes/movies.js
// Handles movie recommendations via OMDb API
// POST /api/movies

const express = require("express");

// ─── Simple https fetch helper ───────────────────────────────
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

const Session = require("../models/Session");
const router  = express.Router();

const EMOTION_SEARCH = {
  joy:      ["Marvel", "Pixar", "fantasy"],
  sadness:  ["drama", "romance", "love"],
  anger:    ["Batman", "action", "war"],
  fear:     ["horror", "thriller", "suspense"],
  surprise: ["mystery", "fantasy", "sci-fi"],
  disgust:  ["crime", "gangster", "dark"],
  neutral:  ["history", "biography", "nature"],
};

// ─── POST /api/movies ────────────────────────────────────────
// Body: { sessionId, emotion }
// Returns: { movies[] }
router.post("/", async (req, res) => {
  try {
    const { sessionId, emotion = "neutral" } = req.body;

    const terms   = EMOTION_SEARCH[emotion] || EMOTION_SEARCH.neutral;
    // Pick a random search term from the emotion's list
    const query   = terms[Math.floor(Math.random() * terms.length)];

    const year = 2000 + Math.floor(Math.random() * 24); // random year 2000-2023
    const page = Math.floor(Math.random() * 3) + 1;

const omdbRes = await httpsFetch(
  `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&type=movie&y=${year}&page=${page}&apikey=${process.env.OMDB_API_KEY}`
);

    const omdbData = omdbRes?.data || {};

console.log("[MOVIES] OMDb response:", JSON.stringify(omdbData).slice(0, 100));

if (omdbData.Error) {
      return res.status(500).json({ error: omdbData.Error, movies: [] });
    }

    // Shuffle and pick 4
    const results = (omdbData.Search || [])
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((m) => ({
        id:     m.imdbID,
        title:  m.Title,
        year:   m.Year,
        genre:  query,
        emoji:  "🎬",
        poster: m.Poster !== "N/A" ? m.Poster : null,
        link:   `https://www.imdb.com/title/${m.imdbID}`,
        type:   "movie",
      }));

    // ── Save recommendations to session ──────────────────────
    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, {
        recommendations: results,
        isComplete:      true,
        completedAt:     new Date(),
      });
    }

    res.json({ movies: results });
  } catch (err) {
    console.error("Movies route error:", err);
    res.status(500).json({ error: "Server error", movies: [] });
  }
});

module.exports = router;
