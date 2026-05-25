import { db } from '../db.js';

async function dump() {
  try {
    const [aps]: any = await db.query('SELECT * FROM mikrotik_aps');
    console.log('--- MIKROTIK APS ---');
    console.log(JSON.stringify(aps, null, 2));

    const [devices]: any = await db.query('SELECT * FROM mikrotik_devices');
    console.log('--- MIKROTIK DEVICES ---');
    console.log(JSON.stringify(devices, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

dump();
