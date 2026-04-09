import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import ping from 'ping';
import { db, initializeDB } from './db';

import { authRouter } from './routes/auth.route';
import { publicRouter } from './routes/public.route';
import { mikrotiksRouter, createMikrotikClient } from './routes/mikrotiks.route';
import { dashboardRouter, getSimulatedData } from './routes/dashboard.route';
import { notificationsRouter } from './routes/notifications.route';
import { vlanRouter } from './routes/vlan.route';
import { requireAuth } from './middleware/auth';

dotenv.config();

// ── Global Safety Net ────────────────────────────────────────────────────────
// node-routeros melempar RosException ('UNKNOWNREPLY' atau 'SOCKTMOUT') pada level EventEmitter.
// Ini mencegah server mati total jika mikrotik tidak merespons (bystands try-catch).
process.on('uncaughtException', (err: any) => {
  const msg = err?.message || '';
  const errno = err?.errno || '';
  if (
    errno === 'UNKNOWNREPLY' || msg.includes('UNKNOWNREPLY') || msg.includes('unknown reply') ||
    errno === 'SOCKTMOUT' || msg.includes('SOCKTMOUT') || msg.includes('Timed out')
  ) {
    console.warn(`[MikroTik] Ignoring routeros exception (${errno || 'timeout'}):`, msg);
    return;
  }
  console.error('[FATAL] Uncaught Exception:', err);
  // Biarkan process exit untuk error fatal lainnya
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason);
  if (
    msg.includes('UNKNOWNREPLY') || reason?.errno === 'UNKNOWNREPLY' ||
    msg.includes('SOCKTMOUT') || reason?.errno === 'SOCKTMOUT' || msg.includes('Timed out')
  ) {
    console.warn(`[MikroTik] Ignoring routeros rejection:`, msg);
    return;
  }
  console.error('[WARNING] Unhandled Rejection:', reason);
});

const app = express();
const PORT = 3000;

// Device status tracking for notification generation
const deviceLastStatus: Record<number, string> = {};

// ── API Routes ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);

// Protected routes
app.use('/api/mikrotiks', requireAuth, mikrotiksRouter);
app.use('/api/mikrotiks', requireAuth, vlanRouter);

app.use('/api', requireAuth, dashboardRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);

// ── Background Jobs ─────────────────────────────────────────────────────────

// Background Polling (Every 15 minutes) for Wifi Density
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    const count = getSimulatedData();
    await db.query("INSERT INTO wifi_density (client_count, ap_name) VALUES (?, ?)", [count, "Main Campus"]);
    console.log(`[Stats-API] Saved simulated density: ${count} clients`);
    return;
  }
  
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // MySQL timestamp format
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices WHERE status = 'online'");
    for (const device of devices) {
      try {
        const client = createMikrotikClient(device);
        const api = await client.connect();
        const results = await api.menu("/ip/arp").print();
        const count = results.length;
        await client.close();
        
        await db.query("INSERT INTO wifi_density (timestamp, client_count, ap_name) VALUES (?, ?, ?)", [now, count, device.name]);
        console.log(`[Stats-API] Saved density for ${device.name}: ${count} clients`);
      } catch (err) {
        console.error(`[Stats-API] Error polling ${device.name}:`, err);
      }
    }
  } catch (err) {
    console.error("[Stats-API] Polling error:", err);
  }
}, 15 * 60 * 1000);

// Background ICMP Ping (For Online/Offline Status)
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") return;
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    for (const device of devices) {
      if (!device.host) continue;
      const res = await ping.promise.probe(device.host, { timeout: 2 });
      const newStatus = res.alive ? 'online' : 'offline';
      await db.query("UPDATE mikrotik_devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, device.id]);

      const prev = deviceLastStatus[device.id];
      if (prev !== undefined && prev !== newStatus) {
        const isOffline = newStatus === 'offline';
        await db.query(`INSERT INTO notifications (device_id, device_name, type, title, message) VALUES (?, ?, ?, ?, ?)`,
          [
            device.id,
            device.name,
            isOffline ? 'critical' : 'info',
            isOffline ? `Device Offline: ${device.name}` : `Device Online: ${device.name}`,
            isOffline
              ? `MikroTik "${device.name}" (${device.host}) tidak dapat dijangkau. Periksa koneksi.`
              : `MikroTik "${device.name}" (${device.host}) kembali online.`
          ]
        );
        console.log(`[Notification] ${device.name} changed: ${prev} → ${newStatus}`);
      }
      deviceLastStatus[device.id] = newStatus;
    }
  } catch (err) {
    console.error("[Ping Worker] Error:", err);
  }
}, 10 * 1000);


// ── Vite Middleware & Start Server ──────────────────────────────────────────
async function startServer() {
  await initializeDB(); // Initialize MySQL DB before starting routing

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
    console.log(`Server running on http://localhost:${PORT} (Modular - MySQL)`);
  });
}

startServer();
