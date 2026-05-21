import { Router } from "express";
import { db } from "../db";
import { createMikrotikClient } from "./mikrotiks.route";

export const publicRouter = Router();

// Endpoint for public facing status view (Used by login page)
publicRouter.get("/status", async (req, res) => {
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
    const [recentIssues]: any = await db.query(
      `SELECT id as device_id, 'Notification' as device_name, type, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 5`,
    );

    const onl = parseInt(online) || 0;
    const off = parseInt(offline) || 0;
    const unk = parseInt(unknownCount) || 0;

    res.json({
      devices: {
        total: onl + off + unk,
        online: onl,
        offline: off,
        unknown: unk,
      },
      recentIssues: recentIssues || [],
      criticalAlerts: parseInt(total_unread) || 0,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    res.json({ error: true });
  }
});

publicRouter.get("/campus-map", async (req, res) => {
  try {
    const [devices]: any = await db.query("SELECT * FROM mikrotik_devices");
    const [aps]: any = await db.query("SELECT * FROM mikrotik_aps");

    const data = await Promise.all(
      devices
        .filter((d: any) => d.lat && d.lng)
        .map(async (device: any) => {
          const deviceAPs = aps.filter((a: any) => a.mikrotik_id === device.id);
          let liveStatus = device.status;

          if (process.env.MIKROTIK_SIMULATION_MODE !== "true") {
            try {
              const client = createMikrotikClient(device);
              const api = await client.connect();
              liveStatus = "online";
              await client.close().catch(() => {});
              await db.query(
                "UPDATE mikrotik_devices SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
                ["online", device.id],
              );
            } catch {
              liveStatus = "offline";
              await db.query(
                "UPDATE mikrotik_devices SET status = ? WHERE id = ?",
                ["offline", device.id],
              );
            }
          }

          const floorsMap: Record<string, any[]> = {};

          deviceAPs.forEach((ap: any) => {
            const label = ap.group_label || "General Area";
            if (!floorsMap[label]) floorsMap[label] = [];
            floorsMap[label].push({
              id: `ap-${ap.id}`,
              name: ap.name,
              cap: 50,
              current: ap.last_client_count || 0,
              status: liveStatus === "online" ? "online" : "offline",
            });
          });

          const floors = Object.keys(floorsMap).map((key) => ({
            level: key,
            rooms: floorsMap[key],
          }));

          const totalClients = Object.values(floorsMap)
            .flat()
            .reduce((sum, room: any) => sum + (room.current || 0), 0);
          const totalCapacity = Object.values(floorsMap)
            .flat()
            .reduce((sum, room: any) => sum + (room.cap || 0), 0);
          const density = totalCapacity
            ? Math.round((totalClients / totalCapacity) * 100)
            : 0;
          const online = liveStatus === "online";
          const loadLabel = !online
            ? "Offline"
            : density >= 90
              ? "Sangat Ramai"
              : density >= 70
                ? "Ramai"
                : density >= 40
                  ? "Sedang"
                  : "Ringan";

          if (floors.length === 0) {
            floors.push({
              level: "Router Core",
              rooms: [
                {
                  id: `virt-${device.id}`,
                  name: "Eth Interfaces",
                  cap: 0,
                  current: 0,
                  status: liveStatus,
                },
              ],
            });
          }

          return {
            id: `dev-${device.id}`,
            name: device.name,
            lat: device.lat,
            lng: device.lng,
            hasWifi: deviceAPs.length > 0 || online,
            online,
            status: liveStatus,
            total_clients: totalClients,
            total_capacity: totalCapacity,
            density,
            load_label: loadLabel,
            floors,
          };
        }),
    );

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
