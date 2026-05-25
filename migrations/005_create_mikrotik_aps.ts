import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_005: Migration = {
  id: 5,
  name: 'Create mikrotik_aps table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_aps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mikrotik_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        mac_address VARCHAR(50) UNIQUE,
        ip_address VARCHAR(100) NULL,
        interface_name VARCHAR(100) NULL,
        mode VARCHAR(50) DEFAULT 'ap',
        group_label VARCHAR(100),
        status VARCHAR(20) DEFAULT 'online',
        last_client_count INT DEFAULT 0,
        last_error TEXT NULL,
        lat FLOAT NULL,
        lng FLOAT NULL,
        last_seen TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mikrotik (mikrotik_id),
        INDEX idx_mac (mac_address),
        INDEX idx_status (status),
        FOREIGN KEY (mikrotik_id) REFERENCES mikrotik_devices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 005] mikrotik_aps table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS mikrotik_aps');
    console.log('[Migration 005] mikrotik_aps table dropped');
  }
};