import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Migration Registry
 *
 * Each migration must export:
 * - id: unique number (used for tracking completed migrations)
 * - name: descriptive name
 * - up: async function to create/modify tables
 * - down: async function to rollback (optional but recommended)
 *
 * Migrations run in order (by id).
 */

export interface Migration {
  id: number;
  name: string;
  up: (db: mysql.Pool) => Promise<void>;
  down?: (db: mysql.Pool) => Promise<void>;
}

// Import all migrations
import { migration_001 } from './001_create_admin_users.js';
import { migration_002 } from './002_create_password_reset_tokens.js';
import { migration_003 } from './003_create_system_settings.js';
import { migration_004 } from './004_create_mikrotik_devices.js';
import { migration_005 } from './005_create_mikrotik_aps.js';
import { migration_006 } from './006_create_wifi_density.js';
import { migration_007 } from './007_create_notifications.js';
import { migration_008 } from './008_create_vlan_history.js';
import { migration_009 } from './009_create_mikrotik_logs.js';
import { migration_010 } from './010_create_device_uptime_logs.js';
import { migration_011 } from './011_create_network_controllers.js';
import { migration_012 } from './012_create_tickets.js';
import { migration_013 } from './013_create_ticket_replies.js';
import { migration_014 } from './014_seed_default_data.js';

export const migrations: Migration[] = [
  migration_001,
  migration_002,
  migration_003,
  migration_004,
  migration_005,
  migration_006,
  migration_007,
  migration_008,
  migration_009,
  migration_010,
  migration_011,
  migration_012,
  migration_013,
  migration_014,
];

export const getMigrationTableName = () => 'migrations_history';