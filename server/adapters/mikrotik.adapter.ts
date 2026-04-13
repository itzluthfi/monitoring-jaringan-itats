import { RouterOSClient } from 'routeros-client';
import { INetworkAdapter, NormalizedInterfaceStat, NormalizedSystemStat, NormalizedClientCount } from './base.adapter';

/**
 * MikroTik RouterOS API Adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * VERSI UPGRADE: Adapter ini diperkaya dengan logika yang sama persis dengan
 * endpoint /:id/interfaces di mikrotiks.route.ts:
 *  - Menggunakan /interface/print dengan flag =stats= untuk byte counters akurat
 *  - Mengambil VLAN parent mapping via /interface/vlan/print
 *  - Mengambil real-time rates via /interface/monitor-traffic
 *
 * CATATAN: Endpoint lama di mikrotiks.route.ts TIDAK diubah. Adapter ini
 * dipakai oleh /api/adapters/device/:id/interfaces dan sebagai referensi
 * untuk pengembangan driver lain.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MikrotikAdapter implements INetworkAdapter {
  readonly driverName = 'mikrotik';

  private createClient(device: any): RouterOSClient {
    return new RouterOSClient({
      host: device.host,
      user: device.user,
      password: device.password,
      port: device.port || 8728,
    });
  }

  /**
   * Mengambil daftar interface dengan rate realtime.
   * Logika ini mereplikasi dan memperkaya apa yang dilakukan endpoint
   * /:id/interfaces di mikrotiks.route.ts (sumber asli tetap tidak diubah).
   */
  async getInterfaces(device: any): Promise<NormalizedInterfaceStat[]> {
    const client = this.createClient(device);
    try {
      const api = await client.connect();

      // ── Step 1: Ambil interface list + stats (=stats= memberikan byte counters yang lebih akurat) ──
      const [ifaceList, vlans, monitorResults] = await Promise.all([
        (api as any).rosApi.write(['/interface/print', '=stats=']).catch(() =>
          // Fallback tanpa =stats= jika RouterOS lama tidak mendukung
          (api as any).rosApi.write(['/interface/print']).catch(() => [])
        ),
        // ── Step 2: Ambil VLAN parent mapping (sama dengan logika route lama) ──
        (api as any).rosApi.write(['/interface/vlan/print']).catch(() => []),
        // ── Step 3: Real-time rates via monitor-traffic ──
        (api as any).rosApi.write([
          '/interface/monitor-traffic',
          '=interface=all',
          '=once=',
        ]).catch(() => []),
      ]);

      await client.close().catch(() => {});

      // Build VLAN parent map: nama interface → nama parent (sama dengan route lama)
      const vlanParents: Record<string, string> = {};
      if (Array.isArray(vlans)) {
        vlans.forEach((v: any) => {
          if (v.name && v.interface) vlanParents[v.name] = v.interface;
        });
      }

      // Build monitor-traffic rate map (sama dengan route lama)
      const monitorMap: Record<string, any> = {};
      if (Array.isArray(monitorResults)) {
        monitorResults.forEach((m: any) => {
          if (m.name) monitorMap[m.name] = m;
        });
      }

      if (!Array.isArray(ifaceList) || ifaceList.length === 0) {
        return [];
      }

      return ifaceList.map((iface: any) => {
        const m = monitorMap[iface.name] || {};

        // Rate priority: monitor-traffic (paling akurat) → fp-*-bits → fallback 0
        // Ini sama dengan logika di endpoint /:id/interfaces
        const rxRate = Number(
          m['rx-bits-per-second'] ||
          iface['rx-bits-per-second'] ||
          iface['rx-rate'] ||
          iface['fp-rx-bits-per-second'] || 0
        );
        const txRate = Number(
          m['tx-bits-per-second'] ||
          iface['tx-bits-per-second'] ||
          iface['tx-rate'] ||
          iface['fp-tx-bits-per-second'] || 0
        );

        return {
          // ── Normalized fields (standar adapter) ──
          name: iface.name,
          type: iface.type || 'ether',
          running: iface.running === 'true' || iface.running === true,
          disabled: iface.disabled === 'true' || iface.disabled === true,
          rxRate,
          txRate,
          rxBytes: Number(iface['rx-byte'] || 0),
          txBytes: Number(iface['tx-byte'] || 0),
          mtu: Number(iface['actual-mtu'] || iface.mtu || 1500),
          macAddress: iface['mac-address'] || undefined,
          // ── Semua field original diteruskan (backward compatible dengan frontend) ──
          ...iface,
          // ── Override field kritis dengan nilai yang sudah dihitung ──
          // (harus di-set setelah spread agar nilai yang benar yang dipakai)
          'rx-rate': rxRate,
          'tx-rate': txRate,
          parent: vlanParents[iface.name] || iface['master-interface'] || null,
        };
      });
    } catch (err) {
      await client.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Mengambil system stats via RouterOS API.
   * Menggunakan /system/resource + /system/identity.
   */
  async getSystemStats(device: any): Promise<NormalizedSystemStat> {
    const client = this.createClient(device);
    try {
      const api = await client.connect();

      const [resSys, identityArr] = await Promise.all([
        (api as any).rosApi.write(['/system/resource/print']).catch(() => [{}]),
        (api as any).rosApi.write(['/system/identity/print']).catch(() => [{}]),
      ]);

      await client.close().catch(() => {});

      const res = Array.isArray(resSys) ? resSys[0] || {} : {};
      const identity = Array.isArray(identityArr) ? identityArr[0] || {} : {};

      return {
        online: true,
        identity: identity?.name || device.name,
        uptime: res.uptime || '0s',
        version: res.version || 'Unknown',
        cpuLoad: Number(res['cpu-load'] || 0),
        freeMemory: Number(res['free-memory'] || 0),
        totalMemory: Number(res['total-memory'] || 0),
      };
    } catch (err: any) {
      await client.close().catch(() => {});
      return { online: false, error: err.message || String(err) };
    }
  }

  /**
   * Mengambil jumlah klien yang terhubung via ARP table.
   */
  async getClientCount(device: any): Promise<NormalizedClientCount> {
    const client = this.createClient(device);
    try {
      const api = await client.connect();
      const leases: any[] = await (api as any).rosApi.write(['/ip/arp/print']).catch(() => []);
      await client.close().catch(() => {});

      if (!Array.isArray(leases) || leases.length === 0) {
        return { count: 0, clients: [] };
      }

      return {
        count: leases.length,
        clients: leases.map((l: any) => ({
          mac: l['mac-address'] || '',
          ip: l.address || '',
          hostname: l['host-name'] || '',
        })),
      };
    } catch {
      await client.close().catch(() => {});
      return { count: 0, clients: [] };
    }
  }
}
