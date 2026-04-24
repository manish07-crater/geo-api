const crypto = require("crypto");
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // 1. Check if user already exists
    const userExist = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ success: false, error: "User already exists with this email 📧" });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Insert User
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.json({ success: true, message: "Account created successfully! 🎉", user: newUser.rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    // Handle storage limit error specifically if possible
    if (err.code === '57P01' || err.message.includes('storage limit')) {
        return res.status(507).json({ success: false, error: "Database storage limit reached. Please contact admin." });
    }
    res.status(500).json({ success: false, error: "Error during registration" });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid email or password ❌" });
    }

    const user = result.rows[0];

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Invalid email or password ❌" });
    }

    // 3. Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "10d" });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Error during login" });
  }
};

exports.socialLogin = async (req, res) => {
  const { email, name, provider } = req.body;

  if (!email) return res.status(400).json({ success: false, error: "Email is required for social login" });

  try {
    // 1. Check if user already exists
    let user;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      // Auto-register the user if they don't exist
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(8).toString("hex"), 10);
      const userName = name || email.split("@")[0];
      const newUser = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
        [userName, email, dummyPassword]
      );
      user = newUser.rows[0];
    } else {
      user = result.rows[0];
    }

    // 2. Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "10d" });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error("Social Login error:", err);
    res.status(500).json({ success: false, error: "Error during social login" });
  }
};

exports.oauthCallback = (req, res) => {
  try {
    if (!req.user) {
      return res.send(`<script>window.opener.postMessage({ type: "OAUTH_FAILED", error: "Authentication failed" }, "*"); window.close();</script>`);
    }

    const { id, name, email } = req.user;
    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "10d" });

    // Send a script that posts the token back to the main window and closes the popup
    res.send(`
      <script>
        window.opener.postMessage({
          type: "OAUTH_SUCCESS",
          token: "${token}",
          user: { id: "${id}", name: "${name}", email: "${email}" }
        }, "*");
        window.close();
      </script>
    `);
  } catch (err) {
    console.error("OAuth Callback Error:", err);
    res.send(`<script>window.opener.postMessage({ type: "OAUTH_FAILED", error: "Server error" }, "*"); window.close();</script>`);
  }
};

exports.generateKey = async (req, res) => {
  const { name } = req.body;
  
  // Default bounds for free plan
  const plan = "Free";
  const limit = 100;
  
  const apiKey = crypto.randomBytes(16).toString("hex");

  try {
    await pool.query(
      "INSERT INTO api_keys (api_key, name, plan, daily_limit, user_id) VALUES ($1, $2, $3, $4, $5)",
      [apiKey, name, plan, limit, req.user.id]
    );

    res.json({
      success: true,
      message: "API key generated successfully ✅",
      data: {
        apiKey: apiKey,
        plan: plan,
        dailyLimit: limit
      }
    });

  } catch (err) {
    console.error("Error generating key:", err);
    res.status(500).json({ success: false, error: "Error generating API key" });
  }
};

exports.upgradePlan = async (req, res) => {
  // In a real SaaS, this would be hit via Stripe Webhooks after payment
  const { apiKey, newPlan } = req.body;
  if (!apiKey || !newPlan) {
      return res.status(400).json({ success: false, error: "apiKey and newPlan are required." });
  }

  let limit = 100;
  if (newPlan === "Pro") limit = 10000;
  else if (newPlan === "Unlimited") limit = 1000000;
  else return res.status(400).json({ success: false, error: "Invalid plan. Choose 'Pro' or 'Unlimited'." });

  try {
     const result = await pool.query(
      "UPDATE api_keys SET plan = $1, daily_limit = $2 WHERE api_key = $3 RETURNING *",
      [newPlan, limit, apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "API key not found." });
    }

    res.json({
      success: true,
      message: `Successfully upgraded to ${newPlan} plan! 🎉`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error upgrading plan:", err);
    res.status(500).json({ success: false, error: "Error upgrading plan" });
  }
};
