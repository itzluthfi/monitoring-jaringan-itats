import { Router } from 'express';
import { db } from '../db';
import { getControllerAdapter, CONTROLLER_META, SUPPORTED_CONTROLLERS } from '../adapters/controller_factory';

export const controllersRouter = Router();

/**
 * GET /api/controllers/types
 * Returns supported controller types and metadata
 */
controllersRouter.get('/types', (req, res) => {
  res.json(CONTROLLER_META);
});

/**
 * GET /api/controllers
 * Returns all configured network controllers
 */
controllersRouter.get('/', async (req, res) => {
  try {
    const [rows]: any = await db.query('SELECT id, name, type, host, user, status, last_error, last_sync FROM network_controllers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/controllers
 * Adds a new network controller
 */
controllersRouter.post('/', async (req, res) => {
  try {
    const { name, type, host, user, password, extra_config } = req.body;
    
    if (!name || !type || !host) {
      return res.status(400).json({ error: 'Name, Type, and Host are required.' });
    }

    const [result]: any = await db.query(
      'INSERT INTO network_controllers (name, type, host, user, password, extra_config) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, host, user, password, JSON.stringify(extra_config || {})]
    );

    res.json({ id: result.insertId, success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/controllers/:id/test
 * Tests the connection to an external controller
 */
controllersRouter.post('/:id/test', async (req, res) => {
  try {
    const [[config]]: any = await db.query('SELECT * FROM network_controllers WHERE id = ?', [req.params.id]);
    if (!config) return res.status(404).json({ error: 'Controller not found' });

    const adapter = getControllerAdapter(config.type);
    if (!adapter) return res.status(400).json({ error: `No adapter found for type: ${config.type}` });

    const result = await adapter.testConnection(config);
    
    // Update status in DB
    const status = result.online ? 'online' : 'error';
    await db.query(
      'UPDATE network_controllers SET status = ?, last_error = ?, last_sync = CURRENT_TIMESTAMP WHERE id = ?',
      [status, result.error || null, req.params.id]
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

/**
 * DELETE /api/controllers/:id
 */
controllersRouter.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM network_controllers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
