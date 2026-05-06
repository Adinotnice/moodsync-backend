// routes/songs.js
const express = require("express");
const https   = require("https");
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

    const req = https.request(reqOpts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: {} }); }
      });
    });

    req.on("error", (err) => {
      console.error("HTTPS request error:", err.message);
      reject(err);
    });

    if (bodyData) req.write(bodyData);
    req.end();
  });
}

const EMOTION_SEARCH = {
  joy:      ["happy feel good pop", "upbeat cheerful hits", "feel good dance", "positive vibes pop"],
  sadness:  ["sad heartbreak emotional", "melancholy indie", "breakup songs", "sad ballads"],
  anger:    ["intense powerful rock", "angry metal", "rage punk", "hard rock energy"],
  fear:     ["dark atmospheric tense", "eerie ambient", "suspense soundtrack", "dark electronic"],
  surprise: ["energetic upbeat exciting", "unexpected pop hits", "fun party songs", "quirky indie"],
  disgust:  ["alternative indie moody", "grunge alternative", "dark indie", "moody rock"],
  neutral:  ["relaxing chill acoustic", "lo-fi study", "peaceful ambient", "soft indie pop"],
};

// ─── Get Spotify token ────────────────────────────────────────
async function getSpotifyToken() {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const body = "grant_type=client_credentials";
  const result = await httpsFetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization":  `Basic ${creds}`,
      "Content-Type":   "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!result.data.access_token) {
    console.error("Spotify token error:", result.data);
    return null;
  }
  return result.data.access_token;
}

// ─── POST /api/songs ─────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { sessionId, emotion = "neutral" } = req.body;
    console.log(`[SONGS] emotion: ${emotion}`);

    const token = await getSpotifyToken();
    if (!token) {
      console.error("[SONGS] Failed to get Spotify token");
      return res.status(500).json({ error: "Spotify auth failed", songs: [] });
    }
    console.log("[SONGS] Got Spotify token ✅");

    const queries = EMOTION_SEARCH[emotion] || ["popular hits"];
const query = queries[Math.floor(Math.random() * queries.length)];
const offset = Math.floor(Math.random() * 40);

const result = await httpsFetch(
  `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&offset=${offset}&market=IN`,
  { headers: { "Authorization": `Bearer ${token}` } }
);

    if (result.data.error) {
      console.error("[SONGS] Spotify search error:", result.data.error);
      return res.status(500).json({ error: result.data.error.message, songs: [] });
    }

const BLOCKED_KEYWORDS = [
  "lofi", "lo-fi", "beats", "mix", "remix", "instrumental",
  "karaoke", "cover", "tribute", "soundtrack", "bgm",
  "ambient", "meditation", "sleep", "relaxing music", "study music"
];

const ALLOWED_LANGUAGES = /^[a-zA-Z\u0900-\u097F0-9\s\-'",!?&().]+$/;


const tracks = (result.data.tracks?.items || [])
  .filter(t =>
    t.type === "track" &&
    t.duration_ms > 60000 &&
    ALLOWED_LANGUAGES.test(t.name) &&
    !BLOCKED_KEYWORDS.some(word => 
      t.name.toLowerCase().includes(word)    
    )
  )
  .sort(() => Math.random() - 0.5)
  .slice(0, 4)
  .map(t => ({ // keep your existing map
        id:     t.id,
        title:  t.name,
        artist: t.artists.map(a => a.name).join(", "),
        year:   t.album.release_date?.split("-")[0],
        emoji:  "🎵",
        poster: t.album.images?.[1]?.url || null,
        link:   t.external_urls?.spotify,
        type:   "song",
      }));

    console.log(`[SONGS] Found ${tracks.length} tracks ✅`);

    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, {
        recommendations: tracks,
        isComplete:      true,
        completedAt:     new Date(),
      });
    }

    res.json({ songs: tracks });
  } catch (err) {
    console.error("[SONGS] Error:", err.message);
    res.status(500).json({ error: err.message, songs: [] });
  }
});

module.exports = router;
