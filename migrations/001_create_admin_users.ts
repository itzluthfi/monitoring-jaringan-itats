import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_001: Migration = {
  id: 1,
  name: 'Create admin_users table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        role VARCHAR(20) DEFAULT 'admin',
        is_active TINYINT DEFAULT 1,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 001] admin_users table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS admin_users');
    console.log('[Migration 001] admin_users table dropped');
  }
};