import { IControllerAdapter, ExternalClient, ControllerStats } from './controller.base';

/**
 * ADAPTER FOR UBIQUITI UNIFI CONTROLLER
 * Supports local controllers (Self-hosted or Cloud Key).
 */
export class UnifiControllerAdapter implements IControllerAdapter {
  type = 'unifi';

  private async fetchWithAuth(config: any, path: string, method: string = 'GET', body?: any) {
    const { host, user, password, extra_config } = config;
    const site = extra_config?.site || 'default';
    
    // Normalize host (ensure https and no trailing slash)
    let baseUrl = host.startsWith('http') ? host : `https://${host}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // 1. Login to get session
    // NOTE: We are using a temporary cookie approach for each request since we don't have persistent sessions yet.
    // In production, you'd want to cache the session cookie.
    try {
      const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password }),
        // @ts-ignore - Ignore self-signed certificates (common in local UniFi controllers)
        dispatcher: new (await import('undici')).Agent({ connect: { rejectUnauthorized: false } })
      });

      if (!loginRes.ok) throw new Error(`unifi_login_failed: ${loginRes.statusText}`);
      
      const cookie = loginRes.headers.get('set-cookie');
      if (!cookie) throw new Error('unifi_no_cookie_returned');

      // 2. Request the actual data
      const dataRes = await fetch(`${baseUrl}/api/s/${site}${path}`, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: body ? JSON.stringify(body) : undefined,
        // @ts-ignore
        dispatcher: new (await import('undici')).Agent({ connect: { rejectUnauthorized: false } })
      });

      if (!dataRes.ok) throw new Error(`unifi_data_failed: ${dataRes.statusText}`);
      return await dataRes.json();
    } catch (e: any) {
      console.error(`[Unifi-Adapter] Error for ${host}:`, e.message);
      throw e;
    }
  }

  async testConnection(config: any): Promise<ControllerStats> {
    try {
      const result = await this.fetchWithAuth(config, '/stat/sysinfo');
      return {
        online: true,
        clientCount: 0, // Sysinfo doesn't easily give total clients without more parsing
      };
    } catch (e: any) {
      let hint = "Pastikan URL benar dan Port API terbuka (biasanya 8443 atau 443).";
      if (e.message.includes('login_failed')) hint = "Username atau Password UniFi salah.";
      if (e.message.includes('ETIMEDOUT')) hint = "Koneksi Timeout. Cek apakah IP UniFi Controller bisa diping.";
      
      return {
        online: false,
        clientCount: 0,
        error: e.message,
        hint
      };
    }
  }

  async getClients(config: any): Promise<ExternalClient[]> {
    try {
      const result = await this.fetchWithAuth(config, '/stat/sta');
      const rawClients = result.data || [];

      return rawClients.map((c: any) => {
        const signalNum = c.rssi || -100;
        let experience: 'Excellent' | 'Good' | 'Poor' = 'Good';
        if (signalNum >= -60) experience = 'Excellent';
        else if (signalNum < -80) experience = 'Poor';

        return {
          mac: c.mac,
          ip: c.ip || '-',
          hostname: c.hostname || c.name || '-',
          signal: `${signalNum} dBm`,
          signalNum,
          experience,
          standard: c.radio_proto || '-',
          txRate: c.tx_rate ? `${(c.tx_rate / 1000).toFixed(1)} Mbps` : '-',
          rxRate: c.rx_rate ? `${(c.rx_rate / 1000).toFixed(1)} Mbps` : '-',
          uptime: this.formatUptime(c.uptime),
          ap: c.ap_name || 'UniFi AP',
          interface: c.essid || 'WiFi',
          source: config.name
        };
      });
    } catch (e) {
      return [];
    }
  }

  private formatUptime(seconds: number): string {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
}
