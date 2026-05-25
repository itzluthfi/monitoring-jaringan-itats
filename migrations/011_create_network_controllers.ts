import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_011: Migration = {
  id: 11,
  name: 'Create network_controllers table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS network_controllers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        host VARCHAR(255) NOT NULL,
        user VARCHAR(255),
        password VARCHAR(255),
        extra_config JSON NULL,
        status VARCHAR(50) DEFAULT 'unknown',
        last_error TEXT NULL,
        last_sync TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 011] network_controllers table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS network_controllers');
    console.log('[Migration 011] network_controllers table dropped');
  }
};