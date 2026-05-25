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
import {001_create_admin_users} from './001_create_admin_users.js';
import {002_create_password_reset_tokens} from './002_create_password_reset_tokens.js';
import {003_create_system_settings} from './003_create_system_settings.js';
import {004_create_mikrotik_devices} from './004_create_mikrotik_devices.js';
import {005_create_mikrotik_aps} from './005_create_mikrotik_aps.js';
import {006_create_wifi_density} from './006_create_wifi_density.js';
import {007_create_notifications} from './007_create_notifications.js';
import {008_create_vlan_history} from './008_create_vlan_history.js';
import {009_create_mikrotik_logs} from './009_create_mikrotik_logs.js';
import {010_create_device_uptime_logs} from './010_create_device_uptime_logs.js';
import {011_create_network_controllers} from './011_create_network_controllers.js';
import {012_create_tickets} from './012_create_tickets.js';
import {013_create_ticket_replies} from './013_create_ticket_replies.js';
import {014_seed_default_data} from './014_seed_default_data.js';

export const migrations: Migration[] = [
  001_create_admin_users,
  002_create_password_reset_tokens,
  003_create_system_settings,
  004_create_mikrotik_devices,
  005_create_mikrotik_aps,
  006_create_wifi_density,
  007_create_notifications,
  008_create_vlan_history,
  009_create_mikrotik_logs,
  010_create_device_uptime_logs,
  011_create_network_controllers,
  012_create_tickets,
  013_create_ticket_replies,
  014_seed_default_data,
];

export const getMigrationTableName = () => 'migrations_history';