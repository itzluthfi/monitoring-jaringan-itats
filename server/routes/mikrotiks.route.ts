import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { RouterOSClient } from 'routeros-client';
import snmp from 'net-snmp';

export const mikrotiksRouter = Router();

// MikroTik Client Helper
export const createMikrotikClient = (device: any) => {
  return new RouterOSClient({
    host: device.host,
    user: device.user,
    password: device.password,
    port: device.port || 8728,
  });
};

mikrotiksRouter.get('/stats', requireAuth, async (req, res) => {
  try {
    const [[stats]]: any = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
      FROM mikrotik_devices
    `);
    
    // cast to numbers for safety since SUM returns strings in some mysql configurations
    res.json({
      total: Number(stats.total) || 0,
      online: Number(stats.online) || 0,
      offline: Number(stats.offline) || 0
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.get('/', requireAuth, async (req, res) => {
  try {
    const [devices] = await db.query("SELECT id, name, host, user, port, last_seen, status, is_primary, lat, lng FROM mikrotik_devices");
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/primary', requireAuth, async (req, res) => {
  const connection = await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'monitoring_itats',
  });
  
  try {
    await connection.beginTransaction();
    await connection.query("UPDATE mikrotik_devices SET is_primary = 0");
    await connection.query("UPDATE mikrotik_devices SET is_primary = 1 WHERE id = ?", [req.params.id]);
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: String(err) });
  } finally {
    await connection.end();
  }
});

mikrotiksRouter.post('/', requireAuth, async (req, res) => {
  const { name, host, user, password, port, lat, lng } = req.body;
  if (!name || !host || !user || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const [result]: any = await db.query(
      "INSERT INTO mikrotik_devices (name, host, user, password, port, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, host, user, password, port || 8728, lat || null, lng || null]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.put('/:id', requireAuth, async (req, res) => {
  const { name, host, user, password, port, lat, lng } = req.body;
  if (!name || !host || !user) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const latVal = (lat !== '' && lat !== undefined && lat !== null) ? parseFloat(lat) : null;
  const lngVal = (lng !== '' && lng !== undefined && lng !== null) ? parseFloat(lng) : null;

  try {
    if (password) {
      await db.query(
        "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, password = ?, port = ?, lat = ?, lng = ? WHERE id = ?",
        [name, host, user, password, port || 8728, latVal, lngVal, req.params.id]
      );
    } else {
      await db.query(
        "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, port = ?, lat = ?, lng = ? WHERE id = ?",
        [name, host, user, port || 8728, latVal, lngVal, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.get('/:id/status', async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
        return res.json({
          online: true,
          protocol: 'SNMP', // Tag to show UI
          identity: device.name,
          uptime: "10h 20m 30s",
          version: "RouterOS Simulation",
          cpuLoad: Math.floor(Math.random() * 20) + 5,
          freeMemory: 1048576 * (Math.floor(Math.random() * 50) + 100),
        });
    }

    // SNMP Check for Telemetry
    const community = device.snmp_community || "public";
    const session = snmp.createSession(device.host, community);
    
    const getOid = (oid: string): Promise<any> => new Promise((resolve) => {
      session.get([oid], (error, varbinds) => {
        if (error || snmp.isVarbindError(varbinds[0])) {
          resolve(null);
        } else {
          resolve(varbinds[0].value);
        }
      });
    });

    try {
      const [versionRaw, uptimeTicks, identityRaw, freeMemoryRaw, cpuLoadRaw] = await Promise.all([
        getOid("1.3.6.1.2.1.1.1.0"), // sysDescr (Version details)
        getOid("1.3.6.1.2.1.1.3.0"), // sysUpTime
        getOid("1.3.6.1.2.1.1.5.0"), // sysName (Identity)
        getOid("1.3.6.1.4.1.14988.1.1.1.4.1.0"), // mtMemFree
        getOid("1.3.6.1.4.1.14988.1.1.1.4.2.0")  // mtProcessorLoad
      ]);

      session.close();

      if (uptimeTicks === null) {
        const isPrivateIP = device.host.startsWith("192.168.") || device.host.startsWith("10.") || device.host.startsWith("172.");
        let errorMsg = `Koneksi SNMP Gagal. Pastikan IP->SNMP->Enabled dan Community='${community}'.`;
        if (isPrivateIP) errorMsg += " (Private IP mungkin tidak bisa diakses).";
        return res.json({ online: false, protocol: 'SNMP', error: errorMsg });
      }

      let uptime = "N/A";
      if (uptimeTicks !== null) {
          const seconds = Math.floor(Number(uptimeTicks) / 100);
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          uptime = `${h}h ${m}m`;
      }

      const versionStr = versionRaw ? versionRaw.toString() : "RouterOS";
      const identityStr = identityRaw ? identityRaw.toString() : device.name;

      res.json({
        online: true,
        protocol: 'SNMP',
        identity: identityStr,
        uptime,
        version: versionStr.split(' ')[0] || versionStr,
        cpuLoad: cpuLoadRaw ? Number(cpuLoadRaw) : 0,
        freeMemory: freeMemoryRaw ? Number(freeMemoryRaw) : 0
      });
    } catch (err: any) {
      session.close();
      res.json({ online: false, protocol: 'SNMP', error: `SNMP Handler Error: ${err.message}` });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/reboot', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/system/reboot").print();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.get('/:id/interfaces', async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      return res.json([
        { '.id': '*5', name: 'bridge - Backbone', type: 'bridge', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 837, 'rx-packet': 1070, 'fp-tx-byte': 0, 'fp-rx-byte': 9200021, parent: null },
        { '.id': '*6', name: 'bridge - Client', type: 'bridge', running: 'true', disabled: 'false', 'tx-byte': '0', 'rx-byte': '0', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 0, 'rx-packet': 0, 'fp-tx-byte': 0, 'fp-rx-byte': 0, parent: null },
        { '.id': '*1', name: 'ether1', type: 'ether', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 853, 'rx-packet': 1172, 'fp-tx-byte': 1769700, 'fp-rx-byte': 9400000, parent: null },
        { '.id': '*3', name: 'vlan - Backbone', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 837, 'rx-packet': 1070, 'fp-tx-byte': 0, 'fp-rx-byte': 9300000, parent: 'ether1' },
        { '.id': '*2', name: 'ether2 - Gedung A', type: 'ether', running: 'true', disabled: 'false', 'tx-byte': '2048000', 'rx-byte': '1048000', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 957, 'rx-packet': 1021, 'fp-tx-byte': 9200000, 'fp-rx-byte': 1808800, parent: null },
        { '.id': '*7', name: 'vlan - Lecturer', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '409600', 'rx-byte': '204800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 954, 'rx-packet': 818, 'fp-tx-byte': 0, 'fp-rx-byte': 1633900, parent: 'ether2 - Gedung A' },
        { '.id': '*8', name: 'vlan - Public', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '0', 'rx-byte': '0', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 0, 'rx-packet': 0, 'fp-tx-byte': 0, 'fp-rx-byte': 0, parent: 'ether2 - Gedung A' },
        { '.id': '*9', name: 'vlan - Titik', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '12400', 'rx-byte': '42000', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 3, 'rx-packet': 5, 'fp-tx-byte': 0, 'fp-rx-byte': 4100, parent: 'ether2 - Gedung A' }
      ]);
    }

    const client = createMikrotikClient(device);
    const api = await client.connect();
    const [interfaces, vlans] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => [])
    ]);
    await client.close();

    const vlanParents: Record<string, string> = {};
    if (Array.isArray(vlans)) {
      vlans.forEach((v: any) => {
        if (v.name && v.interface) vlanParents[v.name] = v.interface;
      });
    }

    const mapped = (interfaces || []).map((i: any) => ({
      ...i,
      parent: vlanParents[i.name] || null
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/interfaces/:name/toggle', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { disabled } = req.body;
    const action = disabled === "true" ? "enable" : "disable";

    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/interface").where({ name: req.params.name }).exec(action);
    await client.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/set-identity', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/system/identity").set({ name });
    await client.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/exec', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "Command is required" });

    const client = createMikrotikClient(device);
    const api = await client.connect();
    const parts = Array.isArray(command) 
      ? command 
      : typeof command === 'string' 
        ? command.split(' ').map((s: string) => s.trim()).filter(Boolean) 
        : [];
        
    const result = await (api as any).rosApi.write(parts);
    await client.close();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.get('/:id/queues', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      return res.json([
        { '.id': '*1', name: 'limit-192.168.1.10', target: '192.168.1.10/32', 'max-limit': '10M/10M', disabled: 'false', comment: 'Client A', 'rx-rate': '512000', 'tx-rate': '256000', 'total-queue': '2' },
        { '.id': '*2', name: 'limit-vlan10', target: '192.168.10.0/24', 'max-limit': '50M/50M', disabled: 'false', comment: 'VLAN Mahasiswa', 'rx-rate': '4194304', 'tx-rate': '2097152', 'total-queue': '18' },
        { '.id': '*3', name: 'limit-vlan20', target: '192.168.20.0/24', 'max-limit': '20M/20M', disabled: 'true', comment: 'VLAN Staff', 'rx-rate': '0', 'tx-rate': '0', 'total-queue': '0' },
      ]);
    }
  
    const client = createMikrotikClient(device);
    const api = await client.connect();
    
    // Two separate calls: config (max-limit, target, etc.) + stats (rate, bytes)
    const [configQueues, statsQueues] = await Promise.all([
      (api as any).rosApi.write(["/queue/simple/print"]).catch(() => []),
      (api as any).rosApi.write(["/queue/simple/print", "=stats="]).catch(() => []),
    ]);
    await client.close();
    
    const statsMap: Record<string, any> = {};
    (statsQueues || []).forEach((s: any) => {
      if (s['.id']) statsMap[s['.id']] = s;
    });
    
    const merged = (configQueues || []).map((q: any) => {
      const stats = statsMap[q['.id']] || {};
      const merged = { ...q, ...stats };
      
      if (merged.rate && typeof merged.rate === 'string') {
        const parts = merged.rate.split('/');
        if (parts.length === 2) {
          merged['tx-rate'] = parts[0];
          merged['rx-rate'] = parts[1];
        }
      }
      if (merged.bytes && typeof merged.bytes === 'string') {
        const parts = merged.bytes.split('/');
        if (parts.length === 2) {
          merged['tx-byte'] = parts[0];
          merged['rx-byte'] = parts[1];
        }
      }
      if (merged['packet-rate'] && typeof merged['packet-rate'] === 'string') {
        const parts = merged['packet-rate'].split('/');
        if (parts.length === 2) {
          merged['tx-packet-rate'] = parts[0];
          merged['rx-packet-rate'] = parts[1];
        }
      }
      return merged;
    });
    
    res.json(merged);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

mikrotiksRouter.post('/:id/queues', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { name, target, maxLimit, burstLimit, comment } = req.body;
    if (!name || !target || !maxLimit) return res.status(400).json({ error: "name, target, maxLimit required" });
  
    const client = createMikrotikClient(device);
    const api = await client.connect();
    const cmd = ["/queue/simple/add", `=name=${name}`, `=target=${target}`, `=max-limit=${maxLimit}`];
    if (burstLimit) cmd.push(`=burst-limit=${burstLimit}`);
    if (comment) cmd.push(`=comment=${comment}`);
    await (api as any).rosApi.write(cmd);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

mikrotiksRouter.put('/:id/queues/:qid', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { name, target, maxLimit, comment } = req.body;
    const client = createMikrotikClient(device);
    const api = await client.connect();
    const cmd = ["/queue/simple/set", `=.id=${req.params.qid}`];
    if (name) cmd.push(`=name=${name}`);
    if (target) cmd.push(`=target=${target}`);
    if (maxLimit) cmd.push(`=max-limit=${maxLimit}`);
    if (comment !== undefined) cmd.push(`=comment=${comment}`);
    await (api as any).rosApi.write(cmd);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

mikrotiksRouter.put('/:id/queues/:qid/toggle', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { disabled } = req.body;
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await (api as any).rosApi.write(["/queue/simple/set", `=.id=${req.params.qid}`, `=disabled=${disabled}`]);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

mikrotiksRouter.delete('/:id/queues/:qid', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const client = createMikrotikClient(device);
    const api = await client.connect();
    await (api as any).rosApi.write(["/queue/simple/remove", `=.id=${req.params.qid}`]);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ─── Debug: Lihat raw data WiFi dari MikroTik ───
mikrotiksRouter.get('/:id/debug-wifi', async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const client = createMikrotikClient(device);
    const api = await client.connect();

    const [
      sysResource,
      capManager,
      capRemoteCap,
      capAccessPoints,
      capIfaces,
      capRegTable,
      capRadios,
      wlanIfaces,
      wlanRegTable,
      dhcpLeases,
      wifiIfaces,        // RouterOS v7
      wifiRegTable,      // RouterOS v7
      neighbors,
    ] = await Promise.all([
      (api as any).rosApi.write(["/system/resource/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/manager/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/remote-cap/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/access-point/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/interface/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/registration-table/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/caps-man/radio/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/interface/wireless/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/interface/wireless/registration-table/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/ip/dhcp-server/lease/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/interface/wifi/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/interface/wifi/registration-table/print"]).catch((e: any) => ({ error: String(e) })),
      (api as any).rosApi.write(["/ip/neighbor/print"]).catch((e: any) => ({ error: String(e) })),
    ]);

    await client.close();

    // Extract RouterOS version
    const rosVersion = Array.isArray(sysResource) && sysResource[0]
      ? sysResource[0]['version'] || 'unknown'
      : 'unknown';
    const rosMajorVersion = parseInt(rosVersion.split('.')[0]) || 6;

    // CAPsMAN manager status
    const capManagerEnabled = Array.isArray(capManager) && capManager.length > 0
      ? (capManager[0]?.enabled === 'true' || capManager[0]?.enabled === true)
      : false;

    const len = (v: any) => Array.isArray(v) ? v.length : (v?.error ? `ERROR: ${v.error}` : 'unknown');

    res.json({
      device: { id: device.id, name: device.name, host: device.host },
      ros: { version: rosVersion, majorVersion: rosMajorVersion },
      diagnosis: {
        capsman_manager_enabled: capManagerEnabled,
        capsman_remote_caps: len(capRemoteCap),
        recommendation: !capManagerEnabled
          ? '⚠️ CAPsMAN belum aktif. Di WinBox: CAPsMAN → Manager → centang Enabled'
          : (len(capRemoteCap) === 0
            ? '⚠️ CAPsMAN aktif tapi tidak ada AP yang join. Cek: /caps-man/remote-cap/print'
            : '✅ CAPsMAN aktif dan ada remote-cap terdaftar'),
        routeros_version_note: rosMajorVersion >= 7
          ? '📌 RouterOS v7: gunakan /interface/wifi/ bukan /interface/wireless/'
          : '📌 RouterOS v6: gunakan /interface/wireless/ dan /caps-man/',
      },
      summary: {
        '[v6] caps-man/manager-enabled': capManagerEnabled,
        '[v6] caps-man/remote-cap': len(capRemoteCap),
        '[v6] caps-man/access-point': len(capAccessPoints),
        '[v6] caps-man/interface': len(capIfaces),
        '[v6] caps-man/registration-table': len(capRegTable),
        '[v6] caps-man/radio': len(capRadios),
        '[v6] interface/wireless': len(wlanIfaces),
        '[v6] interface/wireless/registration-table': len(wlanRegTable),
        '[v7] interface/wifi': len(wifiIfaces),
        '[v7] interface/wifi/registration-table': len(wifiRegTable),
        'ip/dhcp-server/lease': len(dhcpLeases),
        'ip/neighbor': len(neighbors),
      },
      data: {
        capManager,
        capRemoteCap,
        capAccessPoints,
        capIfaces,
        capRegTable,
        capRadios,
        wlanIfaces,
        wlanRegTable,
        wifiIfaces,
        wifiRegTable,
        dhcpLeases,
        neighbors,
      }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
