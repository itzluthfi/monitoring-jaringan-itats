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
    const [[routerStats]]: any = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
      FROM mikrotik_devices
    `);
    
    const [[apStats]]: any = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
      FROM mikrotik_aps
    `);
    
    res.json({
      total: Number(routerStats.total) || 0,
      online: Number(routerStats.online) || 0,
      offline: Number(routerStats.offline) || 0,
      apTotal: Number(apStats.total) || 0,
      apOnline: Number(apStats.online) || 0,
      apOffline: Number(apStats.offline) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.get('/', requireAuth, async (req, res) => {
  try {
    const [devices] = await db.query("SELECT id, name, host, user, port, last_seen, status, is_primary, lat, lng, level, logs_enabled, driver, snmp_community, snmp_port FROM mikrotik_devices");
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

mikrotiksRouter.post('/:id/toggle-logs', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;
    await db.query("UPDATE mikrotik_devices SET logs_enabled = ? WHERE id = ?", [enabled ? 1 : 0, req.params.id]);
    res.json({ success: true });
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
  const { name, host, user, password, port, lat, lng, level, driver, snmp_community, snmp_port } = req.body;
  if (!name || !host || !user || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const [result]: any = await db.query(
      "INSERT INTO mikrotik_devices (name, host, user, password, port, lat, lng, level, driver, snmp_community, snmp_port) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name, host, user, password, port || 8728, lat || null, lng || null, level || null, driver || 'mikrotik', snmp_community || 'public', snmp_port || 161]
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
  const { name, host, user, password, port, lat, lng, level, driver, snmp_community, snmp_port } = req.body;
  if (!name || !host || !user) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const latVal = (lat !== '' && lat !== undefined && lat !== null) ? parseFloat(lat) : null;
  const lngVal = (lng !== '' && lng !== undefined && lng !== null) ? parseFloat(lng) : null;
  const driverVal = driver || 'mikrotik';
  const snmpCommunityVal = snmp_community || 'public';
  const snmpPortVal = snmp_port || 161;

  try {
    if (password) {
      await db.query(
        "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, password = ?, port = ?, lat = ?, lng = ?, level = ?, driver = ?, snmp_community = ?, snmp_port = ? WHERE id = ?",
        [name, host, user, password, port || 8728, latVal, lngVal, level || null, driverVal, snmpCommunityVal, snmpPortVal, req.params.id]
      );
    } else {
      await db.query(
        "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, port = ?, lat = ?, lng = ?, level = ?, driver = ?, snmp_community = ?, snmp_port = ? WHERE id = ?",
        [name, host, user, port || 8728, latVal, lngVal, level || null, driverVal, snmpCommunityVal, snmpPortVal, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── FIX #6: Retry helper dengan exponential backoff ──────────────────────
// Digunakan untuk koneksi yang kadang gagal karena transient timeout.
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient = err?.errno === 'ECONNRESET' || err?.message?.includes('timeout') ||
        err?.message?.includes('Timed out') || err?.name === 'RosException';
      if (isTransient && attempt < retries) {
        console.warn(`[Retry] Attempt ${attempt + 1}/${retries} failed, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

mikrotiksRouter.get('/:id/status', async (req, res) => {
  try {
    const [[device]]: any = await db.query("SELECT * FROM mikrotik_devices WHERE id = ?", [req.params.id]);
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
        return res.json({
          online: true,
          protocol: 'Simulation',
          identity: device.name,
          uptime: "10h 20m 30s",
          version: "RouterOS Simulation",
          cpuLoad: Math.floor(Math.random() * 20) + 5,
          freeMemory: 1048576 * (Math.floor(Math.random() * 50) + 100),
        });
    }

    const deviceDriver = (device.driver || 'mikrotik').toLowerCase();

    // ─────────────────────────────────────────────────────────────────────────
    // FIX #5: Gunakan RouterOS API untuk MikroTik (bukan SNMP)
    // Logika SNMP lama di bawah tetap dipakai untuk driver 'snmp'
    // ─────────────────────────────────────────────────────────────────────────
    if (deviceDriver === 'mikrotik') {
      try {
        const result = await withRetry(async () => {
          const client = createMikrotikClient(device);
          const api = await client.connect();
          const [resSys, identityArr] = await Promise.all([
            (api as any).rosApi.write(['/system/resource/print']).catch(() => [{}]),
            (api as any).rosApi.write(['/system/identity/print']).catch(() => [{}]),
          ]);
          await client.close().catch(() => {});
          return { resSys, identityArr };
        });

        const sys = Array.isArray(result.resSys) ? result.resSys[0] || {} : {};
        const identity = Array.isArray(result.identityArr) ? result.identityArr[0] || {} : {};

        return res.json({
          online: true,
          protocol: 'RouterOS API',
          identity: identity.name || device.name,
          uptime: sys.uptime || '0s',
          version: sys.version || 'Unknown',
          cpuLoad: Number(sys['cpu-load'] || 0),
          freeMemory: Number(sys['free-memory'] || 0),
          totalMemory: Number(sys['total-memory'] || 0),
        });
      } catch (err: any) {
        return res.json({
          online: false,
          protocol: 'RouterOS API',
          error: err?.message || String(err),
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIKA SNMP LAMA — tetap utuh, dipakai untuk driver 'snmp' dan lainnya
    // ─────────────────────────────────────────────────────────────────────────
    const community = device.snmp_community || "public";
    const session = snmp.createSession(device.host, community, {
      port: device.snmp_port || 161,
      timeout: 5000,
      retries: 1,
    });
    
    const getOid = (oid: string): Promise<any> => new Promise((resolve) => {
      session.get([oid], (error: any, varbinds: any[]) => {
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
        getOid("1.3.6.1.4.1.14988.1.1.1.4.1.0"), // mtMemFree (MikroTik-specific, will be null for others)
        getOid("1.3.6.1.4.1.14988.1.1.1.4.2.0")  // mtProcessorLoad (MikroTik-specific)
      ]);

      session.close();

      if (uptimeTicks === null) {
        const isPrivateIP = device.host.startsWith("192.168.") || device.host.startsWith("10.") || device.host.startsWith("172.");
        let errorMsg = `Koneksi SNMP Gagal. Pastikan IP→SNMP→Enabled dan Community='${community}'.`;
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

    // ─────────────────────────────────────────────────────────────────────────
    // ── CABANG BARU: SNMP / Driver selain MikroTik (ADDITIVE — tidak mengubah logika lama) ──
    //
    // Jika device dikonfigurasi dengan driver 'snmp' (atau driver lain non-mikrotik),
    // gunakan SNMP adapter yang sudah dinormalisasi. Logika MikroTik original
    // di bawah ini TIDAK disentuh dan tetap berjalan untuk driver 'mikrotik'.
    // ─────────────────────────────────────────────────────────────────────────
    const deviceDriver = (device.driver || 'mikrotik').toLowerCase();

    if (deviceDriver !== 'mikrotik') {
      console.log(`[Interfaces] Device "${device.name}" (id=${device.id}) menggunakan driver "${deviceDriver}" — routing ke SNMP adapter.`);

      // ── Guard: pastikan net-snmp tersedia ──
      let snmpAdapterModule: any;
      try {
        snmpAdapterModule = await import('../adapters/snmp.adapter');
      } catch (importErr) {
        console.error('[Interfaces/SNMP] Gagal load SNMP adapter:', importErr);
        return res.status(503).json({
          error: 'SNMP adapter tidak tersedia. Pastikan net-snmp terinstall.',
          driver: deviceDriver,
          hint: 'Jalankan: npm install net-snmp'
        });
      }

      const adapter = new snmpAdapterModule.SnmpAdapter();

      // ── Guard: validasi konfigurasi SNMP device ──
      if (!device.host) {
        return res.status(400).json({
          error: 'Device tidak memiliki IP host yang valid untuk koneksi SNMP.',
          driver: deviceDriver
        });
      }

      const community = device.snmp_community || 'public';
      const snmpPort = device.snmp_port || 161;

      // Beri tahu jika pakai default community (kemungkinan belum dikonfigurasi)
      if (community === 'public') {
        console.warn(`[Interfaces/SNMP] Device "${device.name}" menggunakan SNMP community default "public". Pastikan sudah dikonfigurasi.`);
      }

      try {
        const interfaces = await adapter.getInterfaces({
          ...device,
          snmp_community: community,
          snmp_port: snmpPort,
        });

        // ── Guard: data kosong (SNMP tidak merespons atau tidak ada interface) ──
        if (!Array.isArray(interfaces) || interfaces.length === 0) {
          console.warn(`[Interfaces/SNMP] Device "${device.name}" — SNMP berhasil terhubung tapi data interface kosong.`);
          return res.json({
            _snmpWarning: true,
            _message: `SNMP terhubung ke ${device.host} (community: "${community}") tapi tidak ada interface yang ditemukan. Pastikan SNMP MIB IF-MIB aktif di perangkat.`,
            _hint: 'Coba cek: snmpwalk -v2c -c ' + community + ' ' + device.host + ' 1.3.6.1.2.1.2.2.1.2',
            interfaces: []
          });
        }

        console.log(`[Interfaces/SNMP] Device "${device.name}" — berhasil mengambil ${interfaces.length} interface.`);
        return res.json(interfaces);

      } catch (snmpErr: any) {
        const errMsg = snmpErr?.message || String(snmpErr);
        console.error(`[Interfaces/SNMP] Gagal mengambil interface dari "${device.name}" (${device.host}):`, errMsg);

        // ── Klasifikasi jenis error SNMP untuk pesan yang informatif ──
        let userMessage = `Gagal terhubung ke SNMP pada ${device.host}:${snmpPort}.`;
        let hint = '';

        if (errMsg.includes('timeout') || errMsg.includes('Timed out') || errMsg.includes('ETIMEDOUT')) {
          userMessage = `Koneksi SNMP timeout ke ${device.host}:${snmpPort}.`;
          hint = `Kemungkinan penyebab: (1) SNMP belum diaktifkan di perangkat, (2) Firewall memblokir port UDP ${snmpPort}, (3) IP tidak dapat dijangkau dari server.`;
        } else if (errMsg.includes('ECONNREFUSED')) {
          userMessage = `Koneksi SNMP ditolak oleh ${device.host}:${snmpPort}.`;
          hint = 'Pastikan service SNMP sudah berjalan di perangkat dan port tidak diblokir.';
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('EHOSTUNREACH')) {
          userMessage = `Host ${device.host} tidak dapat dijangkau.`;
          hint = 'Periksa bahwa IP address device sudah benar dan bisa di-ping dari server.';
        } else if (errMsg.includes('noSuchName') || errMsg.includes('noSuchObject')) {
          userMessage = `SNMP terhubung tapi OID IF-MIB tidak didukung oleh ${device.name}.`;
          hint = 'Perangkat mungkin tidak mendukung IF-MIB standar. Coba aktifkan SNMP MIB di pengaturan perangkat.';
        } else if (errMsg.includes('community') || errMsg.includes('authentication') || errMsg.includes('noAccess')) {
          userMessage = `SNMP Community string tidak valid. Community "${community}" ditolak oleh ${device.name}.`;
          hint = `Perbarui SNMP Community di menu Edit Device → SNMP Community. Default biasanya "public".`;
        }

        return res.status(502).json({
          error: userMessage,
          hint,
          driver: deviceDriver,
          host: device.host,
          port: snmpPort,
          community,
          raw: errMsg,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ── LOGIKA MIKROTIK LAMA — TIDAK DIUBAH SAMA SEKALI (mulai dari sini) ──
    // Driver: 'mikrotik' (default)
    // ─────────────────────────────────────────────────────────────────────────

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      return res.json([
        { '.id': '*5', name: 'bridge - Backbone', type: 'bridge', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 837, 'rx-packet': 1070, 'fp-tx-byte': 0, 'fp-rx-byte': 9200021, parent: null, 'rx-rate': String(Math.floor(Math.random() * 5000000)), 'tx-rate': String(Math.floor(Math.random() * 2000000)) },
        { '.id': '*6', name: 'bridge - Client', type: 'bridge', running: 'true', disabled: 'false', 'tx-byte': '0', 'rx-byte': '0', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 0, 'rx-packet': 0, 'fp-tx-byte': 0, 'fp-rx-byte': 0, parent: null, 'rx-rate': '0', 'tx-rate': '0' },
        { '.id': '*1', name: 'ether1', type: 'ether', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 853, 'rx-packet': 1172, 'fp-tx-byte': 1769700, 'fp-rx-byte': 9400000, parent: null, 'rx-rate': String(Math.floor(Math.random() * 5000000)), 'tx-rate': String(Math.floor(Math.random() * 2000000)) },
        { '.id': '*3', name: 'vlan - Backbone', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '104857600', 'rx-byte': '52428800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 837, 'rx-packet': 1070, 'fp-tx-byte': 0, 'fp-rx-byte': 9300000, parent: 'ether1', 'rx-rate': String(Math.floor(Math.random() * 2000000)), 'tx-rate': String(Math.floor(Math.random() * 1000000)) },
        { '.id': '*2', name: 'ether2 - Gedung A', type: 'ether', running: 'true', disabled: 'false', 'tx-byte': '2048000', 'rx-byte': '1048000', 'actual-mtu': 1500, 'l2mtu': 1598, 'tx-packet': 957, 'rx-packet': 1021, 'fp-tx-byte': 9200000, 'fp-rx-byte': 1808800, parent: null, 'rx-rate': String(Math.floor(Math.random() * 1000000)), 'tx-rate': String(Math.floor(Math.random() * 500000)) },
        { '.id': '*7', name: 'vlan - Lecturer', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '409600', 'rx-byte': '204800', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 954, 'rx-packet': 818, 'fp-tx-byte': 0, 'fp-rx-byte': 1633900, parent: 'ether2 - Gedung A', 'rx-rate': String(Math.floor(Math.random() * 500000)), 'tx-rate': String(Math.floor(Math.random() * 200000)) },
        { '.id': '*8', name: 'vlan - Public', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '0', 'rx-byte': '0', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 0, 'rx-packet': 0, 'fp-tx-byte': 0, 'fp-rx-byte': 0, parent: 'ether2 - Gedung A', 'rx-rate': '0', 'tx-rate': '0' },
        { '.id': '*9', name: 'vlan - Titik', type: 'vlan', running: 'true', disabled: 'false', 'tx-byte': '12400', 'rx-byte': '42000', 'actual-mtu': 1500, 'l2mtu': 1594, 'tx-packet': 3, 'rx-packet': 5, 'fp-tx-byte': 0, 'fp-rx-byte': 4100, parent: 'ether2 - Gedung A', 'rx-rate': String(Math.floor(Math.random() * 10000)), 'tx-rate': String(Math.floor(Math.random() * 5000)) }
      ]);
    }

    const client = createMikrotikClient(device);
    const api = await client.connect();
    const [interfaces, vlans, monitorResults] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => []),
      (api as any).rosApi.write(["/interface/monitor-traffic", "=interface=all", "=once="]).catch(() => [])
    ]);
    await client.close();

    const vlanParents: Record<string, string> = {};
    if (Array.isArray(vlans)) {
      vlans.forEach((v: any) => {
        if (v.name && v.interface) vlanParents[v.name] = v.interface;
      });
    }

    // Map monitor results by interface name for quick lookup
    const monitorMap: Record<string, any> = {};
    if (Array.isArray(monitorResults)) {
      monitorResults.forEach((m: any) => {
        if (m.name) monitorMap[m.name] = m;
      });
    }

    const mapped = (interfaces || []).map((i: any) => {
      // Get rates from monitor-traffic first as it's more accurate for real-time bps
      const m = monitorMap[i.name] || {};
      
      const rxRate = m['rx-bits-per-second'] || i['rx-bits-per-second'] || i['rx-rate'] || i['fp-rx-bits-per-second'] || 0;
      const txRate = m['tx-bits-per-second'] || i['tx-bits-per-second'] || i['tx-rate'] || i['fp-tx-bits-per-second'] || 0;

      return {
        ...i,
        'rx-rate': rxRate,
        'tx-rate': txRate,
        parent: vlanParents[i.name] || null
      };
    });

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
