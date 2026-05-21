import { db } from '../server/db';
import { createMikrotikClient } from '../server/routes/mikrotiks.route';

async function main() {
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    
    for (const device of devices) {
      if (device.status !== 'online') continue;
      console.log(`\n--- Testing ${device.name} (${device.host}) ---`);
      
      const client = createMikrotikClient(device);
      const api = await client.connect();
      
      try {
        console.log("1. Fetching interface names...");
        const ifaces = await (api as any).rosApi.write(["/interface/print"]).catch(() => []);
        const names = ifaces.map((i: any) => i.name).filter(Boolean);
        console.log(`Found interfaces: ${names.join(', ')}`);
        
        console.log("2. Testing monitor-traffic with individual interface names...");
        if (names.length > 0) {
          const namesParam = names.join(',');
          console.log(`Calling monitor-traffic with interface=${namesParam}`);
          const results = await (api as any).rosApi.write([
            "/interface/monitor-traffic",
            `=interface=${namesParam}`,
            "=once="
          ]);
          console.log(`Success! Monitor results count: ${results.length}`);
          if (results.length > 0) {
            console.log("Sample monitor result:", JSON.stringify(results[0], null, 2));
          }
        }
      } catch (err: any) {
        console.error("Method 1 (comma-separated names) failed:", err.message || err);
      }
      
      try {
        console.log("3. Testing monitor-traffic with interface=all...");
        const results = await (api as any).rosApi.write([
          "/interface/monitor-traffic",
          "=interface=all",
          "=once="
        ]);
        console.log(`Success with interface=all! Count: ${results.length}`);
      } catch (err: any) {
        console.error("Method 2 (interface=all) failed:", err.message || err);
      }
      
      await client.close();
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
