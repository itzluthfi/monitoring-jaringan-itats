import {
  Activity,
  MapPin,
  Network,
  Server,
  Settings,
  Bell,
  Router as RouterIcon,
  Brain,
  Users,
  MessageSquare
} from 'lucide-react';

import React from 'react';
import { useTranslation } from 'react-i18next';

export type ViewType = 'dashboard' | 'map' | 'topology' | 'vlan' | 'devices' | 'aps' | 'logs' | 'settings' | 'notifications' | 'smart-central' | 'clients' | 'controllers' | 'tickets';

export interface NavItem {
  id: ViewType;
  labelKey: string; // Translation key
  icon: React.ElementType;
}

// Hook to get translated navigation
export const useTranslatedNav = () => {
  const { t } = useTranslation();

  const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: Activity },
    { id: 'map', labelKey: 'nav.campusMap', icon: MapPin },
    { id: 'topology', labelKey: 'nav.networkTopology', icon: Server },
    { id: 'vlan', labelKey: 'nav.trafficMonitoring', icon: Network },
    { id: 'devices', labelKey: 'nav.mikrotikDevices', icon: RouterIcon },
    { id: 'aps', labelKey: 'nav.accessPoints', icon: Network },
    { id: 'clients', labelKey: 'nav.clients', icon: Users },
    { id: 'controllers', labelKey: 'nav.controllers', icon: Network },
    { id: 'logs', labelKey: 'nav.systemLogs', icon: Activity },
    { id: 'tickets', labelKey: 'nav.tickets', icon: MessageSquare },
    { id: 'notifications', labelKey: 'nav.notifications', icon: Bell },
    { id: 'smart-central', labelKey: 'nav.smartCentral', icon: Brain },
    { id: 'settings', labelKey: 'nav.settings', icon: Settings },
  ];

  return { NAV_ITEMS, t };
};

// Default export for backwards compatibility
export const NAVIGATION: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: Activity },
  { id: 'map', labelKey: 'nav.campusMap', icon: MapPin },
  { id: 'topology', labelKey: 'nav.networkTopology', icon: Server },
  { id: 'vlan', labelKey: 'nav.trafficMonitoring', icon: Network },
  { id: 'devices', labelKey: 'nav.mikrotikDevices', icon: RouterIcon },
  { id: 'aps', labelKey: 'nav.accessPoints', icon: Network },
  { id: 'clients', labelKey: 'nav.clients', icon: Users },
  { id: 'controllers', labelKey: 'nav.controllers', icon: Network },
  { id: 'logs', labelKey: 'nav.systemLogs', icon: Activity },
  { id: 'tickets', labelKey: 'nav.tickets', icon: MessageSquare },
  { id: 'notifications', labelKey: 'nav.notifications', icon: Bell },
  { id: 'smart-central', labelKey: 'nav.smartCentral', icon: Brain },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
];
