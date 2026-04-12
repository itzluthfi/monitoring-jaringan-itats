import { Router } from "express";
import { db } from "../db.js";

export const accessPointsRouter = Router();

// GET all APs (optionally filtered by mikrotik_id)
accessPointsRouter.get("/", async (req, res) => {
  try {
    const { mikrotik_id, status } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    let query = "SELECT a.*, m.name as mikrotik_name FROM mikrotik_aps a LEFT JOIN mikrotik_devices m ON a.mikrotik_id = m.id";
    let countQuery = "SELECT COUNT(*) as total FROM mikrotik_aps a";
    
    const params: any[] = [];
    const countParams: any[] = [];
    const whereClauses: string[] = [];

    if (mikrotik_id) {
      whereClauses.push("a.mikrotik_id = ?");
      params.push(mikrotik_id);
      countParams.push(mikrotik_id);
    }

    if (status) {
      whereClauses.push("a.status = ?");
      params.push(status);
      countParams.push(status);
    }

    if (whereClauses.length > 0) {
      const wherePart = " WHERE " + whereClauses.join(" AND ");
      query += wherePart;
      countQuery += wherePart;
    }

    query += " ORDER BY m.name, a.group_label, a.name";
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const [rows]: any = await db.query(query, params);
    const [[countResult]]: any = await db.query(countQuery, countParams);
    const total = countResult?.total || 0;

    res.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single AP
accessPointsRouter.get("/:id", async (req, res) => {
  try {
    const [[ap]]: any = await db.query("SELECT * FROM mikrotik_aps WHERE id = ?", [req.params.id]);
    if (!ap) return res.status(404).json({ error: "AP not found" });
    res.json(ap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE AP
accessPointsRouter.post("/", async (req, res) => {
  try {
    const { mikrotik_id, name, group_label, lat, lng, ip_address, mac_address, interface_name, mode } = req.body;
    if (!mikrotik_id || !name) {
      return res.status(400).json({ error: "mikrotik_id and name are required." });
    }
    
    const [result]: any = await db.query(
      "INSERT INTO mikrotik_aps (mikrotik_id, name, group_label, lat, lng, ip_address, mac_address, interface_name, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [mikrotik_id, name, group_label || null, lat || null, lng || null, ip_address || null, mac_address || null, interface_name || null, mode || 'ap']
    );
    res.status(201).json({ id: result.insertId, message: "AP created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE AP
accessPointsRouter.put("/:id", async (req, res) => {
  try {
    const { mikrotik_id, name, group_label, lat, lng, ip_address, mac_address, interface_name, mode } = req.body;
    await db.query(
      "UPDATE mikrotik_aps SET mikrotik_id = ?, name = ?, group_label = ?, lat = ?, lng = ?, ip_address = ?, mac_address = ?, interface_name = ?, mode = ? WHERE id = ?",
      [mikrotik_id, name, group_label || null, lat || null, lng || null, ip_address || null, mac_address || null, interface_name || null, mode || 'ap', req.params.id]
    );
    res.json({ message: "AP updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE AP
accessPointsRouter.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM mikrotik_aps WHERE id = ?", [req.params.id]);
    res.json({ message: "AP deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
