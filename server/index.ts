import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import ping from 'ping';
import os from 'os';
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
import { ticketsRouter } from './routes/tickets.route';
import { requireAuth } from './middleware/auth';
import { publicSecurityMiddleware } from './middleware/publicSecurity';
import { whatsappRouter } from './routes/whatsapp.route';
import { logsAiRouter } from './routes/logs_ai.route';
import { initAllActiveWhatsAppSessions, sendWhatsAppAlertBroadcast } from './lib/whatsapp';

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

// ── Global Middleware ───────────────────────────────────────────────────────
// Izinkan Mobile App (Capacitor) atau Domain beda untuk menarik API backend.
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
// ── Public API (rate limited + security headers) ──────────────────────────────
app.use('/api/public', publicSecurityMiddleware, publicRouter);
app.use('/api/tickets', publicSecurityMiddleware, ticketsRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Protected routes
app.use('/api/mikrotiks', requireAuth, mikrotiksRouter);
app.use('/api/mikrotiks', requireAuth, vlanRouter);
app.use('/api', requireAuth, dashboardRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/access-points", requireAuth, accessPointsRouter);
app.use("/api/logs", requireAuth, logsRouter);
app.use("/api/logs-ai", requireAuth, logsAiRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/adapters", requireAuth, adapterRouter);
app.use("/api/controllers", requireAuth, controllersRouter);
app.use("/api/whatsapp", requireAuth, whatsappRouter);
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
        let count = 0;
        try {
          const api = await client.connect();
          const results = await api.menu("/ip/arp").print();
          count = results.length;
        } finally {
          await client.close().catch(() => {});
        }
        
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



// Tracking status and fail counts
const deviceLastStatus: Record<number, string> = {};
const deviceFailCount: Record<number, number> = {};
const apLastStatus: Record<number, string> = {};
const apFailCount: Record<number, number> = {};

// Tracking offline start time for downtime duration
const deviceOfflineTime: Record<number, number> = {};
const apOfflineTime: Record<number, number> = {};

// Tracking status transition times for flapping detection (timestamp array)
const deviceAlertHistory: Record<number, number[]> = {};
const deviceAlertLocked: Record<number, number> = {}; // timestamp in ms when lock expires

const apAlertHistory: Record<number, number[]> = {};
const apAlertLocked: Record<number, number> = {}; // timestamp in ms when lock expires

const lastSentAlerts: Record<string, { text: string; timestamp: number }> = {};

function shouldBounceAlert(channel: 'telegram' | 'whatsapp', destination: string, text: string): boolean {
  const key = `${channel}_${destination}`;
  const now = Date.now();
  const lastAlert = lastSentAlerts[key];
  
  if (lastAlert && lastAlert.text === text && (now - lastAlert.timestamp) < 60 * 1000) {
    console.log(`[Alert Shield] Bounced duplicate ${channel} alert to ${destination} (sent ${Math.round((now - lastAlert.timestamp)/1000)}s ago).`);
    return true;
  }
  
  lastSentAlerts[key] = { text, timestamp: now };
  return false;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} detik`);

  return parts.join(' ');
}

async function getActiveNotificationChannels(): Promise<string> {
  try {
    const [tgResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_enabled'");
    const [waResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'wa_enabled'");
    const tgActive = tgResult[0]?.key_value === 'true';
    const waActive = waResult[0]?.key_value === 'true';
    
    const active = [];
    if (tgActive) active.push('Telegram');
    if (waActive) active.push('WhatsApp');
    
    if (active.length > 0) {
      return ` [Notifikasi Aktif: ${active.join(', ')}]`;
    }
    return ' [Notifikasi Aktif: Tidak ada]';
  } catch (err) {
    return '';
  }
}

async function sendTelegramAlert(title: string, message: string, isCritical: boolean) {
  try {
    const [enabledResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_enabled'");
    const isEnabled = enabledResult[0]?.key_value === 'true';
    if (!isEnabled) {
      console.log('[Telegram Alert] Skip pengiriman: Integrasi Telegram dinonaktifkan.');
      return;
    }

    const [tkResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_bot_token'");
    const [cdResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'telegram_chat_id'");
    const token = tkResult[0]?.key_value;
    const chatId = cdResult[0]?.key_value;
    if (!token || !chatId) {
      console.log('[Telegram Alert] Skip pengiriman: Token bot atau Chat ID kosong di pengaturan.');
      return;
    }

    const emoji = isCritical ? '🔴 <b>CRITICAL ALERT</b>' : '🟢 <b>RECOVERY</b>';
    const text = `${emoji}\n\n<b>${title}</b>\n${message}`;
    
    if (shouldBounceAlert('telegram', chatId, text)) return;

    console.log(`[Telegram Alert] Mengirim notifikasi ke chat ${chatId}: "${title}"`);
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
    .then(async res => {
      if (res.ok) {
        console.log('[Telegram Alert] Berhasil dikirim ke Telegram.');
      } else {
        const errText = await res.text();
        console.error('[Telegram Alert] Gagal dari API Telegram:', errText);
      }
    })
    .catch(e => console.error("[Telegram Alert] Kesalahan koneksi:", e));
  } catch (e) {
    console.error("[Telegram Alert] Gagal kirim notifikasi:", e);
  }
}

async function sendWhatsAppAlert(title: string, message: string, isCritical: boolean) {
  try {
    const [enabledResult]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'wa_enabled'");
    const isEnabled = enabledResult[0]?.key_value === 'true';
    if (!isEnabled) {
      console.log('[WhatsApp Alert] Skip pengiriman: Integrasi WhatsApp dinonaktifkan.');
      return;
    }

    // Sementara hilangkan IP Address untuk WhatsApp (komentari baris di bawah dan aktifkan baris kedua untuk mengembalikan IP)
    const cleanMessage = message.replace(/\s?\(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\)/g, '');
    // const cleanMessage = message; 

    const emoji = isCritical ? '🔴 *CRITICAL ALERT*' : '🟢 *RECOVERY*';
    const text = `${emoji}\n\n*${title}*\n${cleanMessage}`;
    
    if (shouldBounceAlert('whatsapp', 'broadcast_group', text)) return;

    console.log(`[WhatsApp Alert] Menjalankan broadcast notifikasi: "${title}"`);
    const success = await sendWhatsAppAlertBroadcast(title, text);
    if (success) {
      console.log('[WhatsApp Alert] Broadcast berhasil dikirim.');
    } else {
      console.error('[WhatsApp Alert] Broadcast gagal (mungkin tidak ada target aktif atau gateway belum terhubung).');
    }
  } catch (e) {
    console.error("[WhatsApp Alert] Gagal menjalankan broadcast:", e);
  }
}

async function handleStatusTransition(
  id: number,
  name: string,
  type: 'device' | 'ap',
  isOffline: boolean,
  parentDeviceId: number | null
): Promise<{ shouldAlert: boolean; downtimeMsg: string }> {
  const now = Date.now();
  
  // 1. Downtime calculation
  let downtimeMsg = "";
  if (type === 'device') {
    if (isOffline) {
      deviceOfflineTime[id] = now;
    } else {
      const offlineStart = deviceOfflineTime[id];
      if (offlineStart) {
        const diff = now - offlineStart;
        downtimeMsg = ` (Kembali aktif setelah mati selama ${formatDuration(diff)})`;
        delete deviceOfflineTime[id];
      }
    }
  } else {
    if (isOffline) {
      apOfflineTime[id] = now;
    } else {
      const offlineStart = apOfflineTime[id];
      if (offlineStart) {
        const diff = now - offlineStart;
        downtimeMsg = ` (Kembali aktif setelah mati selama ${formatDuration(diff)})`;
        delete apOfflineTime[id];
      }
    }
  }

  // 2. Flapping detection
  const historyRecord = type === 'device' ? deviceAlertHistory : apAlertHistory;
  const lockRecord = type === 'device' ? deviceAlertLocked : apAlertLocked;

  if (!historyRecord[id]) {
    historyRecord[id] = [];
  }

  // Add current transition timestamp
  historyRecord[id].push(now);

  // Prune history to last 2 minutes
  historyRecord[id] = historyRecord[id].filter(t => now - t <= 2 * 60 * 1000);

  // Check if locked
  const isLocked = now < (lockRecord[id] || 0);

  if (isLocked) {
    console.log(`[Alert Shield] Notifications for ${type} ${name} (ID: ${id}) suppressed due to active lock.`);
    return { shouldAlert: false, downtimeMsg };
  }

  // If transition count in last 2 minutes is >= 4, trigger lock!
  if (historyRecord[id].length >= 4) {
    const lockDuration = 5 * 60 * 1000; // 5 minutes
    lockRecord[id] = now + lockDuration;

    const warningTitle = `⚠️ Koneksi Tidak Stabil: Jaringan ${name} Naik-Turun`;
    const warningMessage = `Koneksi pada "${name}" terdeteksi terputus-sambung berulang kali dalam waktu singkat. Untuk menghindari spam, notifikasi Telegram & WhatsApp untuk area ini dinonaktifkan sementara selama 5 menit. Pemantauan di dashboard tetap berjalan.`;

    console.log(`[Alert Shield] Flapping detected on ${type} ${name} (ID: ${id}). Locking for 5 minutes.`);

    // Send warning alert
    sendTelegramAlert(warningTitle, warningMessage, true);
    sendWhatsAppAlert(warningTitle, warningMessage, true);

    // Save warning notification to database so it's visible on dashboard
    try {
      const channelsLog = await getActiveNotificationChannels();
      await db.query(
        `INSERT INTO notifications (device_id, device_name, type, title, message, action_url, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ parentDeviceId, name, 'warning', warningTitle, warningMessage + channelsLog, type === 'device' ? `/admin/devices?detail=${id}` : '/admin/aps', type ]
      );
    } catch (dbErr) {
      console.error("Failed to log flapping warning to DB:", dbErr);
    }

    return { shouldAlert: false, downtimeMsg };
  }

  return { shouldAlert: true, downtimeMsg };
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
      
      const isAlive = res.alive;
      const prevStatus = deviceLastStatus[device.id] || device.status || 'online';
      let newStatus = prevStatus;

      if (isAlive) {
        deviceFailCount[device.id] = 0;
        newStatus = 'online';
      } else {
        deviceFailCount[device.id] = (deviceFailCount[device.id] || 0) + 1;
        // Hanya anggap offline jika gagal 3 kali berturut-turut (30 detik)
        if (deviceFailCount[device.id] >= 3) {
          newStatus = 'offline';
        }
      }

      // Selalu update last_seen jika hidup
      if (isAlive) {
        await db.query("UPDATE mikrotik_devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [device.id]);
      }

      if (prevStatus !== newStatus) {
        const isOffline = newStatus === 'offline';
        const type = isOffline ? 'critical' : 'info';
        const title = isOffline
          ? `🚨 Gangguan Jaringan: Pusat Kontrol ${device.name} Terputus`
          : `✅ Pemulihan Jaringan: Pusat Kontrol ${device.name} Normal Kembali`;
        const message = isOffline
          ? `Pusat Kontrol Jaringan "${device.name}" (${device.host}) terdeteksi terputus. Koneksi internet di area cakupan ini mungkin terganggu atau terputus sementara.`
          : `Pusat Kontrol Jaringan "${device.name}" (${device.host}) telah aktif kembali dan seluruh layanan berjalan normal.`;

        // Update database status
        await db.query("UPDATE mikrotik_devices SET status = ? WHERE id = ?", [newStatus, device.id]);

        const channelsLog = await getActiveNotificationChannels();
        await db.query(
          `INSERT INTO notifications (device_id, device_name, type, title, message, action_url, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ device.id, device.name, type, title, message + channelsLog, `/admin/devices?detail=${device.id}`, 'mikrotik' ]
        );
        
        const { shouldAlert, downtimeMsg } = await handleStatusTransition(device.id, device.name, 'device', isOffline, device.id);
        if (shouldAlert) {
          sendTelegramAlert(title, message + downtimeMsg, isOffline);
          sendWhatsAppAlert(title, message + downtimeMsg, isOffline);
        }
        
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
      const isAlive = res.alive;
      const prevStatus = apLastStatus[ap.id] || ap.status || 'online';
      let newStatus = prevStatus;

      if (isAlive) {
        apFailCount[ap.id] = 0;
        newStatus = 'online';
      } else {
        apFailCount[ap.id] = (apFailCount[ap.id] || 0) + 1;
        if (apFailCount[ap.id] >= 3) {
          newStatus = 'offline';
        }
      }

      if (isAlive) {
        await db.query("UPDATE mikrotik_aps SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [ap.id]);
      }

      if (prevStatus !== newStatus) {
        const isOffline = newStatus === 'offline';
        const type = isOffline ? 'warning' : 'info';
        const title = isOffline
          ? `⚠️ Gangguan Wi-Fi: Titik Akses ${ap.name} Nonaktif`
          : `✅ Pemulihan Wi-Fi: Titik Akses ${ap.name} Aktif Kembali`;
        const message = isOffline
          ? `Titik Akses Wi-Fi "${ap.name}" di ${ap.group_label || 'Lokasi'} (${ap.ip_address}) terdeteksi terputus. Pengguna di sekitar area ini sementara waktu tidak dapat terhubung ke jaringan Wi-Fi.`
          : `Titik Akses Wi-Fi "${ap.name}" telah aktif kembali dan siap melayani pengguna.`;

        // Update DB status
        await db.query(`UPDATE mikrotik_aps SET status = ? WHERE id = ?`, [newStatus, ap.id]);

        const channelsLog = await getActiveNotificationChannels();
        await db.query(
          `INSERT INTO notifications (device_id, device_name, type, title, message, action_url, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ ap.mikrotik_id, ap.name, type, title, message + channelsLog, '/admin/aps', 'ap' ]
        );

        const { shouldAlert, downtimeMsg } = await handleStatusTransition(ap.id, ap.name, 'ap', isOffline, ap.mikrotik_id);
        if (shouldAlert) {
          sendTelegramAlert(title, message + downtimeMsg, isOffline);
          sendWhatsAppAlert(title, message + downtimeMsg, isOffline);
        }

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
      
      const [devices]: any = await db.query("SELECT id FROM mikrotik_devices WHERE logs_enabled = 1");
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
        let logs = [];
        try {
          const api = await client.connect();
          // Fetch last 50 logs from router
          logs = await api.menu('/log').print();
        } finally {
          await client.close().catch(() => {});
        }

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
        // Extract meaningful error details from the error object
        const deviceHost = device.host || 'unknown';
        const deviceName = device.name || 'Unknown Device';

        // Parse error to get actual message
        let errorMsg = "Gagal koneksi ke router";
        let errorType = "critical,system";

        // Check for specific error patterns
        const errMsg = err?.message || String(err);
        const errErrno = err?.errno || '';
        const errCode = err?.code || '';
        const errStack = err?.stack || '';

        if (errMsg.includes('Username or password is invalid') || errMsg.includes('CANTLOGIN')) {
          errorMsg = `Username atau Password MikroTik salah untuk ${deviceName} (${deviceHost})`;
          errorType = "critical,auth";
        } else if (errMsg.includes('Connection refused') || errErrno === -4078 || errCode === 'ECONNREFUSED') {
          errorMsg = `Koneksi ditolak oleh ${deviceName} (${deviceHost}). Pastikan API MikroTik sudah aktif di port 8728`;
          errorType = "error,network";
        } else if (errMsg.includes('Timed out') || errErrno === 'ETIMEDOUT' || errCode === 'ETIMEDOUT') {
          errorMsg = `Koneksi timeout ke ${deviceName} (${deviceHost}). Router tidak merespons dalam waktu yang ditentukan`;
          errorType = "warning,network";
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
          errorMsg = `Hostname/IP tidak ditemukan: ${deviceHost}. Pastikan alamat router benar`;
          errorType = "error,config";
        } else if (errMsg.includes('RosException') || errStack.includes('RosException')) {
          // Extract the specific RosException message
          const rosMatch = errMsg.match(/RosException[:\s]*(.+?)(?:\n|$)/);
          const rosMsg = rosMatch ? rosMatch[1].trim() : errMsg;
          errorMsg = `RosException dari ${deviceName} (${deviceHost}): ${rosMsg}`;
          errorType = "error,routeros";
        } else if (errMsg.includes('ECONNRESET')) {
          errorMsg = `Koneksi direset oleh ${deviceName} (${deviceHost}). Router mungkin overload atau koneksi terputus`;
          errorType = "warning,network";
        } else {
          // Use actual error message, truncate if too long
          const actualMsg = errMsg.length > 200 ? errMsg.substring(0, 200) + '...' : errMsg;
          errorMsg = `[${deviceName} (${deviceHost})] ${actualMsg}`;
          errorType = "error,system";
        }

        console.error(`\x1b[31m[Log-Archive] ❌ ${deviceName}: ${errorMsg}\x1b[0m`);

        // Log connection error to database so user sees it in LogsView
        try {
          const time = new Date().toLocaleTimeString('en-US', { hour12: false });
          const [recentError]: any = await db.query(
            "SELECT id FROM mikrotik_logs WHERE device_id = ? AND topics = ? AND message LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1",
            [device.id, errorType, `%${errorMsg.substring(0, 50)}%`]
          );
          if (recentError.length === 0) {
            await db.query(
              "INSERT INTO mikrotik_logs (device_id, mikrotik_id, time, topics, message) VALUES (?, ?, ?, ?, ?)",
              [device.id, '*err', time, errorType, `[System Error] ${errorMsg}`]
            );
          }
        } catch (dbErr) {
          console.error("Failed to log connection error to database:", dbErr);
        }
      }
    }

    // Auto-delete logs based on system settings
    const [[retention]]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = ?", ['log_retention_days']).catch(() => [[{ key_value: '30' }]]);
    const days = parseInt(retention?.key_value || '30');
    const [delResult]: any = await db.query(`DELETE FROM mikrotik_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
    await db.query(`DELETE FROM system_ai_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]).catch(() => {});
    
    if (delResult.affectedRows > 0) {
      console.log(`[Log-Archive] 🗑️ Auto-cleanup: Removed ${delResult.affectedRows} logs older than ${days} days.`);
    }
    
  } catch (err) {
    console.error("[Log-Archive] Worker error:", err);
  }
}, 60 * 1000);


// ── Vite Middleware & Start Server ──────────────────────────────────────────
async function startServer() {
  await initializeDB();
  app.use(cors());

  // Load WhatsApp if enabled
  try {
    const [rows]: any = await db.query("SELECT key_value FROM system_settings WHERE key_name = 'wa_enabled'");
    if (rows[0]?.key_value === 'true') {
      initAllActiveWhatsAppSessions();
    }
  } catch (err) {
    console.error("[WhatsApp] Startup check failed:", err);
  }

  // Try to load Vite if we are in DEV mode. Otherwise serve statically.
  if (process.env.NODE_ENV !== 'production' && process.env.AI_MODE !== 'true') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
      console.log('Vite middleware loaded');
    } catch (e) {
      console.log('Failed to start vite, falling back to static');
    }
  } else {
    // HOSTING PRODUCTION (Web App)
    console.log('[PROD] Serving static files from dist/');
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(`http://${iface.address}:${PORT}`);
        }
      }
    }

    console.log(`\n🚀 Monitoring ITATS Server is Ready!`);
    console.log(`➜  Web (Local):   http://localhost:${PORT}`);
    addresses.forEach(addr => {
      console.log(`➜  Mobile (Wifi):  ${addr}`);
    });
    console.log(`──────────────────────────────────────────\n`);
  });
}

startServer();
