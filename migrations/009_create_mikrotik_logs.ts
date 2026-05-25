import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_009: Migration = {
  id: 9,
  name: 'Create mikrotik_logs table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        mikrotik_id VARCHAR(50),
        time VARCHAR(100),
        topics VARCHAR(255),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lookup (device_id, created_at),
        INDEX idx_topics (topics)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 009] mikrotik_logs table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS mikrotik_logs');
    console.log('[Migration 009] mikrotik_logs table dropped');
  }
};