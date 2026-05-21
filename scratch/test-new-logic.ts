import { db } from '../server/db';
import { createMikrotikClient } from '../server/routes/mikrotiks.route';

async function main() {
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    console.log("Found devices:", devices.map((d: any) => ({ id: d.id, name: d.name, host: d.host, status: d.status })));

    for (const device of devices) {
      console.log(`\n=================== Testing Device: ${device.name} (id=${device.id}, host=${device.host}) ===================`);
      
      const deviceDriver = (device.driver || 'mikrotik').toLowerCase();
      if (deviceDriver !== 'mikrotik') {
        console.log(`Device uses driver: ${deviceDriver}. Skipping RouterOS API test.`);
        continue;
      }

      console.log("1. Simulating connection step...");
      let client;
      let api;
      try {
        client = createMikrotikClient(device);
        api = await client.connect();
        console.log("Connected successfully!");
      } catch (connectErr: any) {
        console.log(`Gracefully caught connection failure: ${connectErr?.message || connectErr}`);
        console.log("Result: [] (No 500 thrown!)");
        continue;
      }

      try {
        console.log("2. Fetching interfaces & VLANs...");
        const [interfaces, vlans] = await Promise.all([
          (api as any).rosApi.write(["/interface/print", "=stats="]),
          (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => [])
        ]);

        const interfaceNames = Array.isArray(interfaces)
          ? interfaces.map((i: any) => i.name).filter(Boolean)
          : [];
        console.log(`Found ${interfaces.length} interfaces: ${interfaceNames.join(', ')}`);

        console.log("3. Monitoring traffic...");
        let monitorResults = [];
        if (interfaceNames.length > 0) {
          const namesStr = interfaceNames.join(',');
          console.log(`Monitoring traffic for: ${namesStr}`);
          monitorResults = await (api as any).rosApi.write([
            "/interface/monitor-traffic",
            `=interface=${namesStr}`,
            "=once="
          ]).catch((e: any) => {
            console.log(`Traffic monitoring warning: ${e?.message || e}`);
            return [];
          });
        }
        console.log(`Success! Received ${monitorResults.length} monitor records.`);

        await client.close().catch(() => {});

        // Map and print sample
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
            'rx-rate': rxRate,
            'tx-rate': txRate
          };
        });

        console.log("Sample mapped rates (first 3):", mapped.slice(0, 3));
      } catch (err: any) {
        console.error("Fetch logic error:", err.message || err);
        await client.close().catch(() => {});
      }
    }
  } catch (err) {
    console.error("Main error:", err);
  } finally {
    process.exit(0);
  }
}

main();
