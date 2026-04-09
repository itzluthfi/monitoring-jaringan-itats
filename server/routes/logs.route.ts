import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const logsRouter = Router();

logsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { device_id, search, topics, limit = 100, page = 1, grouped = 'false', startDate, endDate, sort = 'desc' } = req.query;
    const isGrouped = grouped === 'true';
    
    let query = "";
    const params: any[] = [];
    const offset = (Number(page) - 1) * Number(limit);

    if (isGrouped) {
      query = `
        SELECT 
          l.message, 
          l.topics, 
          l.device_id,
          d.name as device_name,
          COUNT(*) as occurrences,
          MAX(l.created_at) as last_seen,
          MIN(l.created_at) as first_seen,
          MAX(l.id) as max_id
        FROM mikrotik_logs l 
        LEFT JOIN mikrotik_devices d ON l.device_id = d.id 
        WHERE 1=1
      `;
    } else {
      query = "SELECT l.*, d.name as device_name FROM mikrotik_logs l LEFT JOIN mikrotik_devices d ON l.device_id = d.id WHERE 1=1";
    }
    
    if (device_id) {
      query += " AND l.device_id = ?";
      params.push(device_id);
    }
    
    if (search) {
      query += " AND l.message LIKE ?";
      params.push(`%${search}%`);
    }
    
    if (topics) {
      query += " AND l.topics LIKE ?";
      params.push(`%${topics}%`);
    }
    
    if (startDate) {
      query += " AND l.created_at >= ?";
      params.push((startDate as string).replace('T', ' '));
    }
    if (endDate) {
      query += " AND l.created_at <= ?";
      params.push((endDate as string).replace('T', ' '));
    }

    if (isGrouped) {
      query += ` GROUP BY l.device_id, d.name, l.message, l.topics ORDER BY last_seen ${sort === 'asc' ? 'ASC' : 'DESC'}`;
    } else {
      query += ` ORDER BY l.id ${sort === 'asc' ? 'ASC' : 'DESC'}`;
    }

    query += " LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);
    
    const [rows] = await db.query(query, params);
    
    // Count total for pagination
    let countQuery = "";
    const countParams: any[] = [];
    if (isGrouped) {
       countQuery = "SELECT COUNT(*) as total FROM (SELECT 1 FROM mikrotik_logs l WHERE 1=1";
    } else {
       countQuery = "SELECT COUNT(*) as total FROM mikrotik_logs l WHERE 1=1";
    }

    if (device_id) { countQuery += " AND l.device_id = ?"; countParams.push(device_id); }
    if (search) { countQuery += " AND l.message LIKE ?"; countParams.push(`%${search}%`); }
    if (topics) { countQuery += " AND l.topics LIKE ?"; countParams.push(`%${topics}%`); }
    if (topics) { countQuery += " AND l.topics LIKE ?"; countParams.push(`%${topics}%`); }
    if (startDate) { countQuery += " AND l.created_at >= ?"; countParams.push((startDate as string).replace('T', ' ')); }
    if (endDate) { countQuery += " AND l.created_at <= ?"; countParams.push((endDate as string).replace('T', ' ')); }
    
    if (isGrouped) {
        countQuery += " GROUP BY l.device_id, l.message, l.topics) as sub";
    }
    
    const [countRows]: any = await db.query(countQuery, countParams);
    
    // Safety check for empty grouped results
    const total = isGrouped ? (countRows[0]?.total || 0) : (countRows[0]?.total || 0);

    res.json({
      data: rows,
      total: total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

logsRouter.post('/seed', requireAuth, async (req, res) => {
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

    const [devices]: any = await db.query("SELECT id FROM mikrotik_devices LIMIT 3");
    if (devices.length === 0) {
      return res.status(400).json({ error: "No devices found to seed logs for." });
    }

    for (let i = 0; i < 20; i++) {
      const d = devices[i % devices.length];
      const rand = messages[Math.floor(Math.random() * messages.length)];
      const time = new Date(Date.now() - (Math.random() * 1000000)).toLocaleTimeString('en-US', { hour12: false });
      
      await db.query(
        "INSERT INTO mikrotik_logs (device_id, mikrotik_id, time, topics, message) VALUES (?, ?, ?, ?, ?)",
        [d.id, '*seed', time, rand.topics, rand.msg]
      );
    }

    res.json({ success: true, message: "Demo logs seeded successfully" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

logsRouter.post('/manual-cleanup', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, deviceIds } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start and End dates are required" });
    }

    let sql = "DELETE FROM mikrotik_logs WHERE created_at BETWEEN ? AND ?";
    const params: any[] = [
      startDate.replace('T', ' '), 
      endDate.replace('T', ' ')
    ];

    // Added device filtering: null or empty means all sources
    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
      sql += ` AND device_id IN (${deviceIds.map(() => '?').join(',')})`;
      params.push(...deviceIds);
    }

    const [result]: any = await db.query(sql, params);

    res.json({ 
      success: true, 
      message: `${result.affectedRows} logs deleted successfully` 
    });
  } catch (err) {
    console.error("[Cleanup-API] Error:", err);
    res.status(500).json({ error: String(err) });
  }
});

