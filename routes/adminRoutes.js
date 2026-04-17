const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken } = require("../middlewares/jwtAuth");

// Route to get all user's api keys
router.get("/keys", verifyToken, adminController.getAllKeys);

// Route to get overall database statistics
router.get("/stats", adminController.getStats);
router.post("/toggle-key/:keyId", verifyToken, adminController.toggleKeyStatus);

module.exports = router;
