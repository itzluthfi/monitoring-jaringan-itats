import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_012: Migration = {
  id: 12,
  name: 'Create tickets table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_code VARCHAR(50) UNIQUE NOT NULL,
        reporter_id VARCHAR(50) NOT NULL,
        reporter_name VARCHAR(255) NOT NULL,
        reporter_email VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        photo_url VARCHAR(255) NULL,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (ticket_code),
        INDEX idx_status (status),
        INDEX idx_reporter (reporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 012] tickets table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS tickets');
    console.log('[Migration 012] tickets table dropped');
  }
};