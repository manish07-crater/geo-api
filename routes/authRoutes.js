const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Validation Middlewares
const validateRequest = require("../middlewares/validateRequest");
const { generateKeySchema } = require("../validators/authValidator");

const { verifyToken } = require("../middlewares/jwtAuth");

// Authentication
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/social-login", authController.socialLogin); // MOCK (Kept for compatibility if they still use mock interface tests)

const passport = require("passport");

// --- Google OAuth ---
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  authController.oauthCallback
);

// --- GitHub OAuth ---
router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/" }),
  authController.oauthCallback
);

// Route to generate a new API key with body validation (Secured)
router.post(
  "/generate-key", 
  verifyToken,
  validateRequest(generateKeySchema), 
  authController.generateKey
);

// Route to upgrade plan manually (Stripe webhook simulate)
router.post("/upgrade-plan", authController.upgradePlan);

module.exports = router;
