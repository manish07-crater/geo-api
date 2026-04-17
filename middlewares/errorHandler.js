const fs = require('fs');
const path = require('path');

// Global Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const errorLog = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${statusCode} - ${err.stack || message}\n`;

    console.error("❌ Global Error:", err.stack || err.message);
    
    // Write error to log file
    fs.appendFileSync(path.join(__dirname, '../server.log'), errorLog);
    
    res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};
  
  module.exports = errorHandler;
