import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import ping from 'ping';
import { db, initializeDB } from './db';

import { authRouter } from './routes/auth.route';
import { publicRouter } from './routes/public.route';
import { mikrotiksRouter, createMikrotikClient } from './routes/mikrotiks.route';
import { dashboardRouter, getSimulatedData } from './routes/dashboard.route';
import { notificationsRouter } from "./routes/notifications.route.js";
import { accessPointsRouter } from "./routes/access_points.route.js";
import { vlanRouter } from './routes/vlan.route';
import { logsRouter } from './routes/logs.route';
import { settingsRouter } from './routes/settings.route';
import { adapterRouter } from './routes/adapter.route';
import { controllersRouter } from './routes/controllers.route';
import { adminsRouter } from './routes/admins.route';
import { requireAuth } from './middleware/auth';

dotenv.config();

// ── Global Safety Net ────────────────────────────────────────────────────────
// node-routeros melempar RosException ('UNKNOWNREPLY' atau 'SOCKTMOUT') pada level EventEmitter.
// Ini mencegah server mati total jika mikrotik tidak merespons (bystands try-catch).
process.on('uncaughtException', (err: any) => {
  const msg = err?.message || '';
  const errno = err?.errno || '';
  const name = err?.name || '';
  if (
    errno === 'UNKNOWNREPLY' || msg.includes('UNKNOWNREPLY') || msg.includes('unknown reply') ||
    errno === 'SOCKTMOUT' || msg.includes('SOCKTMOUT') || msg.includes('Timed out') ||
    name === 'RosException' || String(err).includes('RosException') ||
    errno === -4077 || errno === 'ECONNRESET' || errno === 'ETIMEDOUT' || errno === 'ENOTFOUND'
  ) {
    console.warn(`[MikroTik] Ignoring routeros exception (${errno || name || 'timeout'}):`, msg);
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

// ── API Routes ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);

// Protected routes
app.use('/api/mikrotiks', requireAuth, mikrotiksRouter);
app.use('/api/mikrotiks', requireAuth, vlanRouter);
app.use('/api', requireAuth, dashboardRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/access-points", requireAuth, accessPointsRouter);
app.use("/api/logs", requireAuth, logsRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/adapters", requireAuth, adapterRouter);
app.use("/api/controllers", requireAuth, controllersRouter);
// Admins CRUD + forgot/reset password (forgot-password tidak butuh auth)
app.use("/api/admins", adminsRouter);


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

// Device status tracking for notification generation
const deviceLastStatus: Record<number, string> = {};
const apLastStatus: Record<number, string> = {};

async function sendTelegramAlert(title: string, message: string, isCritical: boolean) {
  try {
     const [tkResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_bot_token'");
     const [cdResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_chat_id'");
     const token = tkResult[0]?.key_value;
     const chatId = cdResult[0]?.key_value;
     if (!token || !chatId) return;

     const emoji = isCritical ? '🔴 <b>CRITICAL ALERT</b>' : '🟢 <b>RECOVERY</b>';
     const text = `${emoji}\n\n<b>${title}</b>\n${message}`;
     
     // fire and forget fetch
     fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
     }).catch(e => console.error("[Telegram] Error:", e));

  } catch(e) {}
}

// Background ICMP Ping (For Online/Offline Status)
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") return;
  try {
    // 1. MONITOR MIKROTIK DEVICES
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    for (const device of devices) {
      if (!device.host) continue;
      const res = await ping.promise.probe(device.host, { timeout: 2 });
      const newStatus = res.alive ? 'online' : 'offline';
      await db.query("UPDATE mikrotik_devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, device.id]);

      const prev = deviceLastStatus[device.id];
      if (prev !== undefined && prev !== newStatus) {
        const isOffline = newStatus === 'offline';
        const type = isOffline ? 'critical' : 'info';
        const title = isOffline ? `Router Down: ${device.name}` : `Router Up: ${device.name}`;
        const message = isOffline
              ? `MikroTik "${device.name}" (${device.host}) tidak merespons. Status: ${res.output || 'Timeout'}`
              : `MikroTik "${device.name}" (${device.host}) kembali normal.`;

        await db.query(
          `INSERT INTO notifications (device_id, device_name, type, title, message, action_url, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ device.id, device.name, type, title, message, `/admin/devices?detail=${device.id}`, 'mikrotik' ]
        );
        
        sendTelegramAlert(title, message, isOffline);
        await db.query(
          `INSERT INTO device_uptime_logs (node_id, node_name, status, entity_type) VALUES (?, ?, ?, ?)`,
          [`router-${device.id}`, device.name, newStatus, 'mikrotik']
        );
      }
      deviceLastStatus[device.id] = newStatus;
    }

    // 2. MONITOR ACCESS POINTS (SATELLITES)
    const [aps]: any = await db.query("SELECT * FROM mikrotik_aps WHERE ip_address IS NOT NULL");
    for (const ap of aps) {
      const res = await ping.promise.probe(ap.ip_address, { timeout: 2 });
      const newStatus = res.alive ? 'online' : 'offline';

      const prev = apLastStatus[ap.id];
      if (prev !== undefined && prev !== newStatus) {
        const isOffline = newStatus === 'offline';
        const type = isOffline ? 'warning' : 'info';
        const title = isOffline ? `AP Down: ${ap.name}` : `AP Up: ${ap.name}`;
        const message = isOffline
              ? `Access Point "${ap.name}" di ${ap.group_label || 'Lokasi'} (${ap.ip_address}) terdeteksi mati. Status: ${res.output || 'RTO'}`
              : `Access Point "${ap.name}" kembali melayani client.`;

        await db.query(
          `INSERT INTO notifications (device_id, device_name, type, title, message, action_url, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ ap.mikrotik_id, ap.name, type, title, message, '/admin/aps', 'ap' ]
        );

        sendTelegramAlert(title, message, isOffline);

        await db.query(`UPDATE mikrotik_aps SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, ap.id]);

        await db.query(
          `INSERT INTO device_uptime_logs (node_id, node_name, status, entity_type) VALUES (?, ?, ?, ?)`,
          [`ap-${ap.id}`, ap.name, newStatus, 'ap']
        );
      }
      apLastStatus[ap.id] = newStatus;
    }
  } catch (err) {
    console.error("[Monitoring Worker] Error:", err);
  }
}, 10 * 1000);


// Background Log Archiver (Every 60 seconds)
setInterval(async () => {
  if (process.env.MIKROTIK_SIMULATION_MODE === "true") {
    // Generate some fake logs for testing if DB is empty or just to keep it alive
    try {
      const messages = [
        { topics: 'info,account', msg: 'user admin logged in via local' },
        { topics: 'info,account', msg: 'user admin logged in via web' },
        { topics: 'warning,system', msg: 'router rebooted without proper shutdown' },
        { topics: 'critical,error', msg: 'login failure for user root from 192.168.1.100 via ssh' },
        { topics: 'info,wireless', msg: '00:0C:42:3B:EE:01@wlan1: connected' },
        { topics: 'info,wireless', msg: 'AA:BB:CC:DD:EE:FF@wlan1: disconnected, received deauth: sending station leaving (3)' },
        { topics: 'info,system', msg: 'interface ether1 link down' },
        { topics: 'info,system', msg: 'interface ether1 link up' }
      ];
      
      const [devices]: any = await db.query("SELECT id FROM mikrotik_devices LIMIT 5");
      for (const d of devices) {
        const rand = messages[Math.floor(Math.random() * messages.length)];
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        await db.query(
          "INSERT INTO mikrotik_logs (device_id, mikrotik_id, time, topics, message) VALUES (?, ?, ?, ?, ?)",
          [d.id, '*sim', time, rand.topics, rand.msg]
        );
      }
    } catch (e) { console.error("Sim-Log error", e); }
    return;
  }
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices WHERE status = 'online' AND logs_enabled = 1");
    for (const device of devices) {
      try {
        const client = createMikrotikClient(device);
        const api = await client.connect();
        
        // Fetch last 50 logs from router
        const logs = await api.menu('/log').print();
        await client.close();

        for (const log of logs) {
          // Check if this log already exists in our DB to prevent duplication
          const [exists]: any = await db.query(
            "SELECT id FROM mikrotik_logs WHERE device_id = ? AND time = ? AND message = ? LIMIT 1",
            [device.id, log.time, log.message]
          );

          if (exists.length === 0) {
            await db.query(
              "INSERT INTO mikrotik_logs (device_id, mikrotik_id, time, topics, message) VALUES (?, ?, ?, ?, ?)",
              [device.id, log['.id'], log.time, log.topics, log.message]
            );
          }
        }
      } catch (err: any) {
        let errorMsg = "Gagal koneksi ke router";
        if (err.errno === -4078) errorMsg = "Koneksi Ditolak (Cek apakah Port 8728 API sudah aktif di MikroTik)";
        else if (err.errno === 'CANTLOGIN') errorMsg = "Username/Password Salah";
        else if (err.code === 'ETIMEDOUT') errorMsg = "Koneksi Timeout (Router tidak merespons)";
        
        console.error(`\x1b[31m[Log-Archive] ❌ ${device.name}: ${errorMsg}\x1b[0m`);
      }
    }

    // Auto-delete logs based on system settings
    const [[retention]]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = ?", ['log_retention_days']).catch(() => [[{ key_value: '30' }]]);
    const days = parseInt(retention?.key_value || '30');
    const [delResult]: any = await db.query(`DELETE FROM mikrotik_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
    
    if (delResult.affectedRows > 0) {
      console.log(`[Log-Archive] 🗑️ Auto-cleanup: Removed ${delResult.affectedRows} logs older than ${days} days.`);
    }
    
  } catch (err) {
    console.error("[Log-Archive] Worker error:", err);
  }
}, 60 * 1000);


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
