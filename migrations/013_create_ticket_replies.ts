import mysql from 'mysql2/promise';
import type { Migration } from './index.js';

export const migration_013: Migration = {
  id: 13,
  name: 'Create ticket_replies table',
  up: async (db: mysql.Pool) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        sender_type VARCHAR(10) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        photo_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id),
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Migration 013] ticket_replies table created');
  },
  down: async (db: mysql.Pool) => {
    await db.query('DROP TABLE IF EXISTS ticket_replies');
    console.log('[Migration 013] ticket_replies table dropped');
  }
};