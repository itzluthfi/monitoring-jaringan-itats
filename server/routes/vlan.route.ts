import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { createMikrotikClient } from './mikrotiks.route';

export const vlanRouter = Router();

vlanRouter.get('/:id/vlan-traffic', async (req, res) => {
  try {
    if (req.params.id === 'all') {
      const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
      
      if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
        let allVlans: any[] = [];
        devices.forEach((d: any) => {
          const simIfaces = [{n: 'vlan10', t: 'vlan'}, {n: 'vlan20', t: 'vlan'}, {n: 'ether1', t: 'ether'}, {n: 'ether2', t: 'ether'}, {n: 'bridge1', t: 'bridge'}];
          const deviceVlans = simIfaces.map((vItem, i) => ({
            name: `${vItem.n} [${d.name}]`, 
            type: vItem.t, running: 'true', disabled: i === 2 ? 'true' : 'false',
            interface: `ether${(i % 3) + 1}`,
            'rx-byte': String(Math.floor(Math.random() * 500000000)),
            'tx-byte': String(Math.floor(Math.random() * 500000000)),
            'rx-packet': String(Math.floor(Math.random() * 500000)),
            'tx-packet': String(Math.floor(Math.random() * 500000)),
            'rx-rate': String(Math.floor(Math.random() * 10485760)),
            'tx-rate': String(Math.floor(Math.random() * 10485760)),
          }));
          allVlans = allVlans.concat(deviceVlans);
        });
        return res.json(allVlans);
      }
      
      const onlineDevices = devices.filter((d: any) => d.status === 'online');
      const promises = onlineDevices.map(async (device: any) => {
        try {
          const client = createMikrotikClient(device);
          const api = await client.connect();
          const [ifaces, vlansDetail] = await Promise.all([
            (api as any).rosApi.write(["/interface/print", "=stats="]).catch(() => []),
            (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => []),
          ]);
          await client.close();
          const vlanNames = new Set((vlansDetail || []).map((v: any) => v.name));
          return (ifaces || [])
            .map((v: any) => ({ 
              ...v, 
              name: `${v.name} [${device.name}]`,
              'rx-rate': v['rx-bits-per-second'] || v['rx-rate'] || v['fp-rx-bits-per-second'] || 0,
              'tx-rate': v['tx-bits-per-second'] || v['tx-rate'] || v['fp-tx-bits-per-second'] || 0
            }));
        } catch (e) {
          return [];
        }
      });
      const results = await Promise.all(promises);
      return res.json(results.flat());
    }

    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (process.env.MIKROTIK_SIMULATION_MODE === "true" || device.status !== 'online') {
      const simIfaces = [{n: 'vlan10', t: 'vlan'}, {n: 'vlan20', t: 'vlan'}, {n: 'ether1', t: 'ether'}, {n: 'ether2', t: 'ether'}, {n: 'bridge1', t: 'bridge'}];
      return res.json(simIfaces.map((vItem, i) => ({
        name: `${vItem.n}`, type: vItem.t, running: 'true', disabled: i === 2 ? 'true' : 'false',
        interface: `ether${(i % 5) + 1}`,
        'rx-byte': String(Math.floor(Math.random() * 500000000)),
        'tx-byte': String(Math.floor(Math.random() * 500000000)),
        'rx-packet': String(Math.floor(Math.random() * 500000)),
        'tx-packet': String(Math.floor(Math.random() * 500000)),
        'rx-rate': String(Math.floor(Math.random() * 10485760)),
        'tx-rate': String(Math.floor(Math.random() * 10485760)),
      })));
    }

    const client = createMikrotikClient(device);
    const api = await client.connect();
    const [ifaces, vlansDetail, monitorResults] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]).catch(() => []),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => []),
      (api as any).rosApi.write(["/interface/monitor-traffic", "=interface=all", "=once="]).catch(() => [])
    ]);
    await client.close();

    const monitorMap: Record<string, any> = {};
    if (Array.isArray(monitorResults)) {
      monitorResults.forEach((m: any) => {
        if (m.name) monitorMap[m.name] = m;
      });
    }

    const vlanNames = new Set((vlansDetail || []).map((v: any) => v.name));
    const vlans = (ifaces || []).map((v: any) => {
      const m = monitorMap[v.name] || {};
      return {
        ...v,
        'rx-rate': m['rx-bits-per-second'] || v['rx-bits-per-second'] || v['rx-rate'] || v['fp-rx-bits-per-second'] || 0,
        'tx-rate': m['tx-bits-per-second'] || v['tx-bits-per-second'] || v['tx-rate'] || v['fp-tx-bits-per-second'] || 0
      };
    });
    res.json(vlans);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

vlanRouter.get('/:id/vlan-history', async (req, res) => {
  try {
    const range = req.query.range || '30d'; // 24h, 30d, 90d
    let limit = 24; // fallback
    if (range === '24h') limit = 24;
    else if (range === '30d') limit = 30 * 24;
    else if (range === '90d') limit = 90 * 24;

    let queryParams: any[] = [];

    // In simulation mode: return generated mock history
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      const vlanNames = ['vlan10', 'vlan20', 'vlan30', 'vlan40', 'vlan50'];
      const now = Date.now();
      const HOUR_MS = 3600000;
      let points = 24;
      if (range === '30d') points = 30 * 24;
      if (range === '90d') points = 90 * 24;
      const step = Math.floor(points / 48) || 1; // max 48 chart points for performance

      const timeline: Record<string, any> = {};
      for (let i = points; i >= 0; i -= step) {
        const ts = new Date(now - i * HOUR_MS).toISOString().slice(0, 16);
        if (!timeline[ts]) timeline[ts] = { timestamp: ts };
        const hour = new Date(now - i * HOUR_MS).getHours();
        const factor = (hour >= 8 && hour <= 16) ? 3 : (hour >= 17 && hour <= 21) ? 1.5 : 0.4;
        vlanNames.forEach(vlan => {
          timeline[ts][`${vlan}_rx`] = Math.floor((Math.random() * 500000 + 100000) * factor);
          timeline[ts][`${vlan}_tx`] = Math.floor((Math.random() * 200000 + 50000) * factor);
        });
      }
      return res.json(Object.values(timeline).sort((a: any, b: any) => a.timestamp > b.timestamp ? 1 : -1));
    }

    let queryStr = `
      SELECT vlan_name, 
             DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as time_group,
             MAX(rx_byte) as max_rx, 
             MAX(tx_byte) as max_tx
      FROM vlan_history
    `;

    if (req.params.id !== 'all') {
      queryStr += ` WHERE device_id = ? `;
      queryParams.push(req.params.id);
    }
    
    queryStr += ` 
      GROUP BY vlan_name, time_group
      ORDER BY time_group DESC 
      LIMIT ?
    `;
    queryParams.push(limit * 3); // Approx 3 vlans * limit hours

    const [rows]: any = await db.query(queryStr, queryParams);
    
    // Group by time_group
    const timelineMap: Record<string, any> = {};
    for (const row of rows) {
       const t = row.time_group;
       if (!timelineMap[t]) timelineMap[t] = { timestamp: t };
       timelineMap[t][`${row.vlan_name}_rx`] = row.max_rx;
       timelineMap[t][`${row.vlan_name}_tx`] = row.max_tx;
    }
    
    // Sort chronological
    const sorted = Object.values(timelineMap).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
