import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_015: Migration = {
  id: 15,
  name: 'Create system_ai_logs table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_ai_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mode VARCHAR(50),
        model VARCHAR(100),
        status VARCHAR(20),
        prompt TEXT,
        response TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 015] system_ai_logs table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS system_ai_logs');
    console.log('[Migration 015] system_ai_logs table dropped');
  }
};
