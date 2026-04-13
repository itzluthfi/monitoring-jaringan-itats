import { IControllerAdapter } from './controller.base';
import { UnifiControllerAdapter } from './unifi.controller';

/**
 * Registry and factory for network controllers.
 */

const ADAPTERS: Record<string, IControllerAdapter> = {
  unifi: new UnifiControllerAdapter(),
  // omada: new OmadaControllerAdapter(), // To be implemented
  // ruijie: new RuijieControllerAdapter(), // To be implemented
};

export function getControllerAdapter(type: string): IControllerAdapter | null {
  return ADAPTERS[type.toLowerCase()] || null;
}

export const SUPPORTED_CONTROLLERS = Object.keys(ADAPTERS);

export const CONTROLLER_META: Record<string, { label: string, description: string, hint: string }> = {
  unifi: {
    label: 'Ubiquiti UniFi (Local/CloudKey)',
    description: 'Connects to a self-hosted UniFi Controller or Cloud Key via API.',
    hint: 'Buka Settings > System > Advanced > Enable Local API di UniFi Anda.'
  },
  omada: {
    label: 'TP-Link Omada (Software/HW)',
    description: 'Connects to Omada Software/Hardware Controller.',
    hint: 'Pastikan User memiliki hak akses API dan Controller Port 8043/443 terbuka.'
  },
  ruijie: {
    label: 'Ruijie Cloud / Reyee',
    description: 'Connects to Ruijie Cloud or local devices via API/SNMP.',
    hint: 'Dapatkan API Key di Ruijie Cloud Developer Center.'
  }
};
