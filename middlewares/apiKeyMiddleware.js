const pool = require("../config/db");

const apiKeyMiddleware = async (req, res, next) => {
  const key = req.headers["x-api-key"];

  if (!key) {
    return res.status(403).json({ error: "API key missing ❌" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM api_keys WHERE api_key = $1",
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Invalid API key ❌" });
    }

    const api = result.rows[0];
    const today = new Date().toISOString().slice(0, 10);

    // 🔄 Reset daily usage
    if (api.usage_date !== today) {
      await pool.query(
        "UPDATE api_keys SET usage_count = 0, usage_date = $1 WHERE api_key = $2",
        [today, key]
      );
      api.usage_count = 0;
    }

    // ❌ Limit check
    if (api.usage_count >= api.daily_limit) {
      return res.status(429).json({ error: "API limit reached ❌" });
    }

    // ✅ Increment usage
    await pool.query(
      "UPDATE api_keys SET usage_count = usage_count + 1 WHERE api_key = $1",
      [key]
    );

    // attach api details to req if needed later
    req.apiKey = api;
    next();

  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = apiKeyMiddleware;
