import { db } from '../server/db';
import { createMikrotikClient } from '../server/routes/mikrotiks.route';

async function main() {
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    console.log("Devices in database:", devices.map((d: any) => ({ id: d.id, name: d.name, host: d.host, status: d.status, driver: d.driver })));
    
    for (const device of devices) {
      if (device.status !== 'online') {
        console.log(`Device ${device.name} is offline, skipping client connection test.`);
        continue;
      }
      console.log(`Connecting to ${device.name} (${device.host})...`);
      try {
        const client = createMikrotikClient(device);
        const api = await client.connect();
        
        console.log("Fetching /interface/print + stats...");
        const [interfaces, vlans, monitorResults] = await Promise.all([
          (api as any).rosApi.write(["/interface/print", "=stats="]).catch((e: any) => { console.error("Err print:", e); return []; }),
          (api as any).rosApi.write(["/interface/vlan/print"]).catch((e: any) => { console.error("Err vlan:", e); return []; }),
          (api as any).rosApi.write(["/interface/monitor-traffic", "=interface=all", "=once="]).catch((e: any) => { console.error("Err monitor:", e); return []; })
        ]);
        
        await client.close();
        
        console.log(`Success! Interfaces returned: ${interfaces.length}, VLANs: ${vlans.length}, Monitor results: ${monitorResults.length}`);
        
        // Print sample interface and monitor-traffic results
        if (interfaces.length > 0) {
          console.log("Sample interface:", JSON.stringify(interfaces[0], null, 2));
        }
        if (monitorResults.length > 0) {
          console.log("Sample monitor result:", JSON.stringify(monitorResults[0], null, 2));
        }
        
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
            type: i.type,
            'rx-rate': rxRate,
            'tx-rate': txRate,
          };
        });
        
        console.log("Sample mapped interfaces:", mapped.slice(0, 5));
        
      } catch (err) {
        console.error(`Failed to communicate with ${device.name}:`, err);
      }
    }
  } catch (error) {
    console.error("Database error:", error);
  } finally {
    process.exit(0);
  }
}

main();
