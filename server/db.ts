import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

// Export the pool directly
export const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'monitoring_itats',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const initializeDB = async () => {
  try {
    // First, ensure database exists by connecting without database selected
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
    });
    const dbName = process.env.DB_NAME || 'monitoring_itats';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // Now initialize tables on the main pool
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        host VARCHAR(255),
        user VARCHAR(255),
        password VARCHAR(255),
        port INT DEFAULT 8728,
        snmp_community VARCHAR(255) DEFAULT 'public',
        is_primary BOOLEAN DEFAULT 0,
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP NULL,
        lat FLOAT NULL,
        lng FLOAT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS wifi_density (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_count INT,
        ap_name VARCHAR(255)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NULL,
        device_name VARCHAR(255) NULL,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS vlan_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        vlan_name VARCHAR(100) NOT NULL,
        rx_byte BIGINT DEFAULT 0,
        tx_byte BIGINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_time (device_id, timestamp)
      )
    `);

    // Seed default admin
    const [users]: any = await db.query('SELECT * FROM admin_users WHERE username = ?', ['admin']);
    if (users.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO admin_users (username, password) VALUES (?, ?)', ['admin', hash]);
      console.log('Default admin seeded (admin/admin123)');
    }

    // Call seedVlanHistory to ensure we have mock data for charts
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      await seedVlanHistory();
    }

    console.log('MySQL Connected & Initialized successfully.');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

async function seedVlanHistory() {
  try {
    const [counts]: any = await db.query('SELECT COUNT(*) as count FROM vlan_history');
    if (counts[0].count > 0) return; // Already seeded

    console.log('Seeding fake VLAN history for 90 days. This might take a moment...');
    
    // We'll generate 1 data point per hour for the last 90 days
    const now = Date.now();
    let values = [];
    const DAY_MS = 24 * 60 * 60 * 1000;
    const HOUR_MS = 60 * 60 * 1000;
    
    const vlans = ['VLAN10-Mahasiswa', 'VLAN20-Dosen', 'VLAN30-Management'];
    // For 90 days, 24 hours per day = 2160 points per VLAN. Total 6480 points.
    
    let timeCursor = now - (90 * DAY_MS);
    
    // Using a baseline byte count and adding wavy variations
    for (let point = 0; point < 2160; point++) {
      timeCursor += HOUR_MS;
      const tDate = new Date(timeCursor).toISOString().slice(0, 19).replace('T', ' ');
      
      for (const vlan of vlans) {
        // base values
        let baseRx = Math.floor(Math.random() * 500000) + 100000;
        let baseTx = Math.floor(Math.random() * 200000) + 50000;
        
        // daytime peaks (9am to 4pm)
        const d = new Date(timeCursor);
        const hour = d.getHours();
        if (hour >= 9 && hour <= 16) {
          baseRx *= (2 + Math.random() * 2);
          baseTx *= (2 + Math.random() * 2);
        }
        // weekend dips
        if (d.getDay() === 0 || d.getDay() === 6) {
          baseRx *= 0.3;
          baseTx *= 0.3;
        }

        values.push(`(1, '${vlan}', ${Math.floor(baseRx)}, ${Math.floor(baseTx)}, '${tDate}')`);
      }

      // Batch insert every 500 to prevent out of memory or query too large
      if (values.length >= 1000) {
        await db.query(`INSERT INTO vlan_history (device_id, vlan_name, rx_byte, tx_byte, timestamp) VALUES ${values.join(',')}`);
        values = [];
      }
    }
    
    if (values.length > 0) {
      await db.query(`INSERT INTO vlan_history (device_id, vlan_name, rx_byte, tx_byte, timestamp) VALUES ${values.join(',')}`);
    }

    console.log('Seeded VLAN history successfully.');
  } catch (error) {
    console.error('Failed to seed vlan history', error);
  }
}
