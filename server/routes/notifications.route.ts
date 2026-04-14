import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const [rows]: any = await db.query(
      "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );

    const [[countResult]]: any = await db.query("SELECT COUNT(*) as total FROM notifications");
    const total = countResult?.total || 0;

    const [[unreadResult]]: any = await db.query("SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0");
    const unreadCount = unreadResult?.unread || 0;

    res.json({
      data: rows,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
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
