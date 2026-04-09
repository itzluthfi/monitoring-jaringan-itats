import { Router } from 'express';
import { db } from '../db';
import { createMikrotikClient } from './mikrotiks.route';

export const publicRouter = Router();

// Endpoint for public facing status view (Used by login page)
publicRouter.get('/status', async (req, res) => {
  try {
    const [[{ online, offline, unknownCount }]]: any = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN status IS NULL OR status = '' THEN 1 ELSE 0 END) as unknownCount
      FROM mikrotik_devices
    `);
    
    const [[{ total_unread }]]: any = await db.query(`SELECT COUNT(*) as total_unread FROM notifications WHERE is_read = 0`);
    const [recentIssues]: any = await db.query(`SELECT id as device_id, 'Notification' as device_name, type, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 5`);

    const onl = parseInt(online) || 0;
    const off = parseInt(offline) || 0;
    const unk = parseInt(unknownCount) || 0;

    res.json({
      devices: {
        total: onl + off + unk,
        online: onl,
        offline: off,
        unknown: unk
      },
      recentIssues: recentIssues || [],
      criticalAlerts: parseInt(total_unread) || 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    res.json({ error: true });
  }
});
