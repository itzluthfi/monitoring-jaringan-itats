/**
 * INTERFACE FOR EXTERNAL NETWORK CONTROLLERS
 * Used to normalize data from UniFi, Omada, and others into the Nexus Dashboard.
 */

export interface ExternalClient {
  mac: string;
  ip: string;
  hostname: string;
  signal: string;
  signalNum: number;
  experience: 'Excellent' | 'Good' | 'Poor';
  standard: string;
  txRate: string;
  rxRate: string;
  uptime: string;
  ap: string;
  interface: string;
  source: string; // The name of the controller
}

export interface ControllerStats {
  online: boolean;
  clientCount: number;
  error?: string;
  hint?: string;
}

export interface IControllerAdapter {
  type: string;
  testConnection(config: any): Promise<ControllerStats>;
  getClients(config: any): Promise<ExternalClient[]>;
}
