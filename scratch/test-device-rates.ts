import { db } from '../server/db';
import { createMikrotikClient } from '../server/routes/mikrotiks.route';

async function testDevice(id: number) {
  const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [id]);
  if (!device) {
    console.log(`Device ID ${id} not found.`);
    return;
  }
  console.log(`\n=== Testing Device ID ${id} (${device.name}) ===`);
  const client = createMikrotikClient(device);
  try {
    const api = await client.connect();
    const [interfaces, vlans] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => [])
    ]);

    const interfaceNames = Array.isArray(interfaces)
      ? interfaces.map((i: any) => i.name).filter(Boolean)
      : [];

    let monitorResults = [];
    if (interfaceNames.length > 0) {
      const namesStr = interfaceNames.join(',');
      monitorResults = await (api as any).rosApi.write([
        "/interface/monitor-traffic",
        `=interface=${namesStr}`,
        "=once="
      ]).catch((e: any) => {
        console.warn(`[Interfaces] Failed to monitor traffic:`, e?.message || e);
        return [];
      });
    }

    await client.close();

    console.log("Total interfaces:", interfaces.length);
    console.log("Total monitor results:", monitorResults.length);

    if (monitorResults.length > 0) {
      console.log("Sample monitor result:", monitorResults[0]);
    }

    // Map monitor results by interface name for quick lookup
    const monitorMap: Record<string, any> = {};
    if (Array.isArray(monitorResults)) {
      monitorResults.forEach((m: any) => {
        if (m.name) monitorMap[m.name] = m;
      });
    }

    const mapped = (interfaces || []).map((i: any) => {
      const m = monitorMap[i.name] || {};
      
      const rxRate = m['rx-bits-per-second'] || i['rx-bits-per-second'] || i['rx-rate'] || i['fp-rx-bits-per-second'] || 0;
      const txRate = m['tx-bits-per-second'] || i['tx-bits-per-second'] || i['tx-rate'] || i['fp-tx-bits-per-second'] || 0;

      return {
        name: i.name,
        'rx-bits-per-sec': m['rx-bits-per-second'],
        'i-rx-rate': i['rx-rate'],
        'fp-rx-bits-per-sec': i['fp-rx-bits-per-second'],
        rxRate,
        txRate
      };
    });

    console.log("First 5 mapped results:", mapped.slice(0, 5));
  } catch (err: any) {
    console.error("Error testing device:", err.message || err);
    await client.close().catch(() => {});
  }
}

async function main() {
  await testDevice(3); // GEDUNG G LANTAI 1
  await testDevice(2); // KELAS F & H
  await testDevice(11); // DNS
  process.exit(0);
}

main();
