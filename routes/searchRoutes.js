const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const apiKeyMiddleware = require("../middlewares/apiKeyMiddleware");

// Protected search endpoint
router.get("/search", apiKeyMiddleware, searchController.searchLocations);

module.exports = router;
