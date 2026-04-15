import { db } from '../db';

async function cleanup() {
  console.log('--- Starting Topology Ghost Node Cleanup ---');
  try {
    // 1. Cari data yang polanya mencurigakan (bukan AP asli)
    const [rows]: any = await db.query(`
      SELECT id, name, mac_address 
      FROM mikrotik_aps 
      WHERE 
        mac_address LIKE 'neighbor-node-%' OR 
        mac_address LIKE 'segment-dhcp-%' OR 
        mac_address LIKE 'iface-node-%' OR
        name LIKE 'segment-dhcp-%' OR
        name = 'Backbone Link' OR
        name = 'Core Link' OR
        name IN ('AP-GedA-101', 'AP-GedB-201', 'AP-Kantin', 'AP-Library')
    `);

    if (rows.length === 0) {
      console.log('No ghost nodes found in database.');
      process.exit(0);
    }

    console.log(`Found ${rows.length} ghost nodes. Deleting...`);
    
    for (const row of rows) {
      console.log(`Deleting node: ${row.name} (${row.mac_address})`);
      await db.query('DELETE FROM mikrotik_aps WHERE id = ?', [row.id]);
      // Juga bersihkan logs yang terkait agar tidak nyampah
      await db.query('DELETE FROM device_uptime_logs WHERE node_id = ?', [`ap-${row.id}`]);
    }

    console.log('--- Cleanup Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
