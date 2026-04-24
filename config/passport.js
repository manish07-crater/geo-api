const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const pool = require("./db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Helper to find or create user
async function findOrCreateUser(email, name, providerId, provider) {
  try {
    let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      return result.rows[0];
    } else {
      // Auto-register
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(8).toString("hex"), 10);
      const userName = name || email.split("@")[0];
      const newUser = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
        [userName, email, dummyPassword]
      );
      return newUser.rows[0];
    }
  } catch (err) {
    throw err;
  }
}

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET",
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        if (!email) return done(new Error("No email found from Google"), null);

        const user = await findOrCreateUser(email, profile.displayName, profile.id, "Google");
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// GitHub Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || "GITHUB_CLIENT_ID",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "GITHUB_CLIENT_SECRET",
      callbackURL: "/api/auth/github/callback",
      scope: ["user:email"], // IMPORTANT: Required to fetch private emails from GitHub
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        // If email is not public, GitHub strategy with scope: ['user:email'] usually populates it,
        // but if not, fallback to profile.username as pseudo-email or error out.
        if (!email) {
            email = profile.username + "@github.com"; 
        }

        const user = await findOrCreateUser(email, profile.displayName || profile.username, profile.id, "GitHub");
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
