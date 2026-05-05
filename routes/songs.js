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
  joy:      "happy feel good pop",
  sadness:  "sad heartbreak emotional",
  anger:    "intense powerful rock",
  fear:     "dark atmospheric tense",
  surprise: "energetic upbeat exciting",
  disgust:  "alternative indie moody",
  neutral:  "relaxing chill acoustic",
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

    const query  = EMOTION_SEARCH[emotion] || "popular hits";
    const offset = Math.floor(Math.random() * 5);

const result = await httpsFetch(
  `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&offset=${offset}`,
  { headers: { "Authorization": `Bearer ${token}` } }
);

    if (result.data.error) {
      console.error("[SONGS] Spotify search error:", result.data.error);
      return res.status(500).json({ error: result.data.error.message, songs: [] });
    }

    const tracks = (result.data.tracks?.items || [])
      .filter(t =>
  t.type === "track" &&
  t.duration_ms > 60000 &&
  !t.name.toLowerCase().includes("lofi") &&
  !t.name.toLowerCase().includes("lo-fi") &&
  !t.name.toLowerCase().includes("beats") &&
  !t.name.toLowerCase().includes("mix")
)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map(t => ({
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
