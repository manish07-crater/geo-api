require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function upgradeDatabase() {
  console.log("🚀 Starting Database Upgrade for SaaS Platform...");
  const client = await pool.connect();
  
  try {
    // 1. Create Trigram Extension for Fast Auto-complete
    console.log("⚙️ Creating pg_trgm extension...");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

    // 2. Create GIN index on village names for sub-100ms ILIKE queries
    console.log("⚙️ Skipping pg_trgm index to save disk space for users table...");
    // await client.query("CREATE INDEX IF NOT EXISTS village_name_trgm_idx ON village USING gin (name gin_trgm_ops);");

    // 3. Create Users Table
    console.log("⚙️ Creating users table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Upgrade api_keys table with SaaS models (plans)
    console.log("⚙️ Adding 'user_id' and 'plan' column to api_keys table...");
    await client.query(`
      ALTER TABLE api_keys 
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'Free';
    `);

    // Ensure we have a secure default for daily_limit column if not already set tightly
    await client.query(`
      ALTER TABLE api_keys 
      ALTER COLUMN daily_limit SET DEFAULT 100;
    `);

    console.log("✅ Database Upgrade Complete! Fully SaaS Ready.");
  } catch (err) {
    console.error("❌ Error during upgrade:", err);
  } finally {
    client.release();
    pool.end();
  }
}

upgradeDatabase();
