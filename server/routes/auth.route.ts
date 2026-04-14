import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { requireAuth, JWT_SECRET } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const cleanUsername = username.trim();

  try {
    const [users]: any = await db.query("SELECT * FROM admin_users WHERE username = ?", [cleanUsername]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

authRouter.get('/verify', requireAuth, (req: any, res) => {
  res.json({ valid: true, user: req.user });
});

authRouter.post('/change-password', requireAuth, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password required" });
  }

  try {
    const [users]: any = await db.query("SELECT * FROM admin_users WHERE id = ?", [req.user.id]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE admin_users SET password = ? WHERE id = ?", [hash, req.user.id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to change password" });
  }
});
