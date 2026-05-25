import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

export const ticketsRouter = Router();

// Ensure public/uploads exists
const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  }
});

// ── Public Routes ────────────────────────────────────────────────────────────

// Create Ticket
ticketsRouter.post("/", upload.single("photo"), async (req, res) => {
  try {
    const { reporter_id, reporter_name, category, title, description, is_public } = req.body;
    const reporter_email = req.body.reporter_email || "";
    if (!reporter_id || !reporter_name || !category || !title || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Generate unique code TCK-XXXXX
    let ticket_code = "";
    let codeExists = true;
    while (codeExists) {
      const randNum = Math.floor(100000 + Math.random() * 900000);
      ticket_code = `TCK-${randNum}`;
      const [existing]: any = await db.query("SELECT id FROM tickets WHERE ticket_code = ?", [ticket_code]);
      if (existing.length === 0) {
        codeExists = false;
      }
    }

    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const isPublicVal = (is_public === "false" || is_public === 0 || is_public === "0" || is_public === false) ? 0 : 1;

    const [result]: any = await db.query(
      "INSERT INTO tickets (ticket_code, reporter_id, reporter_name, reporter_email, category, title, description, photo_url, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [ticket_code, reporter_id, reporter_name, reporter_email, category, title, description, photo_url, isPublicVal]
    );

    res.status(201).json({
      success: true,
      message: "Ticket submitted successfully",
      ticket_code,
      id: result.insertId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Public Tickets for Known Issues
ticketsRouter.get("/public", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      "SELECT id, ticket_code, category, title, status, created_at FROM tickets WHERE is_public = 1 ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Ticket Detail + Chat History
ticketsRouter.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const [tickets]: any = await db.query("SELECT * FROM tickets WHERE ticket_code = ?", [code]);
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = tickets[0];

    const [replies]: any = await db.query(
      "SELECT id, sender_type, sender_name, message, photo_url, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC",
      [ticket.id]
    );

    res.json({
      ticket,
      replies
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post Reply from User
ticketsRouter.post("/:code/replies", upload.single("photo"), async (req, res) => {
  try {
    const { code } = req.params;
    const { message } = req.body;
    if (!message && !req.file) {
      return res.status(400).json({ error: "Message or photo is required" });
    }

    const [tickets]: any = await db.query("SELECT id, reporter_name FROM tickets WHERE ticket_code = ?", [code]);
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = tickets[0];
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    await db.query(
      "INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, message, photo_url) VALUES (?, 'user', ?, ?, ?)",
      [ticket.id, ticket.reporter_name, message || "", photo_url]
    );

    // Mark ticket as unread/updated for admin
    await db.query("UPDATE tickets SET is_read = 0 WHERE id = ?", [ticket.id]);

    res.status(201).json({ success: true, message: "Reply added successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Routes ─────────────────────────────────────────────────────────────

// Get Count of Unread Tickets for Admin (Protected)
ticketsRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  try {
    const [[result]]: any = await db.query("SELECT COUNT(*) as unread FROM tickets WHERE is_read = 0");
    res.json({ unreadCount: result?.unread || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark Ticket as Read (Protected)
ticketsRouter.put("/admin/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE tickets SET is_read = 1 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Tickets for Admin (Protected)
ticketsRouter.get("/admin/list", requireAuth, async (req, res) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM tickets ORDER BY created_at DESC");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Status & Visibility (Protected)
ticketsRouter.put("/admin/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, is_public } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (status !== undefined) {
      if (!["open", "processing", "resolved", "closed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      updates.push("status = ?");
      values.push(status);
    }
    
    if (is_public !== undefined) {
      const isPublicVal = (is_public === "false" || is_public === 0 || is_public === "0" || is_public === false) ? 0 : 1;
      updates.push("is_public = ?");
      values.push(isPublicVal);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    values.push(id);
    const [result]: any = await db.query(
      `UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ success: true, message: "Ticket updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post Reply from Admin (Protected)
ticketsRouter.post("/admin/:id/replies", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message && !req.file) {
      return res.status(400).json({ error: "Message or photo is required" });
    }

    const [tickets]: any = await db.query("SELECT id FROM tickets WHERE id = ?", [id]);
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const adminUsername = (req as any).user?.username || "System Admin";
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    await db.query(
      "INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, message, photo_url) VALUES (?, 'admin', ?, ?, ?)",
      [id, adminUsername, message || "", photo_url]
    );

    res.status(201).json({ success: true, message: "Reply added successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
