/**
 * Base adapter interface.
 * Every device driver MUST implement this contract so the system
 * can talk to MikroTik, SNMP devices, Ruijie, etc. in the same way.
 */
export interface NormalizedInterfaceStat {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  rxRate: number;   // bits per second
  txRate: number;   // bits per second
  rxBytes: number;
  txBytes: number;
  mtu?: number;
  macAddress?: string;
  parent?: string | null;
}

export interface NormalizedSystemStat {
  online: boolean;
  identity?: string;
  uptime?: string;
  version?: string;
  cpuLoad?: number;
  freeMemory?: number;
  totalMemory?: number;
  error?: string;
}

export interface NormalizedClientCount {
  count: number;
  clients: { mac: string; ip?: string; hostname?: string }[];
}

/**
 * Abstract contract for all device adapters.
 */
export interface INetworkAdapter {
  /** Unique driver identifier, e.g. "mikrotik", "snmp", "ruijie" */
  readonly driverName: string;

  /** Fetch all interfaces with live rate data */
  getInterfaces(device: any): Promise<NormalizedInterfaceStat[]>;

  /** Fetch system health metrics (CPU, RAM, uptime) */
  getSystemStats(device: any): Promise<NormalizedSystemStat>;

  /** Fetch connected client count from ARP/DHCP */
  getClientCount(device: any): Promise<NormalizedClientCount>;
}
