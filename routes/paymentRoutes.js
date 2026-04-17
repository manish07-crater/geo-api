const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/jwtAuth');

// Protected payment routes
router.post('/create-order', verifyToken, paymentController.createOrder);
router.post('/verify', verifyToken, paymentController.verifyPayment);

// Webhook for Razorpay (Public, no JWT)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
