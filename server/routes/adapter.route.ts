import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { DRIVER_META, SUPPORTED_DRIVERS, getAdapter } from '../adapters/adapter.registry';
import { getModelStatus, clearModelCache } from '../lib/ai_engine';

export const adapterRouter = Router();

/**
 * GET /api/adapters/drivers
 * Returns list of all supported drivers with metadata
 */
adapterRouter.get('/drivers', requireAuth, (req, res) => {
  const drivers = SUPPORTED_DRIVERS.map(id => ({
    id,
    ...DRIVER_META[id],
  }));
  res.json(drivers);
});

/**
 * GET /api/adapters/ai-status
 * Returns current AI model status and training info
 */
adapterRouter.get('/ai-status', requireAuth, (req, res) => {
  res.json(getModelStatus());
});

/**
 * POST /api/adapters/ai-reset
 * Clears the cached AI model, forcing a re-train on next prediction call
 */
adapterRouter.post('/ai-reset', requireAuth, (req, res) => {
  clearModelCache();
  res.json({ success: true, message: 'AI model cache cleared. Will re-train on next prediction call.' });
});

/**
 * PUT /api/adapters/device/:id/driver
 * Updates the driver for a specific device
 */
adapterRouter.put('/device/:id/driver', requireAuth, async (req, res) => {
  try {
    const { driver, snmp_community, snmp_port } = req.body;
    
    if (!SUPPORTED_DRIVERS.includes(driver)) {
      return res.status(400).json({ 
        error: `Unsupported driver: "${driver}". Valid options: ${SUPPORTED_DRIVERS.join(', ')}` 
      });
    }

    // Update device with new driver settings
    await db.query(
      'UPDATE mikrotik_devices SET driver = ?, snmp_community = ?, snmp_port = ? WHERE id = ?',
      [driver, snmp_community || 'public', snmp_port || 161, req.params.id]
    );

    res.json({ success: true, message: `Device driver updated to "${driver}"` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/adapters/device/:id/test
 * Tests the connectivity of a device using its configured adapter
 */
adapterRouter.post('/device/:id/test', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query('SELECT * FROM mikrotik_devices WHERE id = ?', [req.params.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const adapter = getAdapter(device);
    const stats = await adapter.getSystemStats(device);

    res.json({
      success: stats.online,
      driver: adapter.driverName,
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

/**
 * POST /api/adapters/device/:id/test-snmp
 * Specifically tests SNMP connectivity even if the current driver is MikroTik
 */
adapterRouter.post('/device/:id/test-snmp', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query('SELECT * FROM mikrotik_devices WHERE id = ?', [req.params.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Force usage of SNMP adapter for this check
    const { SnmpAdapter } = await import('../adapters/snmp.adapter');
    const adapter = new SnmpAdapter();
    const stats = await adapter.getSystemStats(device);

    res.json({
      success: stats.online,
      driver: 'snmp',
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/adapters/device/:id/interfaces
 * Fetches interfaces using the device's configured adapter (normalized)
 */
adapterRouter.get('/device/:id/interfaces', requireAuth, async (req, res) => {
  try {
    const [[device]]: any = await db.query('SELECT * FROM mikrotik_devices WHERE id = ?', [req.params.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const adapter = getAdapter(device);
    const interfaces = await adapter.getInterfaces(device);
    res.json(interfaces);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});
