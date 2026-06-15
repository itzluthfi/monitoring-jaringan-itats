import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';
import {
  initWhatsAppSession,
  disconnectWhatsAppSession,
  getWhatsAppSessionInfo,
  sendWhatsAppMessageFromSession
} from '../lib/whatsapp';

export const whatsappRouter = Router();

// =========================================================================
// 1. SOURCES (NOMOR SUMBER) CRUD & LIFECYCLE
// =========================================================================

// List all configured WhatsApp sources
whatsappRouter.get('/sources', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM whatsapp_sources ORDER BY created_at DESC');
    
    // Supplement database status with live in-memory info (like QR code data URL)
    const supplemented = rows.map((row: any) => {
      const info = getWhatsAppSessionInfo(row.session_id);
      return {
        ...row,
        status: info.status || row.status,
        qr: info.qr,
        phone_number: info.number || row.phone_number
      };
    });
    
    res.json(supplemented);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Add a new WhatsApp source profile
whatsappRouter.post('/sources', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nama sumber diperlukan.' });
    }

    // Generate a unique random session ID prefix
    const sessionId = crypto.randomBytes(8).toString('hex');

    await db.query(
      'INSERT INTO whatsapp_sources (name, session_id, status, is_active) VALUES (?, ?, ?, ?)',
      [name, sessionId, 'disconnected', 1]
    );

    res.json({ success: true, message: 'Sumber WhatsApp berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete a WhatsApp source profile
whatsappRouter.delete('/sources/:id', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT session_id FROM whatsapp_sources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sumber tidak ditemukan.' });
    }

    const sessionId = rows[0].session_id;
    // Shut down Baileys and delete local files
    await disconnectWhatsAppSession(sessionId);

    // Delete database entry
    await db.query('DELETE FROM whatsapp_sources WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Sumber WhatsApp berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Toggle WhatsApp source activation status
whatsappRouter.put('/sources/:id/toggle', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT is_active, session_id FROM whatsapp_sources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sumber tidak ditemukan.' });
    }

    const nextActive = rows[0].is_active === 1 ? 0 : 1;
    const sessionId = rows[0].session_id;

    await db.query('UPDATE whatsapp_sources SET is_active = ? WHERE id = ?', [nextActive, req.params.id]);

    // If deactivated, disconnect Baileys socket
    if (nextActive === 0) {
      await disconnectWhatsAppSession(sessionId);
    } else {
      // If activated, try to boot Baileys socket
      initWhatsAppSession(sessionId);
    }

    res.json({ success: true, active: nextActive === 1 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get status & QR code for a specific source
whatsappRouter.get('/sources/:id/status', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT session_id, status, phone_number FROM whatsapp_sources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sumber tidak ditemukan.' });
    }

    const sessionId = rows[0].session_id;
    const info = getWhatsAppSessionInfo(sessionId);

    res.json({
      sessionId,
      status: info.status || rows[0].status,
      qr: info.qr,
      number: info.number || rows[0].phone_number
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Manually trigger connect / start scan process
whatsappRouter.post('/sources/:id/connect', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT session_id FROM whatsapp_sources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sumber tidak ditemukan.' });
    }

    initWhatsAppSession(rows[0].session_id);
    res.json({ success: true, message: 'Menghubungkan ke WhatsApp Web...' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Manually trigger disconnect
whatsappRouter.post('/sources/:id/disconnect', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT session_id FROM whatsapp_sources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sumber tidak ditemukan.' });
    }

    await disconnectWhatsAppSession(rows[0].session_id);
    res.json({ success: true, message: 'WhatsApp diputuskan.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// =========================================================================
// 2. TARGETS (NOMOR TUJUAN) CRUD
// =========================================================================

// List all configured WhatsApp targets
whatsappRouter.get('/targets', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM whatsapp_targets ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Add a new WhatsApp target recipient
whatsappRouter.post('/targets', requireAuth, async (req, res) => {
  try {
    const { name, phone_number } = req.body;
    if (!name || !phone_number) {
      return res.status(400).json({ error: 'Nama dan Nomor Telepon diperlukan.' });
    }

    await db.query(
      'INSERT INTO whatsapp_targets (name, phone_number, is_active) VALUES (?, ?, ?)',
      [name, phone_number, 1]
    );

    res.json({ success: true, message: 'Nomor tujuan berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Edit an existing WhatsApp target recipient
whatsappRouter.put('/targets/:id', requireAuth, async (req, res) => {
  try {
    const { name, phone_number } = req.body;
    if (!name || !phone_number) {
      return res.status(400).json({ error: 'Nama dan Nomor Telepon diperlukan.' });
    }

    await db.query(
      'UPDATE whatsapp_targets SET name = ?, phone_number = ? WHERE id = ?',
      [name, phone_number, req.params.id]
    );

    res.json({ success: true, message: 'Nomor tujuan berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Toggle target active state
whatsappRouter.put('/targets/:id/toggle', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT is_active FROM whatsapp_targets WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nomor tujuan tidak ditemukan.' });
    }

    const nextActive = rows[0].is_active === 1 ? 0 : 1;
    await db.query('UPDATE whatsapp_targets SET is_active = ? WHERE id = ?', [nextActive, req.params.id]);

    res.json({ success: true, active: nextActive === 1 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete a WhatsApp target recipient
whatsappRouter.delete('/targets/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM whatsapp_targets WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Nomor tujuan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// =========================================================================
// 3. TESTING PIPELINE
// =========================================================================

// Send test message
whatsappRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const { sourceId, target, message } = req.body;
    
    let senderSessionId = sourceId;
    let targetPhone = target;

    // Fallback if target is not defined
    if (!targetPhone) {
      const [rows]: any = await db.query('SELECT phone_number FROM whatsapp_targets WHERE is_active = 1 LIMIT 1');
      targetPhone = rows[0]?.phone_number;
    }

    if (!targetPhone) {
      return res.status(400).json({ error: 'Nomor tujuan tidak dikonfigurasi / tidak ada penerima aktif.' });
    }

    // Fallback if sourceId is not defined (find first active connected session)
    if (!senderSessionId) {
      const [rows]: any = await db.query("SELECT session_id FROM whatsapp_sources WHERE is_active = 1 AND status = 'connected' LIMIT 1");
      senderSessionId = rows[0]?.session_id;
    }

    if (!senderSessionId) {
      return res.status(400).json({ error: 'Tidak ada sumber WhatsApp aktif yang terhubung.' });
    }

    const testMsg = message || 'Halo! Ini adalah pesan uji coba dari sistem Monitoring Jaringan ITATS Nexus.';

    const success = await sendWhatsAppMessageFromSession(senderSessionId, targetPhone, testMsg);

    if (success) {
      res.json({ success: true, message: 'Pesan uji coba terkirim.' });
    } else {
      res.status(500).json({ error: 'Gagal mengirim pesan uji coba. Pastikan sumber WhatsApp Anda terhubung.' });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
