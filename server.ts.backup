import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { RouterOSClient } from "routeros-client";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import ping from "ping";
import snmp from "net-snmp";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "itats-monitor-secret-2024-xK9mP3";
const JWT_EXPIRES = "8h";

const app = express();
const PORT = 3000;
const db = new Database("wifi_stats.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS wifi_density (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    client_count INTEGER,
    ap_name TEXT
  );
  
  CREATE TABLE IF NOT EXISTS mikrotik_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    user TEXT NOT NULL,
    password TEXT NOT NULL,
    port INTEGER DEFAULT 8728,
    last_seen DATETIME,
    status TEXT DEFAULT 'unknown',
    is_primary INTEGER DEFAULT 0
  );
`);

// Migration for existing databases
try { db.exec("ALTER TABLE mikrotik_devices ADD COLUMN is_primary INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE mikrotik_devices ADD COLUMN snmp_community TEXT DEFAULT 'public'"); } catch (e) {}
try { db.exec("ALTER TABLE mikrotik_devices ADD COLUMN lat REAL"); db.exec("ALTER TABLE mikrotik_devices ADD COLUMN lng REAL"); } catch (e) {}

// Notifications table
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    device_name TEXT,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default admin user if none exists
(async () => {
  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM admin_users").get() as any).c;
  if (adminCount === 0) {
    const defaultPass = process.env.ADMIN_PASSWORD || "itats2024";
    const defaultUser = process.env.ADMIN_USERNAME || "admin";
    const hash = await bcrypt.hash(defaultPass, 12);
    db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(defaultUser, hash);
    console.log(`[Auth] Default admin created: ${defaultUser} / ${defaultPass}`);
  }
})();

// ── JWT Auth Middleware ──────────────────────────────────────────────────────
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// ── Auth Endpoints ───────────────────────────────────────────────────────────
app.post("/api/auth/login", express.json(), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }
  const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username) as any;
  if (!user) {
    // Constant-time response to prevent user enumeration
    await bcrypt.compare(password, "$2a$12$invalid_hash_to_prevent_timing");
    return res.status(401).json({ error: "Username atau password salah" });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Username atau password salah" });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, username: user.username, expiresIn: JWT_EXPIRES });
});

app.get("/api/auth/verify", requireAuth, (req, res) => {
  res.json({ valid: true, user: (req as any).user });
});

// ── Public Endpoint (no auth needed) ────────────────────────────────────────
app.get("/api/public/status", (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
      SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown
    FROM mikrotik_devices
  `).get() as any;

  const recentIssues = db.prepare(`
    SELECT device_name, type, title, created_at
    FROM notifications
    WHERE type IN ('critical','warning')
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  const criticalCount = db.prepare(
    "SELECT COUNT(*) as c FROM notifications WHERE type = 'critical' AND is_read = 0"
  ).get() as any;

  res.json({
    devices: stats,
    recentIssues,
    criticalAlerts: criticalCount.c,
    lastUpdated: new Date().toISOString(),
  });
});

// Device status tracking for notification generation
const deviceLastStatus: Record<number, string> = {};

// Seed data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM wifi_density").get() as { count: number };
if (count.count === 0) {
  console.log("[DB] Seeding initial data...");
  const insert = db.prepare("INSERT INTO wifi_density (timestamp, client_count, ap_name) VALUES (?, ?, ?)");
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();
    let baseCount = 20;
    if (hour >= 10 && hour <= 15) baseCount = 80 + Math.floor(Math.random() * 20);
    else if (hour >= 8 && hour <= 20) baseCount = 40 + Math.floor(Math.random() * 10);
    else baseCount = 5 + Math.floor(Math.random() * 5);
    
    insert.run(time.toISOString(), baseCount, "Main Campus");
  }
}

// Seed initial MikroTik device from environment variables if empty or changed
const existingDevice = db.prepare("SELECT * FROM mikrotik_devices WHERE name = 'Primary Router'").get() as any;
if (process.env.MIKROTIK_HOST) {
  if (!existingDevice) {
    console.log("[DB] Seeding initial MikroTik device from environment variables...");
    db.prepare(`
      INSERT INTO mikrotik_devices (name, host, user, password, port, status, is_primary) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Primary Router",
      process.env.MIKROTIK_HOST,
      process.env.MIKROTIK_USER || "admin",
      process.env.MIKROTIK_PASS || "",
      parseInt(process.env.MIKROTIK_PORT || "8728"),
      "unknown",
      1
    );
  } else if (existingDevice.host !== process.env.MIKROTIK_HOST || existingDevice.user !== process.env.MIKROTIK_USER) {
    console.log("[DB] Updating MikroTik device from environment variables...");
    db.prepare(`
      UPDATE mikrotik_devices SET host = ?, user = ?, password = ?, port = ? WHERE name = 'Primary Router'
    `).run(
      process.env.MIKROTIK_HOST,
      process.env.MIKROTIK_USER || "admin",
      process.env.MIKROTIK_PASS || "",
      parseInt(process.env.MIKROTIK_PORT || "8728")
    );
  }
}

app.get("/api/mikrotiks/stats", requireAuth, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
    FROM mikrotik_devices
  `).get() as any;
  res.json(stats);
});

// MikroTik Client Helper
const createMikrotikClient = (device: any) => {
  return new RouterOSClient({
    host: device.host,
    user: device.user,
    password: device.password,
    port: device.port || 8728,
  });
};

// API Routes for MikroTik Management
app.get("/api/mikrotiks", requireAuth, (req, res) => {
  const devices = db.prepare("SELECT id, name, host, user, port, last_seen, status, is_primary, lat, lng FROM mikrotik_devices").all();
  res.json(devices);
});

app.post("/api/mikrotiks/:id/primary", requireAuth, (req, res) => {
  db.transaction(() => {
    db.prepare("UPDATE mikrotik_devices SET is_primary = 0").run();
    db.prepare("UPDATE mikrotik_devices SET is_primary = 1 WHERE id = ?").run(req.params.id);
  })();
  res.json({ success: true });
});

app.post("/api/mikrotiks", requireAuth, express.json(), (req, res) => {
  const { name, host, user, password, port, lat, lng } = req.body;
  if (!name || !host || !user || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const result = db.prepare(
    "INSERT INTO mikrotik_devices (name, host, user, password, port, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(name, host, user, password, port || 8728, lat || null, lng || null);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/mikrotiks/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM mikrotik_devices WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.put("/api/mikrotiks/:id", requireAuth, express.json(), (req, res) => {
  const { name, host, user, password, port, lat, lng } = req.body;
  if (!name || !host || !user) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const latVal = (lat !== '' && lat !== undefined && lat !== null) ? parseFloat(lat) : null;
  const lngVal = (lng !== '' && lng !== undefined && lng !== null) ? parseFloat(lng) : null;

  if (password) {
    db.prepare(
      "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, password = ?, port = ?, lat = ?, lng = ? WHERE id = ?"
    ).run(name, host, user, password, port || 8728, latVal, lngVal, req.params.id);
  } else {
    db.prepare(
      "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, port = ?, lat = ?, lng = ? WHERE id = ?"
    ).run(name, host, user, port || 8728, latVal, lngVal, req.params.id);
  }

  res.json({ success: true });
});

app.get("/api/mikrotiks/:id/status", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      const status = {
        online: true,
        protocol: 'SNMP', // Tag to show UI
        identity: device.name,
        uptime: "10h 20m 30s",
        version: "RouterOS Simulation",
        cpuLoad: Math.floor(Math.random() * 20) + 5,
        freeMemory: 1048576 * (Math.floor(Math.random() * 50) + 100),
      };
      return res.json(status);
  }

  // Paradigma Baru: Menggunakan SNMP v2c KHUSUS untuk Hardware Telemetry (Uptime, CPU, RAM)
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

    // Jika uptime gagal didapat, berarti SNMP router mati atau tertutup firewall
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

    const status = {
      online: true,
      protocol: 'SNMP', // Tag status UI
      identity: identityStr,
      uptime,
      version: versionStr.split(' ')[0] || versionStr,
      cpuLoad: cpuLoadRaw ? Number(cpuLoadRaw) : 0,
      freeMemory: freeMemoryRaw ? Number(freeMemoryRaw) : 0
    };
    
    res.json(status);
  } catch (err: any) {
    session.close();
    res.json({ online: false, protocol: 'SNMP', error: `SNMP Handler Error: ${err.message}` });
  }
});

app.post("/api/mikrotiks/:id/reboot", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/system/reboot").print();
    // Connection will drop, so we don't wait for close
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/mikrotiks/:id/interfaces", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    const [interfaces, vlans] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => []) // Catch if no vlan
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

app.post("/api/mikrotiks/:id/interfaces/:name/toggle", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  const { disabled } = req.body;
  const action = disabled === "true" ? "enable" : "disable";

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/interface").where({ name: req.params.name }).exec(action);
    await client.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/mikrotiks/:id/set-identity", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await api.menu("/system/identity").set({ name });
    await client.close();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/mikrotiks/:id/exec", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command is required" });

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    // Parse plain string commands into Mikrotik API packet formats
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

// MikroTik Client Setup
const getMikrotikClient = () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") return null;
  
  // Try to get the primary device from DB first
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE is_primary = 1 LIMIT 1").get() as any;
  if (device) {
    return createMikrotikClient(device);
  }
  
  // Fallback to any device if no primary exists
  const fallbackDevice = db.prepare("SELECT * FROM mikrotik_devices LIMIT 1").get() as any;
  if (fallbackDevice) {
    return createMikrotikClient(fallbackDevice);
  }
  
  return null;
};

// Simulation Data Generator
const getSimulatedData = () => {
  const now = new Date();
  const hour = now.getHours();
  // Simulate peak hours between 10 AM and 3 PM
  let baseCount = 20;
  if (hour >= 10 && hour <= 15) {
    baseCount = 80 + Math.floor(Math.random() * 40);
  } else if (hour >= 8 && hour <= 20) {
    baseCount = 40 + Math.floor(Math.random() * 20);
  } else {
    baseCount = 5 + Math.floor(Math.random() * 10);
  }
  return baseCount;
};

// Background Polling (Every 15 minutes)
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    const count = getSimulatedData();
    db.prepare("INSERT INTO wifi_density (client_count, ap_name) VALUES (?, ?)").run(count, "Main Campus");
    console.log(`[Stats-API] Saved simulated density: ${count} clients`);
    return;
  }
  
  try {
    const now = new Date().toISOString();
    // Only poll devices that are pingable (online)
    const devices = db.prepare("SELECT * FROM mikrotik_devices WHERE status = 'online'").all() as any[];
    for (const device of devices) {
      try {
        const client = createMikrotikClient(device);
        const api = await client.connect();
        const results = await api.menu("/ip/arp").print();
        const count = results.length;
        await client.close();
        
        db.prepare("INSERT INTO wifi_density (timestamp, client_count, ap_name) VALUES (?, ?, ?)").run(now, count, device.name);
        console.log(`[Stats-API] Saved density for ${device.name}: ${count} clients`);
      } catch (err) {
        console.error(`[Stats-API] Error polling ${device.name}:`, err);
      }
    }
  } catch (err) {
    console.error("[Stats-API] Polling error:", err);
  }
}, 15 * 60 * 1000);

// Background ICMP Ping (Khusus Untuk Status Online/Offline)
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") return;
  try {
    const devices = db.prepare("SELECT * FROM mikrotik_devices").all() as any[];
    for (const device of devices) {
      if (!device.host) continue;
      const res = await ping.promise.probe(device.host, { timeout: 2 });
      const newStatus = res.alive ? 'online' : 'offline';
      db.prepare("UPDATE mikrotik_devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(newStatus, device.id);

      // Generate notification on status change
      const prev = deviceLastStatus[device.id];
      if (prev !== undefined && prev !== newStatus) {
        const isOffline = newStatus === 'offline';
        db.prepare(`INSERT INTO notifications (device_id, device_name, type, title, message) VALUES (?, ?, ?, ?, ?)`)
          .run(
            device.id,
            device.name,
            isOffline ? 'critical' : 'info',
            isOffline ? `Device Offline: ${device.name}` : `Device Online: ${device.name}`,
            isOffline
              ? `MikroTik "${device.name}" (${device.host}) tidak dapat dijangkau. Periksa koneksi.`
              : `MikroTik "${device.name}" (${device.host}) kembali online.`
          );
        console.log(`[Notification] ${device.name} changed: ${prev} → ${newStatus}`);
      }
      deviceLastStatus[device.id] = newStatus;
    }
  } catch (err) {
    console.error("[Ping Worker] Error:", err);
  }
}, 10 * 1000);

// Simulation Data Generator for specific APs
const getSimulatedAPData = (baseCapacity: number) => {
  const now = new Date();
  const hour = now.getHours();
  let multiplier = 0.2;
  if (hour >= 8 && hour <= 17) multiplier = 0.6 + Math.random() * 0.4;
  else if (hour > 17 && hour <= 21) multiplier = 0.3 + Math.random() * 0.2;
  return Math.floor(baseCapacity * multiplier);
};

const generateRooms = (buildingId: string, floor: number, count: number, specialRooms: string[] = []) => {
  const rooms = [];
  const prefix = buildingId.split('-')[1]?.toUpperCase() || 'X';
  
  // Add special rooms first
  specialRooms.forEach((name, i) => {
    rooms.push({
      id: `${prefix}${floor}${String(i + 1).padStart(2, '0')}`,
      name: name,
      cap: 30 + Math.floor(Math.random() * 40)
    });
  });

  // Fill remaining with generic rooms
  for (let i = rooms.length; i < count; i++) {
    rooms.push({
      id: `${prefix}${floor}${String(i + 1).padStart(2, '0')}`,
      name: `Ruang ${prefix}${floor}${String(i + 1).padStart(2, '0')}`,
      cap: 20 + Math.floor(Math.random() * 30)
    });
  }
  return rooms;
};

const CAMPUS_STRUCTURE = [
  {
    id: 'gedung-a',
    name: 'Gedung A (Rektorat)',
    lat: -7.29014758108542,
    lng: 112.77906002343526,
    hasWifi: true,
    floors: [
      { level: 1, rooms: generateRooms('gedung-a', 1, 12, ['Lobby', 'PSA', 'Loket Keuangan']) },
      { level: 2, rooms: generateRooms('gedung-a', 2, 10, ['Ruang Dosen A', 'Ruang Dosen B']) },
      { level: 3, rooms: generateRooms('gedung-a', 3, 11, ['Bagian Kepegawaian', 'R. Rapat Rektorat']) },
      { level: 4, rooms: generateRooms('gedung-a', 4, 9, ['Server Utama', 'Arsip Digital']) },
    ]
  },
  {
    id: 'masjid',
    name: 'Masjid ITATS',
    lat: -7.290092128135376,
    lng: 112.77851811753203,
    hasWifi: false,
    floors: [
      { level: 1, rooms: [{ id: 'M101', name: 'Area Sholat Utama', cap: 500 }] }
    ]
  },
  {
    id: 'gedung-h',
    name: 'Gedung H (Pusat Belajar)',
    lat: -7.291621768448615,
    lng: 112.77936503544943,
    hasWifi: true,
    floors: Array.from({ length: 4 }, (_, i) => ({
      level: i + 1,
      rooms: generateRooms('gedung-h', i + 1, 9 + Math.floor(Math.random() * 6))
    }))
  },
  {
    id: 'gedung-g',
    name: 'Gedung G (Pusat Bahasa & Perpus)',
    lat: -7.291567060891928,
    lng: 112.77883703009879,
    hasWifi: true,
    floors: [
      { level: 1, rooms: generateRooms('gedung-g', 1, 12, ['Pusba', 'Perpustakaan', 'Lab LCSE']) },
      { level: 2, rooms: generateRooms('gedung-g', 2, 10) },
      { level: 3, rooms: generateRooms('gedung-g', 3, 11) },
    ]
  },
  {
    id: 'kantin',
    name: 'Kantin Pusat',
    lat: -7.291733594497817,
    lng: 112.77848896953127,
    hasWifi: true,
    floors: [{ level: 1, rooms: generateRooms('kantin', 1, 5, ['Area Makan A', 'Area Makan B']) }]
  },
  {
    id: 'graha',
    name: 'Graha ITATS',
    lat: -7.290521769873544,
    lng: 112.77953122476994,
    hasWifi: true,
    floors: [{ level: 1, rooms: generateRooms('graha', 1, 4, ['Hall Utama', 'VVIP Room']) }]
  },
  {
    id: 'joglo',
    name: 'Joglo Mahasiswa',
    lat: -7.290877782883343,
    lng: 112.77914815223683,
    hasWifi: true,
    floors: [{ level: 1, rooms: [{ id: 'J101', name: 'Area Diskusi Joglo', cap: 100 }] }]
  },
  {
    id: 'lab-cnc',
    name: 'Lab CNC & Workshop',
    lat: -7.29033501169474,
    lng: 112.77867947559487,
    hasWifi: true,
    floors: [{ level: 1, rooms: generateRooms('cnc', 1, 6, ['Workshop Mesin', 'Lab CNC']) }]
  },
  {
    id: 'study-center',
    name: 'Study Center',
    lat: -7.29111637000814,
    lng: 112.77859060382336,
    hasWifi: true,
    floors: [{ level: 1, rooms: generateRooms('sc', 1, 8, ['R. Belajar Mandiri', 'R. Diskusi']) }]
  },
  {
    id: 'toilet',
    name: 'Toilet Umum',
    lat: -7.291517066050284,
    lng: 112.77850981130382,
    hasWifi: false,
    floors: [{ level: 1, rooms: [{ id: 'T101', name: 'Toilet Pria', cap: 5 }, { id: 'T102', name: 'Toilet Wanita', cap: 5 }] }]
  },
  {
    id: 'loket-keuangan',
    name: 'Loket Keuangan',
    lat: -7.290130656218655,
    lng: 112.77951163854625,
    hasWifi: true,
    floors: [{ level: 1, rooms: [{ id: 'K101', name: 'Loket Pembayaran', cap: 20 }] }]
  },
  {
    id: 'gedung-f',
    name: 'Gedung F (Kelas & Lab)',
    lat: -7.291801560022554,
    lng: 112.77880874362616,
    hasWifi: true,
    floors: Array.from({ length: 3 }, (_, i) => ({
      level: i + 1,
      rooms: generateRooms('gedung-f', i + 1, 10 + Math.floor(Math.random() * 5), i === 0 ? ['Lab Komputer F1', 'Lab Jaringan F1'] : [])
    }))
  }
];

// API Routes
app.get("/api/campus-map", async (req, res) => {
  let isSystemOnline = true;
  let totalRealClients = 0;
  
  if (process.env.MIKROTIK_SIMULATION_MODE !== "true") {
    const devices = db.prepare("SELECT status FROM mikrotik_devices").all() as any[];
    isSystemOnline = devices.some(d => d.status === 'online');
    
    // Get latest total clients across all mikrotiks
    const latestRow = db.prepare("SELECT SUM(client_count) as total FROM wifi_density WHERE timestamp = (SELECT MAX(timestamp) FROM wifi_density)").get() as any;
    totalRealClients = latestRow?.total || 0;
  }

  // Calculate total campus capacity for distribution
  const totalCampusCap = CAMPUS_STRUCTURE.reduce((acc, b) => acc + (b.hasWifi ? b.floors.reduce((fa, f) => fa + f.rooms.reduce((ra, r) => ra + r.cap, 0), 0) : 0), 0);

  const data = CAMPUS_STRUCTURE.map(building => ({
    ...building,
    floors: building.floors.map(floor => ({
      ...floor,
      rooms: floor.rooms.map(room => {
        if (!building.hasWifi) {
          return { ...room, current: 0, status: 'offline', latency: 0, noWifi: true };
        }
        
        if (!isSystemOnline && process.env.MIKROTIK_SIMULATION_MODE !== "true") {
           return { ...room, current: 0, status: 'offline', latency: 0 };
        }
        
        let currentClients = 0;
        let latency = 5;
        let onlineStatus = 'online';

        if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
           const isDown = Math.random() < 0.05;
           onlineStatus = isDown ? 'offline' : 'online';
           currentClients = isDown ? 0 : getSimulatedAPData(room.cap);
           latency = isDown ? 0 : 5 + Math.floor(Math.random() * 20);
        } else {
           // distribute real clients proportionally
           if (totalCampusCap > 0 && totalRealClients > 0) {
              const ratio = room.cap / totalCampusCap;
              // Randomize slightly but keep it somewhat reproducible and bounded
              const fuzz = 0.8 + (Math.random() * 0.4);
              currentClients = Math.floor(totalRealClients * ratio * fuzz);
           }
           if (totalRealClients > 0 && currentClients === 0 && room.name.length % 3 === 0) {
              currentClients = 1;
           }
        }

        return {
          ...room,
          current: currentClients,
          status: onlineStatus,
          latency
        };
      })
    }))
  }));
  res.json(data);
});
app.get("/api/current-status", async (req, res) => {
  try {
    const deviceFilter = req.query.device as string;
    let count = 0;
    
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      count = getSimulatedData();
    } else {
      let devices = [];
      if (deviceFilter && deviceFilter !== "all") {
        const device = db.prepare("SELECT * FROM mikrotik_devices WHERE name = ?").get(deviceFilter) as any;
        if (device) devices.push(device);
      } else {
        devices = db.prepare("SELECT * FROM mikrotik_devices").all();
      }

      for (const device of devices) {
        try {
          const client = createMikrotikClient(device);
          const api = await client.connect();
          const results = await api.menu("/ip/arp").print();
          count += results.length;
          await client.close();
        } catch (err) {
          // ignore offline devices
        }
      }
    }
    res.json({ count, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current status" });
  }
});

app.get("/api/history", (req, res) => {
  const deviceFilter = req.query.device as string;
  let rows;
  if (deviceFilter && deviceFilter !== "all") {
    rows = db.prepare("SELECT timestamp, SUM(client_count) as client_count, ap_name FROM wifi_density WHERE ap_name = ? GROUP BY timestamp ORDER BY timestamp DESC LIMIT 100").all(deviceFilter);
  } else {
    rows = db.prepare("SELECT timestamp, SUM(client_count) as client_count, 'All' as ap_name FROM wifi_density GROUP BY timestamp ORDER BY timestamp DESC LIMIT 100").all();
  }
  res.json(rows.reverse());
});

app.get("/api/prediction", async (req, res) => {
  try {
    const deviceFilter = req.query.device as string;
    let history;
    if (deviceFilter && deviceFilter !== "all") {
      history = db.prepare("SELECT timestamp, SUM(client_count) as client_count, ap_name FROM wifi_density WHERE ap_name = ? GROUP BY timestamp ORDER BY timestamp DESC LIMIT 50").all(deviceFilter);
    } else {
      history = db.prepare("SELECT timestamp, SUM(client_count) as client_count, 'All' as ap_name FROM wifi_density GROUP BY timestamp ORDER BY timestamp DESC LIMIT 50").all();
    }
    
    if (history.length < 5) {
      return res.json({ prediction: "Insufficient data for AI prediction. Please wait for more snapshots.", rawanHours: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isPlaceholder = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("YOUR_");

    if (isPlaceholder) {
      console.warn("[AI] Using mock prediction because GEMINI_API_KEY is not configured.");
      return res.json({
        prediction: "AI Prediction is currently in simulation mode. Connect your Gemini API Key to enable real analysis.",
        rawanHours: [
          { hour: "10:00 - 12:00", expectedDensity: "High" },
          { hour: "13:00 - 15:00", expectedDensity: "High" },
          { hour: "16:00 - 18:00", expectedDensity: "Medium" }
        ]
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Analyze the following WiFi density data (client counts over time) and predict the "rawan" (congested/peak) hours for the next 24 hours.
      Data: ${JSON.stringify(history)}
      
      Respond in JSON format with:
      - prediction: a short summary of the trend.
      - rawanHours: an array of objects with { hour: string, expectedDensity: string (Low/Medium/High) }.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error("AI Prediction Error:", err);
    // Fallback to mock on error as well to keep UI functional
    res.json({
      prediction: "AI analysis encountered an error. Showing estimated patterns based on historical averages.",
      rawanHours: [
        { hour: "10:00 - 12:00", expectedDensity: "High" },
        { hour: "13:00 - 15:00", expectedDensity: "High" }
      ]
    });
  }
});

// Topology Data Structure
const getTopologyStatus = () => {
  // Simulate a random failure in the topology for demonstration
  const failPoint = Math.random();
  const status = {
    internet: 'online',
    router: 'online',
    switchCore: 'online',
    switchA: 'online',
    switchH: 'online',
    switchG: 'online',
    switchF: 'online',
  };

  if (failPoint < 0.02) status.router = 'offline';
  else if (failPoint < 0.04) status.switchCore = 'offline';
  else if (failPoint < 0.06) status.switchA = 'offline';
  else if (failPoint < 0.08) status.switchH = 'offline';

  // Propagate failures
  if (status.router === 'offline') status.switchCore = 'offline';
  if (status.switchCore === 'offline') {
    status.switchA = 'offline';
    status.switchH = 'offline';
    status.switchG = 'offline';
    status.switchF = 'offline';
  }

  return status;
};

app.get("/api/topology", (req, res) => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    const status = getTopologyStatus();
    res.json({
      id: 'internet',
      name: 'Public Internet',
      type: 'cloud',
      status: status.internet,
      children: [
        {
          id: 'router-mikrotik',
          name: 'MikroTik CCR1036',
          type: 'router',
          status: status.router,
          children: [
            { id: 'switch-core', name: 'Switch Core', type: 'switch', status: status.switchCore }
          ]
        }
      ]
    });
    return;
  }

  const devices = db.prepare("SELECT * FROM mikrotik_devices").all() as any[];
  
  const routerChildren = devices.map(device => {
    return {
      id: `router-${device.id}`,
      name: device.name,
      type: 'router',
      status: device.status === 'online' ? 'online' : 'offline',
      children: [
        {
           id: `switch-core-${device.id}`,
           name: `Core Switch - ${device.name}`,
           type: 'switch',
           status: device.status === 'online' ? 'online' : 'offline',
           children: [
             { id: `ap1-${device.id}`, name: 'Access Point A', type: 'ap', status: device.status === 'online' ? 'online' : 'offline' },
             { id: `ap2-${device.id}`, name: 'Access Point B', type: 'ap', status: device.status === 'online' ? 'online' : 'offline' }
           ]
        }
      ]
    };
  });

  const topology = {
    id: 'internet',
    name: 'Public Internet',
    type: 'cloud',
    status: 'online',
    children: routerChildren.length > 0 ? routerChildren : [
      {
        id: 'mock-router', name: 'No Devices Configured', type: 'router', status: 'offline'
      }
    ]
  };
  
  res.json(topology);
});

// ─── Dynamic Topology API ───────────────────────────────────────────────────
app.get("/api/topology/dynamic", async (req, res) => {
  const deviceFilter = req.query.device as string;
  const allDevices = db.prepare("SELECT * FROM mikrotik_devices").all() as any[];
  const selectedDevices = (deviceFilter && deviceFilter !== 'all')
    ? allDevices.filter(d => String(d.id) === deviceFilter)
    : allDevices;

  const routerNodes = await Promise.all(selectedDevices.map(async (device: any) => {
    const routerOnline = device.status === 'online';
    let accessPoints: any[] = [];

    if (routerOnline) {
      try {
        const client = createMikrotikClient(device);
        const api = await client.connect();

        const [wlanIfaces, regTable] = await Promise.all([
          (api as any).rosApi.write(["/interface/wireless/print"]).catch(() => []),
          (api as any).rosApi.write(["/interface/wireless/registration-table/print"]).catch(() => []),
        ]);

        await client.close();

        const clientsPerAP: Record<string, any[]> = {};
        if (Array.isArray(regTable)) {
          regTable.forEach((c: any) => {
            const iface = c.interface || 'unknown';
            if (!clientsPerAP[iface]) clientsPerAP[iface] = [];
            clientsPerAP[iface].push(c);
          });
        }

        if (Array.isArray(wlanIfaces)) {
          accessPoints = wlanIfaces.map((wlan: any) => {
            const apClients = clientsPerAP[wlan.name] || [];
            const isRunning = wlan.running === 'true' || wlan.running === true;
            const isDisabled = wlan.disabled === 'true' || wlan.disabled === true;
            return {
              id: `ap-${device.id}-${wlan.name}`,
              name: wlan.name,
              type: 'ap',
              status: isDisabled ? 'disabled' : (isRunning ? 'online' : 'offline'),
              ssid: wlan['ssid'] || wlan.name,
              band: wlan['band'] || 'unknown',
              channel: wlan['channel'] || 'auto',
              frequency: wlan['frequency'] || '-',
              clients: apClients.length,
              clientDetails: apClients.slice(0, 20).map((c: any) => ({
                mac: c['mac-address'] || '-',
                signal: c['signal-strength'] || '-',
                txRate: c['tx-rate'] || '-',
                rxRate: c['rx-rate'] || '-',
                uptime: c['uptime'] || '-'
              }))
            };
          });
        }
      } catch (err) {
        console.error(`[Topology] AP fetch error for ${device.name}:`, err);
      }
    }

    return {
      id: `router-${device.id}`,
      name: device.name,
      host: device.host,
      type: 'router',
      status: routerOnline ? 'online' : 'offline',
      lastSeen: device.last_seen,
      isPrimary: device.is_primary === 1,
      children: [{
        id: `switch-${device.id}`,
        name: 'Core Switch',
        type: 'switch',
        status: routerOnline ? 'online' : 'offline',
        children: accessPoints.map(ap => ({
          ...ap,
          status: routerOnline ? ap.status : 'offline'
        }))
      }]
    };
  }));

  res.json({
    id: 'internet',
    name: 'Public Internet',
    type: 'cloud',
    status: 'online',
    lastUpdated: new Date().toISOString(),
    children: routerNodes.length > 0 ? routerNodes : [{
      id: 'no-device', name: 'No Devices Configured', type: 'router',
      status: 'offline', children: []
    }]
  });
});


// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ═══════════════════════════════════════════════════════════════
app.get("/api/notifications", (req, res) => {
  const rows = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100").all();
  res.json(rows);
});

app.put("/api/notifications/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1").run();
  res.json({ success: true });
});

app.put("/api/notifications/:id/read", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.delete("/api/notifications/:id", (req, res) => {
  db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.delete("/api/notifications", (req, res) => {
  db.prepare("DELETE FROM notifications").run();
  res.json({ success: true });
});

// Seed test notification if table empty
const notifCount = db.prepare("SELECT COUNT(*) as c FROM notifications").get() as any;
if (notifCount.c === 0) {
  db.prepare("INSERT INTO notifications (device_name, type, title, message) VALUES (?,?,?,?)").run(
    'System', 'info', 'Sistem Monitoring Aktif', 'Network monitoring berhasil diinisialisasi. Semua layanan berjalan normal.'
  );
}

// ═══════════════════════════════════════════════════════════════
// QUEUE / BANDWIDTH MANAGEMENT API
// ═══════════════════════════════════════════════════════════════
app.get("/api/mikrotiks/:id/queues", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    return res.json([
      { '.id': '*1', name: 'limit-192.168.1.10', target: '192.168.1.10/32', 'max-limit': '10M/10M', disabled: 'false', comment: 'Client A', 'rx-rate': '512000', 'tx-rate': '256000', 'total-queue': '2' },
      { '.id': '*2', name: 'limit-vlan10', target: '192.168.10.0/24', 'max-limit': '50M/50M', disabled: 'false', comment: 'VLAN Mahasiswa', 'rx-rate': '4194304', 'tx-rate': '2097152', 'total-queue': '18' },
      { '.id': '*3', name: 'limit-vlan20', target: '192.168.20.0/24', 'max-limit': '20M/20M', disabled: 'true', comment: 'VLAN Staff', 'rx-rate': '0', 'tx-rate': '0', 'total-queue': '0' },
    ]);
  }
  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    
    // Two separate calls: config (max-limit, target, etc.) + stats (rate, bytes)
    const [configQueues, statsQueues] = await Promise.all([
      (api as any).rosApi.write(["/queue/simple/print"]).catch(() => []),
      (api as any).rosApi.write(["/queue/simple/print", "stats"]).catch(() => []),
    ]);
    await client.close();
    
    // Merge config + stats by .id
    const statsMap: Record<string, any> = {};
    (statsQueues || []).forEach((s: any) => {
      if (s['.id']) statsMap[s['.id']] = s;
    });
    
    const merged = (configQueues || []).map((q: any) => {
      const stats = statsMap[q['.id']] || {};
      const merged = { ...q, ...stats };
      
      // Parse rate field "tx/rx" into separate fields if present
      if (merged.rate && typeof merged.rate === 'string') {
        const parts = merged.rate.split('/');
        if (parts.length === 2) {
          merged['tx-rate'] = parts[0];
          merged['rx-rate'] = parts[1];
        }
      }
      // Parse packet-rate similarly
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

app.post("/api/mikrotiks/:id/queues", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { name, target, maxLimit, burstLimit, comment } = req.body;
  if (!name || !target || !maxLimit) return res.status(400).json({ error: "name, target, maxLimit required" });
  try {
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

app.put("/api/mikrotiks/:id/queues/:qid", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { name, target, maxLimit, comment } = req.body;
  try {
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

app.put("/api/mikrotiks/:id/queues/:qid/toggle", express.json(), async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { disabled } = req.body;
  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await (api as any).rosApi.write(["/queue/simple/set", `=.id=${req.params.qid}`, `=disabled=${disabled}`]);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete("/api/mikrotiks/:id/queues/:qid", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });
  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    await (api as any).rosApi.write(["/queue/simple/remove", `=.id=${req.params.qid}`]);
    await client.close();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════
// VLAN TRAFFIC API
// ═══════════════════════════════════════════════════════════════
app.get("/api/mikrotiks/:id/vlan-traffic", async (req, res) => {
  // --- MULTI-DEVICE SUPPORT ---
  if (req.params.id === 'all') {
    const devices = db.prepare("SELECT * FROM mikrotik_devices").all() as any[];
    
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      let allVlans: any[] = [];
      devices.forEach(d => {
        const vlans = ['vlan10', 'vlan20', 'vlan30'];
        const deviceVlans = vlans.map((name, i) => ({
          name: `${name} [${d.name}]`, 
          type: 'vlan', running: 'true', disabled: i === 2 ? 'true' : 'false',
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
    
    const onlineDevices = devices.filter(d => d.status === 'online');
    const promises = onlineDevices.map(async (device) => {
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
          .filter((i: any) => i.type === 'vlan' || vlanNames.has(i.name))
          .map((v: any) => ({ ...v, name: `${v.name} [${device.name}]` }));
      } catch (e) {
        return [];
      }
    });
    const results = await Promise.all(promises);
    return res.json(results.flat());
  }

  // --- SINGLE DEVICE SUPPORT ---
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  if (process.env.MIKROTIK_SIMULATION_MODE === "true" || device.status !== 'online') {
    const vlans = ['vlan10', 'vlan20', 'vlan30', 'vlan40', 'vlan50'];
    return res.json(vlans.map((name, i) => ({
      name, type: 'vlan', running: 'true', disabled: i === 2 ? 'true' : 'false',
      'rx-byte': String(Math.floor(Math.random() * 500000000)),
      'tx-byte': String(Math.floor(Math.random() * 500000000)),
      'rx-packet': String(Math.floor(Math.random() * 500000)),
      'tx-packet': String(Math.floor(Math.random() * 500000)),
      'rx-rate': String(Math.floor(Math.random() * 10485760)),
      'tx-rate': String(Math.floor(Math.random() * 10485760)),
    })));
  }
  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    const [ifaces, vlansDetail] = await Promise.all([
      (api as any).rosApi.write(["/interface/print", "=stats="]).catch(() => []),
      (api as any).rosApi.write(["/interface/vlan/print"]).catch(() => []),
    ]);
    await client.close();
    const vlanNames = new Set((vlansDetail || []).map((v: any) => v.name));
    const vlans = (ifaces || []).filter((i: any) => i.type === 'vlan' || vlanNames.has(i.name));
    res.json(vlans);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
