import { INetworkAdapter } from './base.adapter';
import { MikrotikAdapter } from './mikrotik.adapter';
import { SnmpAdapter } from './snmp.adapter';

/**
 * Central adapter registry.
 * Returns the correct adapter implementation based on the device's driver field.
 */

const ADAPTERS: Record<string, INetworkAdapter> = {
  mikrotik: new MikrotikAdapter(),
  snmp: new SnmpAdapter(),
};

/**
 * Get the adapter for a given device.
 * Falls back to 'mikrotik' if the driver is not recognized.
 */
export function getAdapter(device: any): INetworkAdapter {
  const driver = (device.driver || 'mikrotik').toLowerCase();
  const adapter = ADAPTERS[driver];
  if (!adapter) {
    console.warn(`[AdapterRegistry] Unknown driver "${driver}" for device "${device.name}". Falling back to mikrotik.`);
    return ADAPTERS['mikrotik'];
  }
  return adapter;
}

export const SUPPORTED_DRIVERS = Object.keys(ADAPTERS);
export const DRIVER_META: Record<string, { label: string; description: string; color: string }> = {
  mikrotik: {
    label: 'MikroTik (RouterOS API)',
    description: 'Communicates via MikroTik RouterOS API on port 8728. Supports all RouterOS features.',
    color: '#e23b3b',
  },
  snmp: {
    label: 'SNMP (Universal)',
    description: 'Uses SNMP v2c to communicate with any compatible device. Supports Cisco, Ruijie, HP, TP-Link, Ubiquiti, etc.',
    color: '#3b82f6',
  },
};
