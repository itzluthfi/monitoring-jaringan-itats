import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { requireAuth, JWT_SECRET } from '../middleware/auth';
import { sendOtpEmail } from '../lib/mailer';

export const adminsRouter = Router();

// ── GET /api/admins — List all admin users (no passwords) ─────────────────────
adminsRouter.get('/', requireAuth, async (_req, res) => {
  try {
    const [rows]: any = await db.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM admin_users ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Gagal mengambil daftar admin' });
  }
});

// ── POST /api/admins — Create new admin ───────────────────────────────────────
adminsRouter.post('/', requireAuth, async (req, res) => {
  const { username, password, email, role = 'admin' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid (admin/viewer)' });
  }

  try {
    const [existing]: any = await db.query('SELECT id FROM admin_users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    if (email) {
      const [emailExist]: any = await db.query('SELECT id FROM admin_users WHERE email = ?', [email]);
      if (emailExist.length > 0) {
        return res.status(409).json({ error: 'Email sudah terdaftar' });
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const [result]: any = await db.query(
      'INSERT INTO admin_users (username, password, email, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [username, hash, email || null, role]
    );
    res.status(201).json({ id: result.insertId, username, email, role, is_active: 1 });
  } catch {
    res.status(500).json({ error: 'Gagal membuat admin baru' });
  }
});

// ── PUT /api/admins/:id — Update admin (no password) ─────────────────────────
adminsRouter.put('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const { email, role, is_active } = req.body;

  if (role !== undefined && !['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }

  try {
    const [existing]: any = await db.query('SELECT id FROM admin_users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Admin tidak ditemukan' });
    }

    // Jangan izinkan nonaktifkan diri sendiri
    if (is_active === 0 && parseInt(id) === req.user.id) {
      return res.status(403).json({ error: 'Anda tidak bisa menonaktifkan akun Anda sendiri' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (email !== undefined)     { updates.push('email = ?');     values.push(email || null); }
    if (role !== undefined)      { updates.push('role = ?');      values.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada data untuk diupdate' });

    values.push(id);
    await db.query(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Gagal mengupdate admin' });
  }
});

// ── DELETE /api/admins/:id — Delete admin ─────────────────────────────────────
adminsRouter.delete('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params;

  // Tidak boleh menghapus diri sendiri
  if (parseInt(id) === req.user.id) {
    return res.status(403).json({ error: 'Anda tidak bisa menghapus akun Anda sendiri' });
  }

  try {
    const [existing]: any = await db.query('SELECT id FROM admin_users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Admin tidak ditemukan' });
    }
    await db.query('DELETE FROM admin_users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Gagal menghapus admin' });
  }
});

// ── POST /api/admins/forgot-password — Kirim OTP reset ke email ───────────────
adminsRouter.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username wajib diisi' });

  try {
    const [users]: any = await db.query(
      'SELECT id, username, email FROM admin_users WHERE username = ? AND is_active = 1',
      [username]
    );
    const user = users[0];
    // Selalu kembalikan sukses agar tidak bocorkan info user existence
    if (!user) {
      return res.json({ success: true, message: 'Jika username valid, OTP akan dikirim ke email.' });
    }

    // Cari email tujuan: email user atau fallback ke SMTP_RESET_EMAIL
    const resetEmail = user.email || process.env.SMTP_RESET_EMAIL;
    if (!resetEmail) {
      return res.status(500).json({ error: 'Admin ini belum memiliki email. Hubungi super admin.' });
    }

    // Generate OTP 6 digit
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    // Hapus OTP lama yang belum digunakan untuk user ini
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);

    // Simpan OTP baru
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, otpHash, expiresAt]
    );

    await sendOtpEmail(resetEmail, user.username, otp);

    const maskedEmail = resetEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    return res.json({ success: true, maskedEmail });
  } catch (err: any) {
    console.error('[ForgotPassword]', err);
    return res.status(500).json({ error: err.message || 'Gagal mengirim OTP' });
  }
});

// ── POST /api/admins/reset-password — Verifikasi OTP + set password baru ─────
adminsRouter.post('/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!username || !otp || !newPassword) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }

  try {
    const [users]: any = await db.query('SELECT id FROM admin_users WHERE username = ?', [username]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'Username tidak ditemukan' });

    const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const [tokens]: any = await db.query(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );
    const token = tokens[0];

    if (!token) return res.status(400).json({ error: 'OTP tidak ditemukan atau sudah kedaluwarsa' });
    if (token.token_hash !== otpHash) return res.status(400).json({ error: 'OTP salah. Periksa kode yang dikirim ke email.' });

    // OTP valid — update password dan tandai token terpakai
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE admin_users SET password = ? WHERE id = ?', [hash, user.id]);
    await db.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [token.id]);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[ResetPassword]', err);
    res.status(500).json({ error: 'Gagal mereset password' });
  }
});
