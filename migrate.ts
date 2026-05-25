/**
 * Nexus - Database Migration CLI
 *
 * Usage:
 *   npm run migrate          - Run all pending migrations
 *   npm run migrate:rollback - Rollback last migration
 *   npm run migrate:reset    - Reset all migrations (drop all tables)
 *   npm run migrate:status   - Show migration status
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration from .env
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wifi_itats.db',
};

const MIGRATIONS_TABLE = 'migrations_history';

async function createDatabaseIfNotExists(): Promise<void> {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await connection.end();
  console.log(`[Database] '${dbConfig.database}' ensured`);
}

async function getPool(): Promise<mysql.Pool> {
  await createDatabaseIfNotExists();
  return mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

async function createMigrationsTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getExecutedMigrations(pool: mysql.Pool): Promise<number[]> {
  try {
    const [rows]: any = await pool.query(`SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY id`);
    return rows.map((r: any) => r.id);
  } catch {
    return [];
  }
}

async function markMigrationExecuted(pool: mysql.Pool, id: number, name: string): Promise<void> {
  await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (id, name) VALUES (?, ?)`, [id, name]);
}

async function removeMigrationExecuted(pool: mysql.Pool, id: number): Promise<void> {
  await pool.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE id = ?`, [id]);
}

// Dynamic import all migration files
async function loadMigrations(): Promise<any[]> {
  const migrationFiles = [
    './migrations/001_create_admin_users.js',
    './migrations/002_create_password_reset_tokens.js',
    './migrations/003_create_system_settings.js',
    './migrations/004_create_mikrotik_devices.js',
    './migrations/005_create_mikrotik_aps.js',
    './migrations/006_create_wifi_density.js',
    './migrations/007_create_notifications.js',
    './migrations/008_create_vlan_history.js',
    './migrations/009_create_mikrotik_logs.js',
    './migrations/010_create_device_uptime_logs.js',
    './migrations/011_create_network_controllers.js',
    './migrations/012_create_tickets.js',
    './migrations/013_create_ticket_replies.js',
    './migrations/014_seed_default_data.js',
  ];

  const migrations = [];
  for (const file of migrationFiles) {
    const module = await import(file);
    const key = Object.keys(module).find(k => k.startsWith('migration_'));
    if (key) {
      migrations.push(module[key]);
    }
  }
  return migrations.sort((a, b) => a.id - b.id);
}

async function runMigrations(): Promise<void> {
  console.log('\n🚀 Starting migrations...\n');

  const pool = await getPool();
  await createMigrationsTable(pool);

  // Load migrations dynamically
  const migrationModules = await loadMigrations();
  const executed = await getExecutedMigrations(pool);

  let runCount = 0;
  for (const migration of migrationModules) {
    if (executed.includes(migration.id)) {
      console.log(`⏭️  [${migration.id}] ${migration.name} - already executed`);
      continue;
    }

    console.log(`▶️  [${migration.id}] Running: ${migration.name}`);
    try {
      await migration.up(pool);
      await markMigrationExecuted(pool, migration.id, migration.name);
      console.log(`✅ [${migration.id}] ${migration.name} - COMPLETED`);
      runCount++;
    } catch (error: any) {
      console.error(`❌ [${migration.id}] ${migration.name} - FAILED: ${error.message}`);
      throw error;
    }
  }

  if (runCount === 0) {
    console.log('\n✅ No pending migrations. Database is up to date.\n');
  } else {
    console.log(`\n✅ Successfully ran ${runCount} migration(s).\n`);
  }

  await pool.end();
}

async function rollbackMigration(): Promise<void> {
  console.log('\n🔄 Rolling back last migration...\n');

  const pool = await getPool();
  await createMigrationsTable(pool);

  const migrationModules = await loadMigrations();
  const executed = await getExecutedMigrations(pool);

  if (executed.length === 0) {
    console.log('No migrations to rollback.');
    await pool.end();
    return;
  }

  // Get the last executed migration
  const lastId = Math.max(...executed);
  const migration = migrationModules.find(m => m.id === lastId);

  if (!migration) {
    console.error(`Migration with id ${lastId} not found.`);
    await pool.end();
    return;
  }

  if (!migration.down) {
    console.error(`Migration [${migration.id}] ${migration.name} has no down() function.`);
    await pool.end();
    return;
  }

  console.log(`▶️  Rolling back: ${migration.name}`);
  try {
    await migration.down(pool);
    await removeMigrationExecuted(pool, migration.id);
    console.log(`✅ Rollback complete: ${migration.name}`);
  } catch (error: any) {
    console.error(`❌ Rollback failed: ${error.message}`);
    throw error;
  }

  await pool.end();
}

async function resetMigrations(): Promise<void> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (text: string) => new Promise<string>((resolve) => {
    rl.question(text, resolve);
  });

  const answer = await question('⚠️  This will DROP ALL tables! Are you sure? (yes/no): ');
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('Reset cancelled.');
    return;
  }

  console.log('\n💥 Resetting all migrations...\n');

  const pool = await getPool();
  const migrationModules = await loadMigrations();

  // Drop tables in reverse order (respecting foreign keys)
  for (const migration of [...migrationModules].reverse()) {
    if (migration.down) {
      try {
        console.log(`▶️  Dropping: ${migration.name}`);
        await migration.down(pool);
        console.log(`✅ Dropped: ${migration.name}`);
      } catch (error: any) {
        console.warn(`⚠️  ${migration.name}: ${error.message}`);
      }
    }
  }

  // Clear migrations history
  await pool.query(`DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}`);

  console.log('\n✅ All tables dropped.\n');
  await pool.end();
}

async function statusMigrations(): Promise<void> {
  console.log('\n📋 Migration Status\n');

  const pool = await getPool();
  await createMigrationsTable(pool);

  const migrationModules = await loadMigrations();
  const executed = await getExecutedMigrations(pool);

  console.log('┌──────┬────────────────────────────────────────────┬───────────┐');
  console.log('│ ID   │ Migration Name                            │ Status    │');
  console.log('├──────┼────────────────────────────────────────────┼───────────┤');

  for (const migration of migrationModules) {
    const status = executed.includes(migration.id) ? '✅ Done' : '⏳ Pending';
    const name = migration.name.padEnd(44).substring(0, 44);
    console.log(`│ ${String(migration.id).padStart(4)} │ ${name} │ ${status.padStart(9)} │`);
  }

  console.log('└──────┴────────────────────────────────────────────┴───────────┘');
  console.log(`\nTotal: ${migrationModules.length} migrations`);
  console.log(`Executed: ${executed.length} | Pending: ${migrationModules.length - executed.length}\n`);

  await pool.end();
}

// CLI Command Router
const command = process.argv[2] || 'up';

async function main() {
  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await runMigrations();
        break;
      case 'down':
      case 'rollback':
        await rollbackMigration();
        break;
      case 'reset':
        await resetMigrations();
        break;
      case 'status':
        await statusMigrations();
        break;
      default:
        console.log(`
Usage: npx tsx migrate.ts <command>

Commands:
  up, migrate          Run all pending migrations (default)
  down, rollback       Rollback last migration
  reset                Drop all tables (requires confirmation)
  status               Show migration status

Examples:
  npm run migrate
  npm run migrate:rollback
  npm run migrate:status
`);
    }
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

main();