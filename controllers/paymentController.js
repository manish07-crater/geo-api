const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../config/db');

// Lazy initialization — only create when needed (prevents crash if env missing)
function getRazorpay() {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

exports.createOrder = async (req, res) => {
    try {
        const { plan, apiKey } = req.body;
        
        let amount = 0;
        if (plan === 'Pro') amount = 4900; 
        else if (plan === 'Unlimited') amount = 29900;

        if (amount === 0) {
            return res.status(400).json({ success: false, error: "Invalid plan selected" });
        }

        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: `rcpt_${apiKey.substring(0, 5)}_${Date.now()}`,
            notes: { apiKey, plan } // 📝 Store these for webhook reference
        };

        const order = await getRazorpay().orders.create(options);
        res.json({ success: true, order });
    } catch (err) {
        console.error("Error creating order:", err);
        res.status(500).json({ success: false, error: "Failed to create payment order" });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, apiKey } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Upgrade logic (Moved to a shared function helper)
            await upgradeKey(apiKey, plan);
            res.json({ success: true, message: `Successfully upgraded to ${plan} plan! 🎉` });
        } else {
            res.status(400).json({ success: false, error: "Invalid payment signature!" });
        }
    } catch (err) {
        console.error("Error verifying payment:", err);
        res.status(500).json({ error: "Server error during verification" });
    }
};

// 🛡️ Webhook Handler (Safety Net)
exports.handleWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "geo_webhook_secret_123";
    const signature = req.headers["x-razorpay-signature"];

    try {
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (signature === expectedSignature) {
            const event = req.body.event;
            
            // Check for payment success events
            if (event === "order.paid" || event === "payment.captured") {
                const { apiKey, plan } = req.body.payload.payment.entity.notes;
                console.log(`📡 Webhook received: Upgrading ${apiKey} to ${plan}...`);
                await upgradeKey(apiKey, plan);
            }
            
            res.status(200).json({ status: "ok" });
        } else {
            res.status(400).json({ status: "invalid signature" });
        }
    } catch (err) {
        console.error("Webhook Error:", err);
        res.status(500).json({ status: "error" });
    }
};

// Private Helper to avoid code duplication
async function upgradeKey(apiKey, plan) {
    let limit = 100;
    if (plan === "Pro") limit = 10000;
    else if (plan === "Unlimited") limit = 1000000;

    await pool.query(
        "UPDATE api_keys SET plan = $1, daily_limit = $2 WHERE api_key = $3",
        [plan, limit, apiKey]
    );
}
