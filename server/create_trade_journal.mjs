import mysql from 'mysql2/promise';

const cfg = {
  host: '127.0.0.1',
  user: 'porto_db',
  password: 'Porto_Secure_2026!',
  database: 'portofolio_app',
};

const c = await mysql.createConnection(cfg);

await c.execute(`
  CREATE TABLE IF NOT EXISTS trade_journal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pair VARCHAR(20) NOT NULL,
    direction ENUM('BUY','SELL') NOT NULL,
    lot_size DECIMAL(10,2) NOT NULL,
    entry_price DECIMAL(12,5) NOT NULL,
    stop_loss DECIMAL(12,5),
    take_profit DECIMAL(12,5),
    exit_price DECIMAL(12,5),
    status ENUM('OPEN','CLOSED','CANCELLED') DEFAULT 'OPEN',
    setup_type VARCHAR(100),
    pre_trade_emotion VARCHAR(100),
    post_trade_emotion VARCHAR(100),
    notes TEXT,
    ai_bias_analysis TEXT,
    pnl DECIMAL(12,2),
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_pair (pair)
  )
`);

console.log('✅ trade_journal table created successfully');
await c.end();
