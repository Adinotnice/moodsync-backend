// middleware/deviceId.js
// Extracts and validates the deviceId from request headers
// Frontend sends deviceId in every request header

const { v4: uuidv4 } = require("crypto").randomUUID
  ? require("crypto")
  : { v4: () => Math.random().toString(36).slice(2) };

function deviceIdMiddleware(req, res, next) {
  // Frontend sends deviceId in x-device-id header
  let deviceId = req.headers["x-device-id"];

  // If missing or invalid, generate one (fallback)
  if (!deviceId || deviceId.length < 8) {
    deviceId = require("crypto").randomUUID
      ? require("crypto").randomUUID()
      : Math.random().toString(36).slice(2) + Date.now();
  }

  // Attach to request object for use in route handlers
  req.deviceId = deviceId;
  next();
}

module.exports = deviceIdMiddleware;
