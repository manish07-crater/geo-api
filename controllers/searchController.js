const pool = require("../config/db");

exports.searchLocations = async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ data: [], meta: { total: 0 } });
    }

    const pageSize = parseInt(limit);
    const offset = (parseInt(page) - 1) * pageSize;

    // Fast search with ILIKE (Wait for pg_trgm index setup in DB for maximum performance)
    const result = await pool.query(
      `
      SELECT DISTINCT v.name AS village,
             sd.name AS sub_district,
             d.name AS district,
             s.name AS state
      FROM village v
      JOIN sub_district sd ON v.sub_district_id = sd.id
      JOIN district d ON sd.district_id = d.id
      JOIN state s ON d.state_id = s.id
      WHERE v.name ILIKE $1
      LIMIT $2 OFFSET $3
      `,
      [`%${q}%`, pageSize, offset]
    );

    res.json({
      data: result.rows.map(v => ({
        village: v.village,
        sub_district: v.sub_district,
        district: v.district,
        state: v.state,
        country: "India"
      })),
      meta: {
        page: parseInt(page),
        limit: pageSize,
        resultCount: result.rows.length
      }
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search error" });
  }
};
