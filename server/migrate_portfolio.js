const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

(async () => {
  try {
    const conn = await mysql.createConnection({ 
      host: process.env.DB_HOST, 
      user: process.env.DB_USER, 
      password: process.env.DB_PASSWORD, 
      database: process.env.DB_NAME 
    });
    
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS portfolio_holdings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        average_price DECIMAL(15,4) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_user_symbol (user_id, symbol)
      )
    `);
    
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS portfolio_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        type ENUM('BUY', 'SELL') NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        price DECIMAL(15,4) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Successfully created portfolio tables');
    await conn.end();
  } catch (err) {
    console.error('Migration error:', err);
  }
})();
