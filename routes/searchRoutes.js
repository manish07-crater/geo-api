const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const apiKeyMiddleware = require("../middlewares/apiKeyMiddleware");

// Protected search endpoint
router.get("/search", apiKeyMiddleware, searchController.searchLocations);

// Public search for landing page demo
router.get("/public-search", searchController.searchLocations);

module.exports = router;
