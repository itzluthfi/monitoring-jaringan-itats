import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_007: Migration = {
  id: 7,
  name: 'Create notifications table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NULL,
        device_name VARCHAR(255) NULL,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        action_url VARCHAR(255) NULL,
        entity_type VARCHAR(50) DEFAULT 'mikrotik',
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device (device_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 007] notifications table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS notifications');
    console.log('[Migration 007] notifications table dropped');
  }
};