import { 
  Activity, 
  MapPin, 
  Network, 
  Server, 
  Settings, 
  Bell,
  Router as RouterIcon
} from 'lucide-react';
import React from 'react';

export type ViewType = 'dashboard' | 'map' | 'topology' | 'vlan' | 'devices' | 'aps' | 'logs' | 'settings' | 'notifications';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
}

export const NAVIGATION: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'map', label: 'Campus Map', icon: MapPin },
  { id: 'topology', label: 'Network Topology', icon: Server },
  { id: 'vlan', label: 'Traffic Monitoring', icon: Network },
  { id: 'devices', label: 'MikroTik Devices', icon: RouterIcon },
  { id: 'aps', label: 'Access Points', icon: Network },
  { id: 'logs', label: 'System Logs', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];
