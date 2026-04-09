export interface WifiStat {
  id: number;
  timestamp: string;
  client_count: number;
  ap_name: string;
}

export interface Prediction {
  prediction: string;
  rawanHours: Array<{ hour: string; expectedDensity: string }>;
}

export interface Room {
  id: string;
  name: string;
  cap: number;
  current: number;
  status: 'online' | 'offline';
  latency: number;
  noWifi?: boolean;
}

export interface Floor {
  level: number | string;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hasWifi?: boolean;
  floors: Floor[];
}

export interface MikroTikDevice {
  id: number;
  name: string;
  host: string;
  user: string;
  port: number;
  status: string;
  last_seen: string | null;
  is_primary: number;
}

export interface DeviceStatus {
  online: boolean;
  identity?: string;
  uptime?: string;
  version?: string;
  cpuLoad?: string;
  freeMemory?: string;
  error?: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: 'cloud' | 'router' | 'switch' | 'ap';
  status: 'online' | 'offline';
  children?: TopologyNode[];
}

export interface TrafficRates {
  [ifaceName: string]: { txSpeed: number; rxSpeed: number; txPacketPs: number; rxPacketPs: number };
}

export interface Notification {
  id: number; // In DB it's integer
  device_id?: number;
  device_name?: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  action_url?: string;
  entity_type?: 'mikrotik' | 'ap';
  is_read: number;
  created_at: string;
}
