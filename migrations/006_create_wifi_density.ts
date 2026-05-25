import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_006: Migration = {
  id: 6,
  name: 'Create wifi_density table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wifi_density (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_count INT,
        ap_name VARCHAR(255),
        INDEX idx_timestamp (timestamp),
        INDEX idx_ap_name (ap_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 006] wifi_density table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS wifi_density');
    console.log('[Migration 006] wifi_density table dropped');
  }
};