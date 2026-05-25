import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_004: Migration = {
  id: 4,
  name: 'Create mikrotik_devices table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        host VARCHAR(255),
        user VARCHAR(255),
        password VARCHAR(255),
        port INT DEFAULT 8728,
        logs_enabled TINYINT DEFAULT 1,
        snmp_community VARCHAR(255) DEFAULT 'public',
        is_primary TINYINT(1) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP NULL,
        lat FLOAT NULL,
        lng FLOAT NULL,
        level INT DEFAULT NULL,
        driver VARCHAR(50) DEFAULT 'mikrotik',
        snmp_port INT DEFAULT 161,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_is_primary (is_primary)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 004] mikrotik_devices table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS mikrotik_devices');
    console.log('[Migration 004] mikrotik_devices table dropped');
  }
};