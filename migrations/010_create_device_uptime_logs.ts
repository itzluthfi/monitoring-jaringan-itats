import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_010: Migration = {
  id: 10,
  name: 'Create device_uptime_logs table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS device_uptime_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        node_id VARCHAR(50) NOT NULL,
        node_name VARCHAR(255),
        status VARCHAR(20) NOT NULL,
        entity_type VARCHAR(20) DEFAULT 'mikrotik',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_node (node_id, created_at),
        INDEX idx_entity (entity_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 010] device_uptime_logs table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS device_uptime_logs');
    console.log('[Migration 010] device_uptime_logs table dropped');
  }
};