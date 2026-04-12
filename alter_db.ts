import { db } from './server/db.js';

async function run() {
  try {
    console.log("Inserting fake AP logs...");
    await db.query(`INSERT INTO device_uptime_logs (node_id, node_name, status, entity_type) VALUES ('ap-5', 'Ged B - Lab Mhs', 'offline', 'ap')`);
    await db.query(`INSERT INTO device_uptime_logs (node_id, node_name, status, entity_type) VALUES ('ap-5', 'Ged B - Lab Mhs', 'online', 'ap')`);
    
    // For good measure, insert a known offline AP test log
    const [aps]: any = await db.query("SELECT id, name FROM mikrotik_aps LIMIT 1");
    if (aps.length > 0) {
      await db.query(`INSERT INTO device_uptime_logs (node_id, node_name, status, entity_type) VALUES (?, ?, 'offline', 'ap')`, [`ap-${aps[0].id}`, aps[0].name]);
    }
    const [rows] = await db.query(`SELECT * FROM device_uptime_logs ORDER BY created_at DESC LIMIT 10`);
    console.log("LOGS:");
    console.log(rows);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
  process.exit(0);
}

run();
