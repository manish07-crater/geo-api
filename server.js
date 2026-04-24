require("dotenv").config(); // 🌍 Load Environment Variables
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan"); // 🗃️ Request Logger
const pool = require("./config/db");

// Routes Import
const authRoutes = require("./routes/authRoutes");
const searchRoutes = require("./routes/searchRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const errorHandler = require("./middlewares/errorHandler"); // 🛑 Global Error Handler

const app = express();

/* ================================
   🛡️ SECURITY & MIDDLEWARES
================================ */
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"]
}));


app.use(express.json());

// 🗃️ Logger configuration (shows API requests in terminal)
app.use(morgan("dev"));

// 🚦 Global Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { success: false, error: "Too many requests from this IP, please try again after 15 minutes" },
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use(apiLimiter);

/* ================================
   🏠 PUBLIC ROUTES
================================ */
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/test-db", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err); // sends to global error handler
  }
});

/* ================================
   🚀 API ROUTES
================================ */
app.use("/api/auth", authRoutes);     
app.use("/api/payments", paymentRoutes);
app.use("/api", searchRoutes);        
app.use("/admin", adminRoutes);       

/* ================================
   🛑 ERROR HANDLING
================================ */
// Catch-all route for invalid URLs
app.use((req, res) => {
  res.status(404).json({ success: false, error: "API Route Not Found" });
});

// Global Error Handler Middleware (must be added at the end)
app.use(errorHandler);

/* ================================
   🚀 SERVER START
================================ */
const PORT = process.env.PORT || 3000;

// Local development: start the server normally
// Vercel: export the app for serverless function invocation
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

module.exports = app;