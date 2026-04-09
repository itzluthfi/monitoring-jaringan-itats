import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

notificationsRouter.post('/read-all', requireAuth, async (req, res) => {
  try {
    await db.query("UPDATE notifications SET is_read = 1");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

notificationsRouter.post('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

notificationsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM notifications WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

notificationsRouter.delete('/', requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM notifications");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
