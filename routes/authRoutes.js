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
router.post("/social-login", authController.socialLogin);

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
