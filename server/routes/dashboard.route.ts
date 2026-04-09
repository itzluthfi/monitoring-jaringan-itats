import { Router } from 'express';
import { db } from '../db';
import { GoogleGenAI } from '@google/genai';
import { createMikrotikClient } from './mikrotiks.route';

export const dashboardRouter = Router();

// Simulation Data Generator
export const getSimulatedData = () => {
  const now = new Date();
  const hour = now.getHours();
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
  
  specialRooms.forEach((name, i) => {
    rooms.push({
      id: `${prefix}${floor}${String(i + 1).padStart(2, '0')}`,
      name: name,
      cap: 30 + Math.floor(Math.random() * 40)
    });
  });

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

dashboardRouter.get("/campus-map", async (req, res) => {
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    const [aps]: any = await db.query("SELECT * FROM mikrotik_aps");

    const data = devices.filter((d: any) => d.lat && d.lng).map((device: any) => {
        const deviceAPs = aps.filter((a: any) => a.mikrotik_id === device.id);
        const floorsMap: Record<string, any[]> = {};
        
        deviceAPs.forEach((ap: any) => {
            const label = ap.group_label || "General Area";
            if (!floorsMap[label]) floorsMap[label] = [];
            floorsMap[label].push({
                id: `ap-${ap.id}`,
                name: ap.name,
                cap: 50,
                current: ap.last_client_count || 0, 
                status: device.status === 'online' ? 'online' : 'offline'
            });
        });

        const floors = Object.keys(floorsMap).map(key => ({
            level: key,
            rooms: floorsMap[key]
        }));
        
        if (floors.length === 0) {
           floors.push({ level: 'Router Core', rooms: [{ id: `virt-${device.id}`, name: 'Eth Interfaces', cap: 0, current: 0, status: device.status }] });
        }

        return {
            id: `dev-${device.id}`,
            name: device.name,
            lat: device.lat,
            lng: device.lng,
            hasWifi: deviceAPs.length > 0,
            floors
        };
    });
    
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

dashboardRouter.get("/current-status", async (req, res) => {
  try {
    const deviceFilter = req.query.device as string;
    let count = 0;
    
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      count = getSimulatedData();
    } else {
      let devices: any[] = [];
      if (deviceFilter && deviceFilter !== "all") {
        const [filtered]: any = await db.query("SELECT * FROM mikrotik_devices WHERE name = ?", [deviceFilter]);
        devices = filtered;
      } else {
        const [all]: any = await db.query("SELECT * FROM mikrotik_devices");
        devices = all;
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

dashboardRouter.get("/history", async (req, res) => {
  const deviceFilter = req.query.device as string;
  try {
    // In simulation mode always return dynamic mock history data
    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      const points: any[] = [];
      const now = Date.now();
      for (let i = 23; i >= 0; i--) {
        const ts = new Date(now - i * 60 * 60 * 1000);
        const hour = ts.getHours();
        let count = 10 + Math.floor(Math.random() * 5);
        if (hour >= 8 && hour <= 16) count = 60 + Math.floor(Math.random() * 40);
        else if (hour >= 17 && hour <= 21) count = 30 + Math.floor(Math.random() * 20);
        points.push({ timestamp: ts.toISOString(), client_count: count });
      }
      return res.json(points);
    }

    let rows: any;
    if (deviceFilter && deviceFilter !== "all") {
      // Filter by device ID
      const [[device]]: any = await db.query("SELECT name FROM mikrotik_devices WHERE id = ?", [deviceFilter]);
      if (device) {
        [rows] = await db.query("SELECT timestamp, SUM(client_count) as client_count, ap_name FROM wifi_density WHERE ap_name = ? GROUP BY timestamp ORDER BY timestamp DESC LIMIT 100", [device.name]);
      } else {
        return res.json([]);
      }
    } else {
      [rows] = await db.query("SELECT timestamp, SUM(client_count) as client_count, 'All' as ap_name FROM wifi_density GROUP BY timestamp ORDER BY timestamp DESC LIMIT 100");
    }
    res.json((rows || []).reverse());
  } catch (e) {
    res.status(500).json({ error: "Error fetch history" });
  }
});

dashboardRouter.get("/prediction", async (req, res) => {
  try {
    const deviceFilter = req.query.device as string;
    let history: any;

    if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
      // Always return mock prediction in simulation mode
      return res.json({
        prediction: "AI prediction in simulation mode. Peak hours detected between 10:00 - 15:00 based on typical campus patterns.",
        rawanHours: [
          { hour: "10:00 - 12:00", expectedDensity: "High" },
          { hour: "13:00 - 15:00", expectedDensity: "High" },
          { hour: "07:00 - 09:00", expectedDensity: "Medium" },
          { hour: "16:00 - 18:00", expectedDensity: "Medium" },
          { hour: "19:00 - 21:00", expectedDensity: "Low" },
        ]
      });
    }

    if (deviceFilter && deviceFilter !== "all") {
      const [[device]]: any = await db.query("SELECT name FROM mikrotik_devices WHERE id = ?", [deviceFilter]);
      if (device) {
        [history] = await db.query("SELECT timestamp, SUM(client_count) as client_count, ap_name FROM wifi_density WHERE ap_name = ? GROUP BY timestamp ORDER BY timestamp DESC LIMIT 50", [device.name]);
      } else {
        history = [];
      }
    } else {
      [history] = await db.query("SELECT timestamp, SUM(client_count) as client_count, 'All' as ap_name FROM wifi_density GROUP BY timestamp ORDER BY timestamp DESC LIMIT 50");
    }

    if ((history || []).length < 5) {
      return res.json({ prediction: "Insufficient data for AI prediction. Please wait for more snapshots.", rawanHours: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isPlaceholder = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("YOUR_");

    const engineStatus = process.env.AHS_ENGINE_STATUS?.toLowerCase();
    if (engineStatus === 'inactive' || engineStatus === 'nonaktif') {
      return res.json({
        prediction: "AI Nonaktif (Sesuai Konfigurasi ENV)",
        rawanHours: []
      });
    }

    if (process.env.AHS_ENGINE_URL) {
      try {
        const timeout = parseInt(process.env.AHS_ENGINE_TIMEOUT || '3000');
        const fetchCtrl = new AbortController();
        const id = setTimeout(() => fetchCtrl.abort(), timeout);
        
        const ahsRes = await fetch(process.env.AHS_ENGINE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AHS_ENGINE_TOKEN}`
          },
          body: JSON.stringify({ data: history }),
          signal: fetchCtrl.signal
        });
        clearTimeout(id);
        
        if (ahsRes.ok) {
          return res.json(await ahsRes.json());
        }
      } catch (e) {
        console.error("AHS Engine AI Fetch Error", e);
      }
    }

    if (isPlaceholder) {
      console.warn("[AI] Using mock prediction because GEMINI_API_KEY is not configured.");
      return res.json({
        prediction: "AI Prediction is currently in simulation mode. Connect your Gemini API Key or AHS Engine to enable real analysis.",
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
    res.json({
      prediction: "AI analysis encountered an error. Showing estimated patterns based on historical averages.",
      rawanHours: [
        { hour: "10:00 - 12:00", expectedDensity: "High" },
        { hour: "13:00 - 15:00", expectedDensity: "High" }
      ]
    });
  }
});

const getTopologyStatus = () => {
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

  if (status.router === 'offline') status.switchCore = 'offline';
  if (status.switchCore === 'offline') {
    status.switchA = 'offline';
    status.switchH = 'offline';
    status.switchG = 'offline';
    status.switchF = 'offline';
  }

  return status;
};

const upsertDiscoveredAP = async (routerId: number, ap: any) => {
  // We need a unique identifier. MAC is best, ID as fallback
  const mac = ap.mac_address || ap.mac || ap.id || ap.name;
  if (!mac) return;

  try {
    // Check if exists
    const [rows]: any = await db.query("SELECT id FROM mikrotik_aps WHERE mac_address = ? OR (mikrotik_id = ? AND name = ?)", [mac, routerId, ap.name]);
    
    const apData = {
      mikrotik_id: routerId,
      name: ap.name,
      mac_address: mac,
      ip_address: ap.ip || ap.host || null,
      interface_name: ap.interface || ap.interface_name || null,
      mode: ap.mode || (ap.isCoreLink ? 'infrastructure' : 'ap'),
      group_label: ap.group_label || null,
      status: ap.status || 'online',
      last_client_count: ap.clients || 0,
      last_seen: new Date()
    };

    if (rows.length > 0) {
      // Update
      await db.query(
        "UPDATE mikrotik_aps SET name = ?, ip_address = ?, interface_name = ?, mode = ?, status = 'online', last_client_count = ?, last_seen = NOW() WHERE id = ?",
        [apData.name, apData.ip_address, apData.interface_name, apData.mode, apData.last_client_count, rows[0].id]
      );
    } else {
      // Insert
      await db.query(
        "INSERT INTO mikrotik_aps (mikrotik_id, name, mac_address, ip_address, interface_name, mode, status, last_client_count, last_seen) VALUES (?, ?, ?, ?, ?, ?, 'online', ?, NOW())",
        [apData.mikrotik_id, apData.name, apData.mac_address, apData.ip_address, apData.interface_name, apData.mode, apData.last_client_count]
      );
    }
    console.log(`[Topology-Sync] Success: synced ${ap.name} (${mac})`);
  } catch (err) {
    console.error(`[Topology-Sync] Error syncing AP ${ap.name}:`, err);
  }
};

dashboardRouter.get("/topology", async (req, res) => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    const status = getTopologyStatus();
    const [simDevices]: any = await db.query("SELECT id, name, host FROM mikrotik_devices").catch(() => [[]]);

    const makeAPs = (routerName: string) => [
      { id: `ap-${routerName}-1`, name: 'AP-GedA-101', type: 'ap', status: Math.random() < 0.9 ? 'online' : 'offline', ssid: 'ITATS-Staff', band: '5GHz', frequency: '5200', channel: '40', clients: Math.floor(Math.random() * 15) + 2, clientDetails: [
          { mac: 'AA:BB:CC:01:02:03', rxRate: '54Mbps', txRate: '48Mbps', uptime: '2h30m' },
          { mac: 'AA:BB:CC:04:05:06', rxRate: '36Mbps', txRate: '24Mbps', uptime: '45m' },
      ]},
      { id: `ap-${routerName}-2`, name: 'AP-GedB-201', type: 'ap', status: Math.random() < 0.9 ? 'online' : 'offline', ssid: 'ITATS-Student', band: '2.4GHz', frequency: '2462', channel: '11', clients: Math.floor(Math.random() * 30) + 5, clientDetails: [
          { mac: 'BB:CC:DD:01:02:03', rxRate: '12Mbps', txRate: '8Mbps', uptime: '1h15m' },
      ]},
      { id: `ap-${routerName}-3`, name: 'AP-Library', type: 'ap', status: 'online', ssid: 'ITATS-Library', band: '5GHz', frequency: '5745', channel: '149', clients: Math.floor(Math.random() * 20) + 1, clientDetails: [] },
      { id: `ap-${routerName}-4`, name: 'AP-Kantin', type: 'ap', status: Math.random() < 0.8 ? 'online' : 'offline', ssid: 'ITATS-Public', band: '2.4GHz', frequency: '2437', channel: '6', clients: Math.floor(Math.random() * 40) + 10, clientDetails: [] },
    ];

    const routerList = simDevices.length > 0 ? simDevices : [{ id: 1, name: 'MikroTik CCR1036', host: '192.168.1.1' }];
    res.json({
      id: 'internet',
      name: 'Public Internet',
      type: 'cloud',
      status: status.internet,
      children: routerList.map((d: any) => ({
        id: `router-${d.id}`,
        name: d.name,
        type: 'router',
        host: d.host,
        status: status.router,
        children: [{
          id: `switch-core-${d.id}`,
          name: 'Core Switch',
          type: 'switch',
          status: status.switchCore,
          children: makeAPs(String(d.id))
        }]
      }))
    });
    return;
  } // end simulation mode

  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    
    const routerChildren = devices.map((device: any) => {
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
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

dashboardRouter.get("/topology/dynamic", async (req, res) => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    // Return rich simulated topology data identically to the base /topology endpoint
    const status = getTopologyStatus();
    const [simDevices]: any = await db.query("SELECT id, name, host FROM mikrotik_devices").catch(() => [[]]);
    const makeAPs = (routerName: string) => [
      { id: `ap-${routerName}-1`, name: 'AP-GedA-101', type: 'ap', status: Math.random() < 0.9 ? 'online' : 'offline', ssid: 'ITATS-Staff', band: '5GHz', frequency: '5200', channel: '40', clients: Math.floor(Math.random() * 15) + 2, clientDetails: [
          { mac: 'AA:BB:CC:01:02:03', rxRate: '54Mbps', txRate: '48Mbps', signal: '-65dBm', uptime: '2h30m' },
          { mac: 'AA:BB:CC:04:05:06', rxRate: '36Mbps', txRate: '24Mbps', signal: '-70dBm', uptime: '45m' },
      ]},
      { id: `ap-${routerName}-2`, name: 'AP-GedB-201', type: 'ap', status: Math.random() < 0.9 ? 'online' : 'offline', ssid: 'ITATS-Student', band: '2.4GHz', frequency: '2462', channel: '11', clients: Math.floor(Math.random() * 30) + 5, clientDetails: [
          { mac: 'BB:CC:DD:01:02:03', rxRate: '12Mbps', txRate: '8Mbps', signal: '-82dBm', uptime: '1h15m' },
      ]},
      { id: `ap-${routerName}-3`, name: 'AP-Library', type: 'ap', status: 'online', ssid: 'ITATS-Library', band: '5GHz', frequency: '5745', channel: '149', clients: Math.floor(Math.random() * 20) + 1, clientDetails: [] },
      { id: `ap-${routerName}-4`, name: 'AP-Kantin', type: 'ap', status: Math.random() < 0.8 ? 'online' : 'offline', ssid: 'ITATS-Public', band: '2.4GHz', frequency: '2437', channel: '6', clients: Math.floor(Math.random() * 40) + 10, clientDetails: [] },
    ];
    const routerList = simDevices.length > 0 ? simDevices : [{ id: 1, name: 'MikroTik CCR1036', host: '192.168.1.1' }];
    
    const results = {
      id: 'internet', name: 'Public Internet', type: 'cloud', status: status.internet, lastUpdated: new Date().toISOString(),
      children: routerList.map((d: any) => {
        const aps = makeAPs(String(d.id));
        // Auto-sync simulated APs to DB so they appear in /admin/aps
        aps.forEach(ap => upsertDiscoveredAP(d.id, ap));
        
        return {
          id: `router-${d.id}`, name: d.name, type: 'router', host: d.host, status: status.router,
          children: [{
            id: `switch-core-${d.id}`, name: 'Core Switch', type: 'switch', status: status.switchCore,
            children: aps
          }]
        };
      })
    };
    return res.json(results);
  }

  const deviceFilter = req.query.device as string;
  try {
    const [allDevices]: any = await db.query("SELECT * FROM mikrotik_devices");
    const selectedDevices = (deviceFilter && deviceFilter !== 'all')
      ? allDevices.filter((d: any) => String(d.id) === deviceFilter)
      : allDevices;

    const routerNodes = await Promise.all(selectedDevices.map(async (device: any) => {
      const routerOnline = device.status === 'online';
      let accessPoints: any[] = [];
      let wifiSource: 'CAPsMAN' | 'WLAN' | 'none' = 'none';

      if (routerOnline) {
        try {
          const client = createMikrotikClient(device);
          const api = await client.connect();

          // ── Safe API call wrapper ──────────────────────────────────────────
          // node-routeros throws RosException('UNKNOWNREPLY') on !empty responses 
          // via EventEmitter - this wrapper ensures it NEVER escapes as uncaught
          const safeWrite = async (cmd: string[]): Promise<any[]> => {
            try {
              const result = await new Promise<any[]>((resolve) => {
                const timeout = setTimeout(() => resolve([]), 8000);
                try {
                  (api as any).rosApi.write(cmd)
                    .then((r: any) => { clearTimeout(timeout); resolve(Array.isArray(r) ? r : []); })
                    .catch(() => { clearTimeout(timeout); resolve([]); });
                } catch { clearTimeout(timeout); resolve([]); }
              });
              return Array.isArray(result) ? result : [];
            } catch { return []; }
          };

          // ─────────────────────────────────────────────────
          // 1. Fetch DHCP Leases for IP/Hostname enrichment
          // ─────────────────────────────────────────────────
          const dhcpLeases: any[] = await safeWrite(["/ip/dhcp-server/lease/print"]);

          const dhcpMap: Record<string, { ip: string; hostname: string, isStatic: boolean }> = {};
          if (Array.isArray(dhcpLeases)) {
            dhcpLeases.forEach((lease: any) => {
              const mac = (lease['mac-address'] || '').toLowerCase();
              if (mac) {
                dhcpMap[mac] = {
                  ip: lease['address'] || '-',
                  hostname: lease['host-name'] || lease['comment'] || '-',
                  isStatic: String(lease['dynamic']) !== 'true'
                };
              }
            });
          }
          console.log(`[Topology] ${device.name}: DHCP leases found: ${Object.keys(dhcpMap).length}`);

          const enrichClient = (c: any) => {
            const mac = (c['mac-address'] || '').toLowerCase();
            const dhcp = dhcpMap[mac] || { ip: '-', hostname: '-', isStatic: false };
            return {
              mac: c['mac-address'] || '-',
              ip: dhcp.ip,
              hostname: dhcp.hostname,
              isStatic: dhcp.isStatic,
              signal: c['signal-strength'] || c['rx-signal'] || c['signal'] || '-',
              txRate: c['tx-rate'] || c['tx-rate-set'] || '-',
              rxRate: c['rx-rate'] || c['rx-rate-set'] || '-',
              uptime: c['uptime'] || '-',
              interface: c['interface'] || c['cap-interface'] || c['radio-name'] || '-',
            };
          };

          // ─────────────────────────────────────────────────
          // 2. Multi-endpoint WiFi discovery (all versions)
          // ─────────────────────────────────────────────────

          // Fetch ALL data sources in parallel (RouterOS v6 + v7)
          const [
            capAccessPoints,   // CAPsMAN v6: physical AP list
            capIfaces,         // CAPsMAN v6: virtual interfaces
            capRegTable,       // CAPsMAN v6: registered clients
            capRadios,         // CAPsMAN v6: radio list
            capManager,        // CAPsMAN v6: manager status
            capRemoteCap,      // CAPsMAN v6: remote CAP list
            wlanIfaces,        // v6: standalone wireless interfaces
            wlanRegTable,      // v6: standalone wireless clients
            wifiIfaces,        // RouterOS v7: wifi interfaces (replaces wireless)
            wifiRegTable,      // RouterOS v7: wifi registration table
          ] = await Promise.all([
            safeWrite(["/caps-man/access-point/print"]),
            safeWrite(["/caps-man/interface/print"]),
            safeWrite(["/caps-man/registration-table/print"]),
            safeWrite(["/caps-man/radio/print"]),
            safeWrite(["/caps-man/manager/print"]),
            safeWrite(["/caps-man/remote-cap/print"]),
            safeWrite(["/interface/wireless/print"]),
            safeWrite(["/interface/wireless/registration-table/print"]),
            safeWrite(["/interface/wifi/print"]),
            safeWrite(["/interface/wifi/registration-table/print"]),
          ]);

          // Log diagnostics
          const capManagerEnabled = Array.isArray(capManager) && capManager.length > 0
            ? (capManager[0]?.enabled === 'true' || capManager[0]?.enabled === true)
            : false;
          const remoteCapsCount = Array.isArray(capRemoteCap) ? capRemoteCap.length : 0;

          console.log(`[Topology] ${device.name}: ` +
            `cap-ap=${Array.isArray(capAccessPoints)?capAccessPoints.length:'err'}, ` +
            `cap-iface=${Array.isArray(capIfaces)?capIfaces.length:'err'}, ` +
            `cap-reg=${Array.isArray(capRegTable)?capRegTable.length:'err'}, ` +
            `cap-radio=${Array.isArray(capRadios)?capRadios.length:'err'}, ` +
            `cap-manager-enabled=${capManagerEnabled}, ` +
            `remote-caps=${remoteCapsCount}, ` +
            `wlan-iface=${Array.isArray(wlanIfaces)?wlanIfaces.length:'err'}, ` +
            `wlan-reg=${Array.isArray(wlanRegTable)?wlanRegTable.length:'err'}, ` +
            `wifi-iface(v7)=${Array.isArray(wifiIfaces)?wifiIfaces.length:'err'}, ` +
            `wifi-reg(v7)=${Array.isArray(wifiRegTable)?wifiRegTable.length:'err'}`
          );

          if (capManagerEnabled && remoteCapsCount === 0) {
            console.warn(`[Topology] ${device.name}: ⚠️  CAPsMAN enabled but no remote-caps found. ` +
              `AP mungkin belum join. Cek: /caps-man/remote-cap/print di WinBox.`);
          }

          // ── Availability flags ──
          const capAPAvailable     = Array.isArray(capAccessPoints) && capAccessPoints.length > 0;
          const capIfaceAvailable  = Array.isArray(capIfaces) && capIfaces.length > 0;
          const capRadioAvailable  = Array.isArray(capRadios) && capRadios.length > 0;
          const wlanAvailable      = Array.isArray(wlanIfaces) && wlanIfaces.length > 0;
          // RouterOS v7 WiFi
          const wifiV7Available    = Array.isArray(wifiIfaces) && wifiIfaces.length > 0;
          const wifiV7RegAvailable = Array.isArray(wifiRegTable) && wifiRegTable.length > 0;

          if (capAPAvailable) {
            // ─── PATH A: CAPsMAN Access Points (physical CAP devices) ───
            wifiSource = 'CAPsMAN';
            console.log(`[Topology] ${device.name}: PATH A - CAPsMAN access-point list (${capAccessPoints.length} APs)`);

            // Build client map from registration table, keyed by radio-name or interface
            const clientsPerCAP: Record<string, any[]> = {};
            if (Array.isArray(capRegTable)) {
              capRegTable.forEach((c: any) => {
                const key = c['radio-name'] || c['interface'] || c['cap-interface'] || 'unknown';
                if (!clientsPerCAP[key]) clientsPerCAP[key] = [];
                clientsPerCAP[key].push(c);
              });
            }

            accessPoints = capAccessPoints.map((ap: any) => {
              // Try to find clients by radio name or identity
              const radioKey = ap['radio-name'] || ap.identity || ap.name;
              const apClients = clientsPerCAP[radioKey] || clientsPerCAP[ap.name] || [];
              const isConnected = ap.state === 'running' || ap.connected === 'true' || ap.connected === true;
              return {
                id: `ap-cap-phys-${device.id}-${ap.name || radioKey}`,
                name: ap.identity || ap.name || radioKey,
                type: 'ap' as const,
                wifiSource: 'CAPsMAN',
                status: isConnected ? 'online' : 'offline',
                ssid: ap['current-ssid'] || ap.ssid || '-',
                band: ap['current-band'] || ap.band || '-',
                channel: ap['current-channel'] || ap.channel || '-',
                frequency: ap['current-frequency'] || ap.frequency || '-',
                clients: apClients.length,
                clientDetails: apClients.slice(0, 30).map(enrichClient),
              };
            });

          } else if (capIfaceAvailable) {
            // ─── PATH B: CAPsMAN virtual interfaces ───
            wifiSource = 'CAPsMAN';
            console.log(`[Topology] ${device.name}: PATH B - CAPsMAN virtual ifaces (${capIfaces.length})`);

            const clientsPerCAP: Record<string, any[]> = {};
            if (Array.isArray(capRegTable)) {
              capRegTable.forEach((c: any) => {
                const iface = c['interface'] || c['cap-interface'] || 'unknown';
                if (!clientsPerCAP[iface]) clientsPerCAP[iface] = [];
                clientsPerCAP[iface].push(c);
              });
            }

            accessPoints = capIfaces.map((cap: any) => {
              const apClients = clientsPerCAP[cap.name] || [];
              const isRunning = cap.running === 'true' || cap.running === true;
              const isDisabled = cap.disabled === 'true' || cap.disabled === true;
              return {
                id: `ap-cap-iface-${device.id}-${cap.name}`,
                name: cap['current-master-interface'] || cap.name,
                type: 'ap' as const,
                wifiSource: 'CAPsMAN',
                status: isDisabled ? 'disabled' : (isRunning ? 'online' : 'offline'),
                ssid: cap['ssid'] || cap['configuration.ssid'] || cap.name,
                band: cap['band'] || cap['configuration.band'] || '-',
                channel: cap['channel'] || cap['current-channel'] || '-',
                frequency: cap['frequency'] || cap['current-frequency'] || '-',
                clients: apClients.length,
                clientDetails: apClients.slice(0, 30).map(enrichClient),
              };
            });

          } else if (capRadioAvailable) {
            // ─── PATH C: CAPsMAN radios (fallback for older firmware) ───
            wifiSource = 'CAPsMAN';
            console.log(`[Topology] ${device.name}: PATH C - CAPsMAN radios (${capRadios.length})`);

            const clientsPerRadio: Record<string, any[]> = {};
            if (Array.isArray(capRegTable)) {
              capRegTable.forEach((c: any) => {
                const key = c['radio-name'] || c['interface'] || 'unknown';
                if (!clientsPerRadio[key]) clientsPerRadio[key] = [];
                clientsPerRadio[key].push(c);
              });
            }

            accessPoints = capRadios.map((radio: any) => {
              const radioName = radio['radio-name'] || radio.name;
              const apClients = clientsPerRadio[radioName] || [];
              return {
                id: `ap-cap-radio-${device.id}-${radioName}`,
                name: radio.identity || radioName,
                type: 'ap' as const,
                wifiSource: 'CAPsMAN',
                status: radio.running === 'true' ? 'online' : 'offline',
                ssid: radio['current-ssid'] || radio.ssid || '-',
                band: radio['current-band'] || radio.band || '-',
                channel: radio['current-channel'] || radio.channel || '-',
                frequency: radio['current-frequency'] || radio.frequency || '-',
                clients: apClients.length,
                clientDetails: apClients.slice(0, 30).map(enrichClient),
              };
            });

          } else if (wlanAvailable) {
            // ─── PATH D: Regular WLAN interfaces ───
            wifiSource = 'WLAN';
            console.log(`[Topology] ${device.name}: PATH D - Regular WLAN (${wlanIfaces.length} ifaces)`);

            const clientsPerAP: Record<string, any[]> = {};
            if (Array.isArray(wlanRegTable)) {
              wlanRegTable.forEach((c: any) => {
                const iface = c.interface || 'unknown';
                if (!clientsPerAP[iface]) clientsPerAP[iface] = [];
                clientsPerAP[iface].push(c);
              });
            }

            accessPoints = wlanIfaces.map((wlan: any) => {
              const apClients = clientsPerAP[wlan.name] || [];
              const isRunning = wlan.running === 'true' || wlan.running === true;
              const isDisabled = wlan.disabled === 'true' || wlan.disabled === true;
              return {
                id: `ap-wlan-${device.id}-${wlan.name}`,
                name: wlan.name,
                type: 'ap' as const,
                wifiSource: 'WLAN',
                status: isDisabled ? 'disabled' : (isRunning ? 'online' : 'offline'),
                ssid: wlan['ssid'] || wlan.name,
                band: wlan['band'] || '-',
                channel: wlan['channel'] || '-',
                frequency: wlan['frequency'] || '-',
                clients: apClients.length,
                clientDetails: apClients.slice(0, 30).map(enrichClient),
              };
            });

          } else if (Array.isArray(capRegTable) && capRegTable.length > 0) {
            // ─── PATH E: CAPsMAN clients exist but no interface list — group by radio ───
            wifiSource = 'CAPsMAN';
            console.log(`[Topology] ${device.name}: PATH E - CAPsMAN clients only, grouping by radio (${capRegTable.length} clients)`);

            const groupedByRadio: Record<string, any[]> = {};
            capRegTable.forEach((c: any) => {
              const key = c['radio-name'] || c['interface'] || c['cap-interface'] || 'Unknown-AP';
              if (!groupedByRadio[key]) groupedByRadio[key] = [];
              groupedByRadio[key].push(c);
            });

            accessPoints = Object.entries(groupedByRadio).map(([radioName, clients]) => ({
              id: `ap-cap-grp-${device.id}-${radioName}`,
              name: radioName,
              type: 'ap' as const,
              wifiSource: 'CAPsMAN',
              status: 'online',
              ssid: clients[0]?.ssid || '-',
              band: clients[0]?.band || '-',
              channel: '-',
              frequency: '-',
              clients: clients.length,
              clientDetails: clients.slice(0, 30).map(enrichClient),
            }));

          } else if (Array.isArray(wlanRegTable) && wlanRegTable.length > 0) {
            // ─── PATH F: WLAN clients exist but no interface list — group by interface ───
            wifiSource = 'WLAN';
            console.log(`[Topology] ${device.name}: PATH F - WLAN clients only, grouping (${wlanRegTable.length} clients)`);

            const groupedByIface: Record<string, any[]> = {};
            wlanRegTable.forEach((c: any) => {
              const key = c['interface'] || 'Unknown-WLAN';
              if (!groupedByIface[key]) groupedByIface[key] = [];
              groupedByIface[key].push(c);
            });

            accessPoints = Object.entries(groupedByIface).map(([ifaceName, clients]) => ({
              id: `ap-wlan-grp-${device.id}-${ifaceName}`,
              name: ifaceName,
              type: 'ap' as const,
              wifiSource: 'WLAN',
              status: 'online',
              ssid: '-',
              band: '-',
              channel: '-',
              frequency: '-',
              clients: clients.length,
              clientDetails: clients.slice(0, 30).map(enrichClient),
            }));

          } else if (wifiV7Available) {
            // ─── PATH I: RouterOS v7 /interface/wifi (new WiFi package) ───
            wifiSource = 'WLAN';
            console.log(`[Topology] ${device.name}: PATH I - RouterOS v7 WiFi interfaces (${wifiIfaces.length} ifaces, ${Array.isArray(wifiRegTable) ? wifiRegTable.length : 0} clients)`);

            const clientsPerWifiV7: Record<string, any[]> = {};
            if (Array.isArray(wifiRegTable)) {
              wifiRegTable.forEach((c: any) => {
                const iface = c.interface || c['ap'] || 'unknown';
                if (!clientsPerWifiV7[iface]) clientsPerWifiV7[iface] = [];
                clientsPerWifiV7[iface].push(c);
              });
            }

            accessPoints = wifiIfaces.map((wlan: any) => {
              const apClients = clientsPerWifiV7[wlan.name] || [];
              const isRunning = wlan.running === 'true' || wlan.running === true;
              const isDisabled = wlan.disabled === 'true' || wlan.disabled === true;
              return {
                id: `ap-wifiv7-${device.id}-${wlan.name}`,
                name: wlan.name,
                type: 'ap' as const,
                wifiSource: 'WLAN',
                status: isDisabled ? 'disabled' : (isRunning ? 'online' : 'offline'),
                ssid: wlan['ssid'] || wlan['configuration.ssid'] || wlan.name,
                band: wlan['band'] || wlan['configuration.band'] || '-',
                channel: wlan['channel'] || wlan['current-channel'] || '-',
                frequency: wlan['frequency'] || wlan['current-frequency'] || '-',
                clients: apClients.length,
                clientDetails: apClients.slice(0, 30).map(enrichClient),
              };
            });

          } else if (wifiV7RegAvailable) {
            // ─── PATH J: RouterOS v7 — clients only (no iface list) ───
            wifiSource = 'WLAN';
            console.log(`[Topology] ${device.name}: PATH J - RouterOS v7 clients only (${wifiRegTable.length} clients), grouping by AP`);

            const groupedV7: Record<string, any[]> = {};
            wifiRegTable.forEach((c: any) => {
              const key = c['ap'] || c['interface'] || c['ap-interface'] || 'Unknown-WiFi';
              if (!groupedV7[key]) groupedV7[key] = [];
              groupedV7[key].push(c);
            });

            accessPoints = Object.entries(groupedV7).map(([apName, clients]) => ({
              id: `ap-wifiv7-grp-${device.id}-${apName}`,
              name: apName,
              type: 'ap' as const,
              wifiSource: 'WLAN',
              status: 'online',
              ssid: clients[0]?.ssid || '-',
              band: clients[0]?.band || '-',
              channel: '-',
              frequency: '-',
              clients: clients.length,
              clientDetails: clients.slice(0, 30).map(enrichClient),
            }));

          } else {
            // ─── PATH G/H: IP Neighbor Discovery + DHCP grouping ───
            wifiSource = 'none';
            console.log(`[Topology] ${device.name}: No WiFi (any version) found. Trying neighbor discovery + DHCP grouping...`);

            const [neighbors, dhcpServers] = await Promise.all([
              safeWrite(["/ip/neighbor/print"]),
              safeWrite(["/ip/dhcp-server/print"]),
            ]);

            console.log(`[Topology] ${device.name}: neighbors=${Array.isArray(neighbors)?neighbors.length:'err'}, dhcp-servers=${Array.isArray(dhcpServers)?dhcpServers.length:'err'}`);

            // PATH G: Neighbor discovery — APs that respond MNDP/LLDP
            const apNeighbors = Array.isArray(neighbors) ? neighbors.filter((n: any) => {
              const board = (n['board'] || n['platform'] || '').toLowerCase();
              const identity = (n['identity'] || n['system-description'] || '').toLowerCase();
              // Filter for devices that look like APs
              return board.includes('ap') || board.includes('cap') || board.includes('unifi') ||
                     identity.includes('ap') || identity.includes('access') || identity.includes('cap') ||
                     identity.includes('wifi') || identity.includes('wireless') || identity.includes('ubnt');
            }) : [];

            if (apNeighbors.length > 0) {
              wifiSource = 'CAPsMAN';
              console.log(`[Topology] ${device.name}: PATH G - Found ${apNeighbors.length} AP-like neighbors`);

              accessPoints = apNeighbors.map((n: any) => ({
                id: `ap-neighbor-${device.id}-${n['mac-address'] || n.identity}`,
                name: n.identity || n['system-name'] || 'Unknown AP',
                type: 'ap' as const,
                wifiSource: 'CAPsMAN',
                status: 'online',
                ssid: n['ssid'] || '-',
                band: n['band'] || '-',
                channel: '-',
                frequency: '-',
                clients: 0,
                clientDetails: [],
                host: n['address'] || n['ip-address'] || '-',
              }));

            } else {
              // PATH H: DHCP Server grouping (last resort — show network segments as nodes)
              // Group DHCP leases by server name (each server = interface/VLAN = network segment)
              const groupedByServer: Record<string, any[]> = {};
              dhcpLeases.forEach((lease: any) => {
                const server = lease['server'] || lease['active-server'] || 'Unknown';
                if (!groupedByServer[server]) groupedByServer[server] = [];
                groupedByServer[server].push(lease);
              });

              // Also add DHCP server info from the server list for better naming
              const serverInfoMap: Record<string, any> = {};
              if (Array.isArray(dhcpServers)) {
                dhcpServers.forEach((s: any) => {
                  if (s.name) serverInfoMap[s.name] = s;
                });
              }

              if (Object.keys(groupedByServer).length > 0) {
                wifiSource = 'WLAN';
                console.log(`[Topology] ${device.name}: PATH H - DHCP lease grouping by server (${Object.keys(groupedByServer).length} segments, ${dhcpLeases.length} total leases)`);

                accessPoints = Object.entries(groupedByServer).map(([serverName, leaseList]) => {
                  const serverInfo = serverInfoMap[serverName] || {};
                  const clientDetailsFromDHCP = leaseList.slice(0, 50).map((lease: any) => {
                    const isDynamic = String(lease['dynamic']) === 'true';
                    return {
                      mac: lease['mac-address'] || '-',
                      ip: lease['address'] || lease['active-address'] || '-',
                      hostname: lease['host-name'] || lease['comment'] || '-',
                      isStatic: !isDynamic,
                      signal: isDynamic ? '-' : 'STATIC_IP_LEASE',
                      txRate: '-',
                      rxRate: '-',
                      uptime: lease['expires-after'] ? `expires: ${lease['expires-after']}` : '-',
                      interface: lease['active-server'] || serverName,
                      status: lease['status'] || 'bound',
                    };
                  });

                  return {
                    id: `segment-dhcp-${device.id}-${serverName}`,
                    name: serverName,
                    type: 'ap' as const,
                    wifiSource: 'WLAN',
                    status: 'online',
                    ssid: serverInfo['interface'] || serverName,
                    band: `${leaseList.length} leases`,
                    channel: serverInfo['address-pool'] || '-',
                    frequency: '-',
                    clients: leaseList.length,
                    clientDetails: clientDetailsFromDHCP,
                  };
                });
              } else if (Array.isArray(neighbors) && neighbors.length > 0) {
                // ─── PATH K: Core Router Fallback (Neighbors as Nodes) ───
                wifiSource = 'none';
                console.log(`[Topology] ${device.name}: PATH K - No clients but ${neighbors.length} neighbors found. Mapping as Core Router.`);
                
                accessPoints = neighbors.slice(0, 15).map((n: any, idx: number) => ({
                  id: `neighbor-node-${device.id}-${idx}`,
                  name: n.identity || n['system-name'] || n.board || 'Backbone Link',
                  type: 'ap' as const,
                  wifiSource: 'none',
                  status: 'online',
                  ssid: n.board || 'Core Link',
                  band: n.interface || 'Eth',
                  channel: n.address || 'Layer 2',
                  frequency: '-',
                  clients: 0,
                  clientDetails: [],
                  isCoreLink: true
                }));
              } else {
                 // ─── PATH L: Physical Interface Fallback (Last Resort) ───
                 const interfaces: any[] = await safeWrite(["/interface/print", "?status=running"]);
                 if (Array.isArray(interfaces) && interfaces.length > 0) {
                    wifiSource = 'none';
                    console.log(`[Topology] ${device.name}: PATH L - Showing ${interfaces.length} active physical interfaces.`);
                    accessPoints = interfaces.filter(i => i.type === 'ether' || i.type === 'vlan' || i.type === 'bridge').map((i: any) => ({
                      id: `iface-node-${device.id}-${i.name}`,
                      name: i.name,
                      type: 'ap' as const,
                      wifiSource: 'none',
                      status: 'online',
                      ssid: i.comment || '-',
                      band: i.type,
                      channel: i['last-link-up-time'] || '-',
                      frequency: '-',
                      clients: 0,
                      clientDetails: []
                    }));
                 } else {
                    wifiSource = 'none';
                    console.log(`[Topology] ${device.name}: Absolutely no WiFi, neighbor, or interface data found.`);
                 }
              }
            }
          }

          await client.close();

        } catch (err) {
          console.error(`[Topology] AP fetch error for ${device.name}:`, err);
        }
      }
      
      // ─────────────────────────────────────────────────
      // 3. Sync discovered nodes to Database & Load Offlines
      // ─────────────────────────────────────────────────
      
      // Mark all "Live" nodes as processed and sync to DB
      const liveMacs = new Set();
      for (const ap of accessPoints) {
        liveMacs.add(ap.mac_address || ap.mac || ap.id || ap.name);
        await upsertDiscoveredAP(device.id, ap);
      }

      // Fetch all previously known nodes for this router
      const [dbAPs]: any = await db.query("SELECT * FROM mikrotik_aps WHERE mikrotik_id = ?", [device.id]);
      
      // Merge: Add nodes from DB that were NOT found in the live scan (mark as offline)
      dbAPs.forEach((dbAp: any) => {
        if (!liveMacs.has(dbAp.mac_address)) {
          accessPoints.push({
            id: `ap-db-${dbAp.id}`,
            name: dbAp.name,
            type: 'ap',
            status: 'offline', // Mark as offline since not in live scan
            wifiSource: dbAp.mode === 'ap' ? 'WLAN' : 'none',
            ssid: dbAp.mode === 'infrastructure' ? 'Core Link' : '-',
            clients: 0,
            clientDetails: [],
            mac_address: dbAp.mac_address,
            lastSeen: dbAp.last_seen
          });
        }
      });

      return {
        id: `router-${device.id}`,
        name: device.name,
        host: device.host,
        type: 'router',
        status: routerOnline ? 'online' : 'offline',
        lastSeen: device.last_seen,
        isPrimary: device.is_primary === 1,
        wifiSource,
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
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
