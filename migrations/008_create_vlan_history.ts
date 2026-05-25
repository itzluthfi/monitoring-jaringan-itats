import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_008: Migration = {
  id: 8,
  name: 'Create vlan_history table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS vlan_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        vlan_name VARCHAR(100) NOT NULL,
        rx_byte BIGINT DEFAULT 0,
        tx_byte BIGINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_time (device_id, timestamp),
        INDEX idx_vlan (vlan_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 008] vlan_history table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS vlan_history');
    console.log('[Migration 008] vlan_history table dropped');
  }
};