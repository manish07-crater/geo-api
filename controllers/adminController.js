const pool = require("../config/db");

// Controller to fetch active keys for logged in user
exports.getAllKeys = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM api_keys WHERE user_id = $1 ORDER BY usage_count DESC", [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching keys:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Controller to fetch overall database statistics
exports.getStats = async (req, res) => {
  try {
    const villageCount = await pool.query("SELECT COUNT(*) FROM village");
    const stateCount = await pool.query("SELECT COUNT(*) FROM state");
    const districtCount = await pool.query("SELECT COUNT(*) FROM district");
    const subDistrictCount = await pool.query("SELECT COUNT(*) FROM sub_district");
    const userCount = await pool.query("SELECT COUNT(*) FROM users"); // 👥 New: Total Users
    const activeKeysCount = await pool.query("SELECT COUNT(*) FROM api_keys"); // 🔑 New: Total Active Keys
    
    res.json({
      villages: parseInt(villageCount.rows[0].count),
      states: parseInt(stateCount.rows[0].count),
      districts: parseInt(districtCount.rows[0].count),
      subDistricts: parseInt(subDistrictCount.rows[0].count),
      users: parseInt(userCount.rows[0].count),
      totalKeys: parseInt(activeKeysCount.rows[0].count),
      revenue: "₹1.2M+" // Placeholder for Mock revenue
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Server error fetching stats" });
  }
};

// Toggle API Key active status
exports.toggleKeyStatus = async (req, res) => {
  try {
    const { keyId } = req.params;
    const { status } = req.body; // true or false
    
    await pool.query("UPDATE api_keys SET is_active = $1 WHERE id = $2 AND user_id = $3", [status, keyId, req.user.id]);
    res.json({ success: true, message: "Status updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle status" });
  }
};
