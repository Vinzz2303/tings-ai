import 'dotenv/config'
import pool from './src/db'

async function migrate() {
  const query = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(512) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_endpoint (user_id, endpoint(255))
    )
  `
  try {
    await pool.query(query)
    console.log('Migration successful: push_subscriptions table created')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    process.exit(0)
  }
}

migrate()
