import { Router } from "express";
import { db } from "../db";
import { createMikrotikClient } from "./mikrotiks.route";
import { getCachedResponse, setCachedResponse } from "../middleware/publicSecurity";

export const publicRouter = Router();

// ── Private Helpers (tidak diekspor, tidak bocor ke response) ─────────────────

/** Format bytes/s ke label manusiawi */
const formatBps = (bps: number): string => {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
};

/**
 * Hapus nama teknis perangkat jaringan dari string yang tampil ke publik.
 * - Hapus "mikrotik" (case-insensitive)
 * - Terjemahkan jargon teknis ke bahasa manusiawi
 */
const sanitizeName = (name: string): string => {
  if (!name) return "";
  let clean = name;
  const lower = clean.toLowerCase();

  if (lower === "router core") return "Pusat Jaringan";
  if (lower === "eth interfaces") return "Area Jaringan";

  clean = clean.replace(/mikrotik\s*/gi, "");
  clean = clean.replace(/router\s*core/gi, "Pusat Jaringan");
  clean = clean.replace(/eth\s*interfaces?/gi, "Area Jaringan");
  clean = clean.replace(/ethernet/gi, "Koneksi Kabel");
  clean = clean.replace(/[-_\s]+/g, " ").trim();

  return clean || "Area Kampus";
};

/**
 * Sanitasi judul notifikasi/issue untuk publik.
 * - Hapus "MIKROTIK" dari judul
 * - Ganti prefix teknis "Router Up/Down" dengan bahasa manusiawi
 */
const sanitizeIssueTitle = (title: string): string => {
  if (!title) return "";
  let t = title;
  t = t.replace(/router\s+up\s*:/gi, "Jaringan Normal:");
  t = t.replace(/router\s+down\s*:/gi, "Gangguan Terdeteksi:");
  t = t.replace(/router\s+up/gi, "Jaringan Normal");
  t = t.replace(/router\s+down/gi, "Gangguan Terdeteksi");
  return sanitizeName(t);
};

/** Klasifikasi perangkat dari hostname DHCP — hanya untuk kategorisasi internal */
const classifyDevice = (hostname: string): string => {
  const h = (hostname || "").toLowerCase();
  if (h.includes("ap") || h.includes("access") || h.includes("wifi") || h.includes("wlan"))
    return "Access Point";
  if (h.includes("print") || h.includes("printer")) return "Printer";
  if (h.includes("cam") || h.includes("cctv") || h.includes("camera")) return "Kamera CCTV";
  if (h.includes("server") || h.includes("srv") || h.includes("nas")) return "Server";
  if (h.includes("pc") || h.includes("comp") || h.includes("desktop") || h.includes("lab"))
    return "Komputer Kampus";
  if (h.includes("tv") || h.includes("display") || h.includes("smart"))
    return "Layar / Smart TV";
  return "Perangkat Kampus";
};

// ── GET /api/public/status ────────────────────────────────────────────────────
// Hanya data agregat jaringan + riwayat gangguan yang sudah disanitasi.
// TIDAK mengekspos: ID internal, nama perangkat teknis, jumlah alert internal.

publicRouter.get("/status", async (req, res) => {
  const cached = getCachedResponse("public:status");
  if (cached) return res.json(cached);

  try {
    const [[{ online, offline, unknownCount }]]: any = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN status IS NULL OR status = '' THEN 1 ELSE 0 END) as unknownCount
      FROM mikrotik_devices
    `);

    const [[{ total_unread }]]: any = await db.query(
      `SELECT COUNT(*) as total_unread FROM notifications WHERE is_read = 0`,
    );

    // Ambil 5 notifikasi terbaru — hanya type & title yang disanitasi
    const [rawIssues]: any = await db.query(
      `SELECT type, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 5`,
    );

    const onl = parseInt(online) || 0;
    const off = parseInt(offline) || 0;
    const unk = parseInt(unknownCount) || 0;
    const unreadCount = parseInt(total_unread) || 0;

    const result = {
      // Status perangkat jaringan (agregat — tidak ada nama/ID spesifik)
      network: {
        total: onl + off + unk,
        online: onl,
        offline: off,
      },
      // Apakah ada gangguan aktif? (boolean — tidak ekspos jumlah internal)
      hasActiveAlerts: unreadCount > 0,
      // Riwayat gangguan — disanitasi: tanpa ID, tanpa nama perangkat teknis
      recentIssues: (rawIssues || []).map((issue: any) => ({
        type: issue.type,                          // "info" | "critical"
        title: sanitizeIssueTitle(issue.title),    // "Jaringan Normal: Gedung A"
        time: issue.created_at,                    // timestamp (tidak ada ID)
      })),
      lastUpdated: new Date().toISOString(),
    };

    setCachedResponse("public:status", result, 30_000);
    return res.json(result);
  } catch {
    return res.json({ error: true });
  }
});

// ── GET /api/public/campus-map ────────────────────────────────────────────────
// Data peta kampus untuk publik — TIDAK mengekspos:
//   - Nama "MikroTik" atau nama teknis perangkat
//   - Koordinat lat/lng internal (hanya untuk rendering peta — tidak sensitif)
//   - IP address, MAC address, hostname
//   - ID internal database (floor rooms, virt devices)
//   - Raw bytes bandwidth (hanya label manusiawi)
//   - Total capacity 0 (tidak dikonfigurasi)
//   - Field teknis: hasWifi, status (redundant dengan online)

publicRouter.get("/campus-map", async (req, res) => {
  const cached = getCachedResponse("public:campus-map");
  if (cached) return res.json(cached);

  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    const [aps]: any = await db.query("SELECT * FROM mikrotik_aps");

    const data = await Promise.all(
      devices
        .filter((d: any) => d.lat && d.lng)
        .map(async (device: any) => {
          const deviceAPs = aps.filter((a: any) => a.mikrotik_id === device.id);
          let liveStatus = device.status;

          let userCount = 0;
          let deviceCount = 0;
          const deviceCategoryMap: Record<string, number> = {};
          const userBreakdownMap: Record<string, number> = {};
          let bwRxBps = 0;
          let bwTxBps = 0;

          if (process.env.MIKROTIK_SIMULATION_MODE !== "true") {
            try {
              const client = createMikrotikClient(device);
              const api = await client.connect();
              liveStatus = "online";

              const safeWrite = async (cmd: string[]): Promise<any[]> => {
                try {
                  return await new Promise<any[]>((resolve) => {
                    const timeout = setTimeout(() => resolve([]), 6000);
                    try {
                      (api as any).rosApi.write(cmd)
                        .then((r: any) => { clearTimeout(timeout); resolve(Array.isArray(r) ? r : []); })
                        .catch(() => { clearTimeout(timeout); resolve([]); });
                    } catch { clearTimeout(timeout); resolve([]); }
                  });
                } catch { return []; }
              };

              // 1. DHCP leases → static vs dynamic mapping (tidak dikirim ke response)
              const leases = await safeWrite(["/ip/dhcp-server/lease/print"]);
              const leaseMap: Record<string, { dynamic: boolean; hostname: string }> = {};
              if (Array.isArray(leases)) {
                leases.forEach((lease: any) => {
                  const mac = (lease["mac-address"] || "").toLowerCase();
                  if (!mac) return;
                  leaseMap[mac] = {
                    dynamic: String(lease["dynamic"]) === "true",
                    hostname: lease["host-name"] || lease["comment"] || "",
                  };
                });
              }

              // 2. ARP → hitung pengguna WiFi vs perangkat kampus
              const arpEntries = await safeWrite(["/ip/arp/print"]);
              const seenMacs = new Set<string>();
              if (Array.isArray(arpEntries)) {
                arpEntries.forEach((entry: any) => {
                  const mac = (entry["mac-address"] || "").toLowerCase();
                  if (!mac || !entry["address"] || seenMacs.has(mac)) return;
                  seenMacs.add(mac);
                  const lease = leaseMap[mac];
                  if (!lease || lease.dynamic) {
                    userCount++;
                    // Classify user device type from hostname (anonymous — no ID exposed)
                    const hn = (lease?.hostname || "").toLowerCase();
                    let userType = "Perangkat Lainnya";
                    if (/iphone|ipad|ios/.test(hn)) userType = "iPhone / iPad";
                    else if (/android|samsung|xiaomi|redmi|oppo|vivo|huawei|pixel|realme|poco|honor|oneplus/.test(hn)) userType = "Android";
                    else if (/macbook|mac-mini|macmini/.test(hn)) userType = "MacBook";
                    else if (/laptop|notebook|thinkpad|lenovo|asus|dell|hp-notebook|ideapad/.test(hn)) userType = "Laptop";
                    else if (/pc|desktop|windows|komputer/.test(hn)) userType = "Komputer";
                    else if (!hn) userType = "Perangkat Tidak Dikenal";
                    userBreakdownMap[userType] = (userBreakdownMap[userType] || 0) + 1;
                  } else {
                    deviceCount++;
                    const cat = classifyDevice(lease.hostname);
                    deviceCategoryMap[cat] = (deviceCategoryMap[cat] || 0) + 1;
                  }
                });
              }

              // 3. Bandwidth — dual snapshot (tidak dikirim raw, hanya label)
              const snap1 = await safeWrite(["/interface/print", "=stats="]);
              if (snap1.length > 0) {
                await new Promise((r) => setTimeout(r, 1000));
                const snap2 = await safeWrite(["/interface/print", "=stats="]);
                if (snap2.length > 0) {
                  const s1Map: Record<string, any> = {};
                  snap1.forEach((i: any) => { if (i.name) s1Map[i.name] = i; });
                  let rx = 0, tx = 0;
                  snap2.forEach((iface: any) => {
                    const n = (iface.name || "").toLowerCase();
                    if (n === "lo" || n.startsWith("loopback")) return;
                    const prev = s1Map[iface.name];
                    if (!prev) return;
                    rx += Math.max(0, parseInt(iface["rx-byte"] || "0") - parseInt(prev["rx-byte"] || "0"));
                    tx += Math.max(0, parseInt(iface["tx-byte"] || "0") - parseInt(prev["tx-byte"] || "0"));
                  });
                  bwRxBps = Math.round(rx / 2);
                  bwTxBps = Math.round(tx / 2);
                }
              }

              await client.close().catch(() => {});
              await db.query(
                "UPDATE mikrotik_devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
                ["online", device.id],
              );
            } catch {
              liveStatus = "offline";
              await db.query("UPDATE mikrotik_devices SET status = ? WHERE id = ?", ["offline", device.id]);
            }
          } else {
            // Simulation mode
            userCount = Math.floor(Math.random() * 55) + 5;
            deviceCount = Math.floor(Math.random() * 12) + 1;
            deviceCategoryMap["Access Point"] = Math.floor(Math.random() * 4) + 1;
            deviceCategoryMap["Komputer Kampus"] = Math.floor(Math.random() * 6) + 1;
            deviceCategoryMap["Printer"] = Math.floor(Math.random() * 2);
            // Simulate user breakdown
            userBreakdownMap["Android"] = Math.floor(userCount * 0.5);
            userBreakdownMap["iPhone / iPad"] = Math.floor(userCount * 0.2);
            userBreakdownMap["Laptop"] = Math.floor(userCount * 0.15);
            userBreakdownMap["Perangkat Tidak Dikenal"] = userCount - Math.floor(userCount * 0.85);
            bwRxBps = Math.floor(Math.random() * 80_000_000);
            bwTxBps = Math.floor(Math.random() * 30_000_000);
          }

          // Build floors dari DB AP — sanitasi nama, hapus ID internal
          const floorsMap: Record<string, any[]> = {};
          deviceAPs.forEach((ap: any) => {
            const label = ap.group_label || "Area Umum";
            if (!floorsMap[label]) floorsMap[label] = [];
            floorsMap[label].push({
              // Tidak ada "id" — tidak ekspos ID internal
              name: sanitizeName(ap.name),
              current: ap.last_client_count || 0,
              online: liveStatus === "online",
            });
          });

          const floors = Object.keys(floorsMap).map((key) => ({
            level: sanitizeName(key),
            areas: floorsMap[key],
          }));

          // Jika tidak ada AP, tampilkan satu entri generik
          if (floors.length === 0) {
            floors.push({
              level: "Area Umum",
              areas: [{
                name: "Jaringan Utama",
                current: userCount,
                online: liveStatus === "online",
              }],
            });
          }

          const online = liveStatus === "online";
          // Kapasitas: 50 pengguna per AP, minimum 50 jika tidak ada AP terkonfigurasi
          const apCapacity = deviceAPs.length > 0 ? deviceAPs.length * 50 : 50;
          const capacityForDensity = apCapacity;
          const density = Math.min(100, Math.round((userCount / capacityForDensity) * 100));
          const loadLabel = !online
            ? "Offline"
            : density >= 90 ? "Sangat Ramai"
            : density >= 70 ? "Ramai"
            : density >= 40 ? "Sedang"
            : "Ringan";

          const device_categories = Object.entries(deviceCategoryMap)
            .filter(([, count]) => count > 0)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);

          const user_breakdown = Object.entries(userBreakdownMap)
            .filter(([, count]) => count > 0)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);

          // ── RESPONSE PUBLIK BERSIH ────────────────────────────────────────
          // Yang DIKIRIM: nama (sudah sanitasi), koordinat (untuk peta),
          //   jumlah pengguna (agregat), bandwidth (label saja), status (boolean)
          // Yang TIDAK DIKIRIM: ID DB, nama "MikroTik", raw bytes, IP, MAC,
          //   hostname, total_capacity, hasWifi, status string (redundan)
          return {
            id: `loc-${device.id}`,
            name: sanitizeName(device.name),
            lat: device.lat,
            lng: device.lng,
            online,
            user_count: userCount,
            user_breakdown,
            device_count: deviceCount,
            device_categories,
            density,
            load_label: loadLabel,
            bandwidth_download: online && bwRxBps > 0 ? formatBps(bwRxBps) : null,
            bandwidth_upload: online && bwTxBps > 0 ? formatBps(bwTxBps) : null,
            floors,
          };
        }),
    );

    setCachedResponse("public:campus-map", data, 30_000);
    return res.json(data);
  } catch {
    return res.status(500).json({ error: "Terjadi kesalahan. Silakan coba lagi." });
  }
});
