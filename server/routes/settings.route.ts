import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

export const settingsRouter = Router();

// Get specific setting — return null value jika belum pernah dibuat (bukan 404)
settingsRouter.get('/:key', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT key_value FROM system_settings WHERE key_name = ?', [req.params.key]);
    if (rows.length === 0) return res.json({ value: null }); // Belum ada, tapi bukan error
    res.json({ value: rows[0].key_value });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update or create setting
settingsRouter.post('/:key', requireAuth, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "Value is required" });

    await db.query(`
      INSERT INTO system_settings (key_name, key_value) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)
    `, [req.params.key, String(value)]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
