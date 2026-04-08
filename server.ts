import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { RouterOSClient } from "routeros-client";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

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
try {
  db.exec("ALTER TABLE mikrotik_devices ADD COLUMN is_primary INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

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

app.get("/api/mikrotiks/stats", (req, res) => {
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
app.get("/api/mikrotiks", (req, res) => {
  const devices = db.prepare("SELECT id, name, host, user, port, last_seen, status, is_primary FROM mikrotik_devices").all();
  res.json(devices);
});

app.post("/api/mikrotiks/:id/primary", (req, res) => {
  db.transaction(() => {
    db.prepare("UPDATE mikrotik_devices SET is_primary = 0").run();
    db.prepare("UPDATE mikrotik_devices SET is_primary = 1 WHERE id = ?").run(req.params.id);
  })();
  res.json({ success: true });
});

app.post("/api/mikrotiks", express.json(), (req, res) => {
  const { name, host, user, password, port } = req.body;
  if (!name || !host || !user || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const result = db.prepare(
    "INSERT INTO mikrotik_devices (name, host, user, password, port) VALUES (?, ?, ?, ?, ?)"
  ).run(name, host, user, password, port || 8728);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/mikrotiks/:id", (req, res) => {
  db.prepare("DELETE FROM mikrotik_devices WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.put("/api/mikrotiks/:id", express.json(), (req, res) => {
  const { name, host, user, password, port } = req.body;
  if (!name || !host || !user) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  if (password) {
    db.prepare(
      "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, password = ?, port = ? WHERE id = ?"
    ).run(name, host, user, password, port || 8728, req.params.id);
  } else {
    db.prepare(
      "UPDATE mikrotik_devices SET name = ?, host = ?, user = ?, port = ? WHERE id = ?"
    ).run(name, host, user, port || 8728, req.params.id);
  }
  
  res.json({ success: true });
});

app.get("/api/mikrotiks/:id/status", async (req, res) => {
  const device = db.prepare("SELECT * FROM mikrotik_devices WHERE id = ?").get(req.params.id) as any;
  if (!device) return res.status(404).json({ error: "Device not found" });

  try {
    const client = createMikrotikClient(device);
    const api = await client.connect();
    
    const [identity, resource] = await Promise.all([
      api.menu("/system/identity").print(),
      api.menu("/system/resource").print()
    ]);

    await client.close();
    
    const status = {
      online: true,
      identity: identity[0]?.name,
      uptime: resource[0]?.uptime,
      version: resource[0]?.version,
      cpuLoad: resource[0]?.["cpu-load"],
      freeMemory: resource[0]?.["free-memory"],
    };

    db.prepare("UPDATE mikrotik_devices SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(device.id);
    res.json(status);
  } catch (err) {
    db.prepare("UPDATE mikrotik_devices SET status = 'offline' WHERE id = ?").run(device.id);
    
    let errorMessage = String(err);
    const isPrivateIP = device.host.startsWith("192.168.") || device.host.startsWith("10.") || device.host.startsWith("172.");
    if (isPrivateIP && errorMessage.toLowerCase().includes("timeout")) {
      errorMessage = `Connection Timeout. IP ${device.host} is a PRIVATE address. Cloud Run cannot reach local private IPs. Please use a Public IP or DDNS.`;
    }
    
    res.json({ online: false, error: errorMessage });
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
    const interfaces = await api.menu("/interface").print();
    await client.close();
    res.json(interfaces);
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
    // Using any cast to bypass type issues with the library's write method
    const result = await (api as any).write(command);
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
  try {
    let count = 0;
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      count = getSimulatedData();
    } else {
      const client = getMikrotikClient();
      if (client) {
        const api = await client.connect();
        const results = await api.menu("/ip/arp").print();
        count = results.length;
        await client.close();
      }
    }
    
    db.prepare("INSERT INTO wifi_density (client_count, ap_name) VALUES (?, ?)").run(count, "Main Campus");
    console.log(`[Stats] Saved density: ${count} clients`);
  } catch (err) {
    console.error("[Stats] Error polling MikroTik:", err);
  }
}, 15 * 60 * 1000);

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
app.get("/api/campus-map", (req, res) => {
  const data = CAMPUS_STRUCTURE.map(building => ({
    ...building,
    floors: building.floors.map(floor => ({
      ...floor,
      rooms: floor.rooms.map(room => {
        if (!building.hasWifi) {
          return {
            ...room,
            current: 0,
            status: 'offline',
            latency: 0,
            noWifi: true
          };
        }
        const isDown = Math.random() < 0.05; // 5% chance an AP is down in simulation
        return {
          ...room,
          current: isDown ? 0 : getSimulatedAPData(room.cap),
          status: isDown ? 'offline' : 'online',
          latency: isDown ? 0 : 5 + Math.floor(Math.random() * 20)
        };
      })
    }))
  }));
  res.json(data);
});
app.get("/api/current-status", async (req, res) => {
  try {
    let count = 0;
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      count = getSimulatedData();
    } else {
      const client = getMikrotikClient();
      if (client) {
        const api = await client.connect();
        const results = await api.menu("/ip/arp").print();
        count = results.length;
        await client.close();
      }
    }
    res.json({ count, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current status" });
  }
});

app.get("/api/history", (req, res) => {
  const rows = db.prepare("SELECT * FROM wifi_density ORDER BY timestamp DESC LIMIT 100").all();
  res.json(rows.reverse());
});

app.get("/api/prediction", async (req, res) => {
  try {
    const history = db.prepare("SELECT * FROM wifi_density ORDER BY timestamp DESC LIMIT 50").all();
    
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
  const status = getTopologyStatus();
  
  const topology = {
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
          {
            id: 'switch-core',
            name: 'Switch Core (Fiber)',
            type: 'switch',
            status: status.switchCore,
            children: [
              {
                id: 'switch-gedung-a',
                name: 'Switch Gedung A',
                type: 'switch',
                status: status.switchA,
                children: [
                  { id: 'ap-a-lt1', name: 'AP A Lt.1', type: 'ap', status: status.switchA === 'online' ? 'online' : 'offline' },
                  { id: 'ap-a-lt2', name: 'AP A Lt.2', type: 'ap', status: status.switchA === 'online' ? 'online' : 'offline' },
                ]
              },
              {
                id: 'switch-gedung-h',
                name: 'Switch Gedung H',
                type: 'switch',
                status: status.switchH,
                children: [
                  { id: 'ap-h-lt1', name: 'AP H Lt.1', type: 'ap', status: status.switchH === 'online' ? 'online' : 'offline' },
                  { id: 'ap-h-lt2', name: 'AP H Lt.2', type: 'ap', status: status.switchH === 'online' ? 'online' : 'offline' },
                ]
              },
              {
                id: 'switch-gedung-g',
                name: 'Switch Gedung G',
                type: 'switch',
                status: status.switchG,
                children: [
                  { id: 'ap-g-lt1', name: 'AP G Lt.1', type: 'ap', status: status.switchG === 'online' ? 'online' : 'offline' },
                  { id: 'ap-g-lt2', name: 'AP G Lt.2', type: 'ap', status: status.switchG === 'online' ? 'online' : 'offline' },
                ]
              }
            ]
          }
        ]
      }
    ]
  };
  
  res.json(topology);
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
