import snmp from 'net-snmp';
import { INetworkAdapter, NormalizedInterfaceStat, NormalizedSystemStat, NormalizedClientCount } from './base.adapter';

/**
 * SNMP Adapter — works with any SNMP-capable device:
 * Cisco, Ruijie, HP, TP-Link, Ubiquiti, etc.
 *
 * Required device fields: host, snmp_community (default 'public'), snmp_port (default 161)
 *
 * FIX #1 — SNMP Rate Calculation:
 * SNMP hanya bisa baca total bytes (counter), bukan rate langsung.
 * Rate dihitung dari selisih bytes antar polling dibagi waktu (delta bytes / delta time).
 * Cache ini disimpan di memory server per device ID.
 */

// ─── Per-device in-memory rate cache ────────────────────────────────────────
interface IfaceByteSnapshot {
  rxBytes: number;
  txBytes: number;
  timestamp: number; // Unix ms
}
// Map: "deviceHost_ifIndex" → snapshot terakhir
const rateCache = new Map<string, IfaceByteSnapshot>();

function getRateKey(deviceHost: string, ifIndex: string): string {
  return `${deviceHost}_${ifIndex}`;
}

/**
 * Hitung rate dari selisih bytes.
 * Jika ini polling pertama (belum ada snapshot), return 0 dan simpan snapshot.
 */
function calculateRate(
  deviceHost: string,
  ifIndex: string,
  currentRxBytes: number,
  currentTxBytes: number
): { rxRate: number; txRate: number } {
  const key = getRateKey(deviceHost, ifIndex);
  const now = Date.now();
  const prev = rateCache.get(key);

  // Simpan snapshot saat ini untuk polling berikutnya
  rateCache.set(key, { rxBytes: currentRxBytes, txBytes: currentTxBytes, timestamp: now });

  if (!prev) {
    // Polling pertama — belum ada data sebelumnya, return 0
    return { rxRate: 0, txRate: 0 };
  }

  const elapsedSec = Math.max(0.5, (now - prev.timestamp) / 1000); // minimal 0.5s

  // Handle counter wrap-around (SNMP counter 32-bit bisa overflow di ~4GB)
  const MAX_COUNTER_32 = 4294967296; // 2^32
  let deltaTxBytes = currentTxBytes - prev.txBytes;
  let deltaRxBytes = currentRxBytes - prev.rxBytes;

  // Jika negatif, berarti counter sudah wrap
  if (deltaTxBytes < 0) deltaTxBytes += MAX_COUNTER_32;
  if (deltaRxBytes < 0) deltaRxBytes += MAX_COUNTER_32;

  // Sanity check: jika delta terlalu besar (mungkin device restart), return 0
  const MAX_REASONABLE_BYTES = 1e10; // 10 GB dalam satu interval = tidak masuk akal
  if (deltaTxBytes > MAX_REASONABLE_BYTES || deltaRxBytes > MAX_REASONABLE_BYTES) {
    return { rxRate: 0, txRate: 0 };
  }

  return {
    rxRate: Math.round((deltaRxBytes * 8) / elapsedSec), // bps
    txRate: Math.round((deltaTxBytes * 8) / elapsedSec), // bps
  };
}

/** Bersihkan cache lama (> 10 menit tidak diupdate) agar tidak memory leak */
function pruneRateCache(): void {
  const STALE_MS = 10 * 60 * 1000;
  const now = Date.now();
  for (const [key, snap] of rateCache.entries()) {
    if (now - snap.timestamp > STALE_MS) rateCache.delete(key);
  }
}

// Auto-cleanup setiap 15 menit
setInterval(pruneRateCache, 15 * 60 * 1000);

// ─── SNMP Adapter Class ─────────────────────────────────────────────────────
export class SnmpAdapter implements INetworkAdapter {
  readonly driverName = 'snmp';

  // Standard IF-MIB OIDs
  private OIDs = {
    // Interface table (IF-MIB)
    ifDescr:       '1.3.6.1.2.1.2.2.1.2',   // Interface name/description
    ifType:        '1.3.6.1.2.1.2.2.1.3',   // Interface type (ethernetCsmacd=6, softwareLoopback=24, etc)
    ifMtu:         '1.3.6.1.2.1.2.2.1.4',   // MTU
    ifSpeed:       '1.3.6.1.2.1.2.2.1.5',   // Speed in bps
    ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',   // MAC address
    ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',   // 1=up, 2=down, 3=testing
    ifOperStatus:  '1.3.6.1.2.1.2.2.1.8',   // 1=up, 2=down
    ifInOctets:    '1.3.6.1.2.1.2.2.1.10',  // Total bytes received (32-bit counter)
    ifOutOctets:   '1.3.6.1.2.1.2.2.1.16',  // Total bytes sent (32-bit counter)
    ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',  // Unicast packets in
    ifOutUcastPkts:'1.3.6.1.2.1.2.2.1.17',  // Unicast packets out
    // 64-bit counters (IF-MIB ifXTable) — more accurate for high-speed links
    ifHCInOctets:  '1.3.6.1.2.1.31.1.1.1.6',  // High-capacity in bytes (64-bit)
    ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10', // High-capacity out bytes (64-bit)
    ifAlias:       '1.3.6.1.2.1.31.1.1.1.18',  // Interface alias (human-readable name)
    // System OIDs
    sysDescr:  '1.3.6.1.2.1.1.1.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysName:   '1.3.6.1.2.1.1.5.0',
    // ARP cache
    atPhysAddress: '1.3.6.1.2.1.4.22.1.2',
  };

  /** Map SNMP ifType integer → human-readable type string */
  private ifTypeToString(typeVal: number): string {
    const TYPE_MAP: Record<number, string> = {
      6:  'ether',       // ethernetCsmacd
      24: 'loopback',    // softwareLoopback
      53: 'vlan',        // propVirtual (often used for VLANs)
      131:'tunnel',      // tunnel
      161:'ieee8023adLag', // LAG/LACP
      166:'mpls',
    };
    return TYPE_MAP[typeVal] || 'ether'; // default ke ether jika tidak dikenal
  }

  private createSession(device: any): any {
    return snmp.createSession(device.host, device.snmp_community || 'public', {
      port: device.snmp_port || 161,
      timeout: 5000,
      retries: 1,
      version: snmp.Version2c,
    });
  }

  private async snmpGet(session: any, oids: string[]): Promise<Record<string, any>> {
    return new Promise((resolve) => {
      session.get(oids, (error: any, varbinds: any[]) => {
        if (error) { resolve({}); return; }
        const result: Record<string, any> = {};
        varbinds.forEach((vb: any) => {
          if (!snmp.isVarbindError(vb)) result[vb.oid] = vb.value;
        });
        resolve(result);
      });
    });
  }

  private async snmpSubtree(session: any, oid: string): Promise<{ oid: string; value: any }[]> {
    return new Promise((resolve) => {
      const results: { oid: string; value: any }[] = [];
      session.subtree(oid, 50, (varbinds: any[]) => {
        varbinds.forEach((vb: any) => {
          if (!snmp.isVarbindError(vb)) results.push({ oid: vb.oid, value: vb.value });
        });
      }, (_error: any) => {
        resolve(results); // resolve regardless (subtree done)
      });
    });
  }

  /**
   * Fetch interface list dengan rate yang dihitung dari delta bytes.
   * Coba 64-bit HC counters dulu, fallback ke 32-bit jika tidak tersedia.
   */
  async getInterfaces(device: any): Promise<NormalizedInterfaceStat[]> {
    const session = this.createSession(device);
    try {
      // Ambil semua subtree sekaligus untuk efisiensi
      const [
        descrRows, typeRows, mtuRows,
        adminStatusRows, operStatusRows,
        inOctetsRows, outOctetsRows,
        inPktRows, outPktRows,
        hcInRows, hcOutRows,
        aliasRows,
      ] = await Promise.all([
        this.snmpSubtree(session, this.OIDs.ifDescr),
        this.snmpSubtree(session, this.OIDs.ifType),
        this.snmpSubtree(session, this.OIDs.ifMtu),
        this.snmpSubtree(session, this.OIDs.ifAdminStatus),
        this.snmpSubtree(session, this.OIDs.ifOperStatus),
        this.snmpSubtree(session, this.OIDs.ifInOctets),
        this.snmpSubtree(session, this.OIDs.ifOutOctets),
        this.snmpSubtree(session, this.OIDs.ifInUcastPkts),
        this.snmpSubtree(session, this.OIDs.ifOutUcastPkts),
        // 64-bit counters (might be empty on older devices)
        this.snmpSubtree(session, this.OIDs.ifHCInOctets).catch(() => []),
        this.snmpSubtree(session, this.OIDs.ifHCOutOctets).catch(() => []),
        this.snmpSubtree(session, this.OIDs.ifAlias).catch(() => []),
      ]);

      session.close();

      // Build per-index maps
      const build = (rows: { oid: string; value: any }[]): Record<string, any> => {
        const m: Record<string, any> = {};
        rows.forEach(({ oid, value }) => {
          const idx = oid.split('.').pop() || '';
          m[idx] = value;
        });
        return m;
      };

      const descrMap      = build(descrRows);
      const typeMap       = build(typeRows);
      const mtuMap        = build(mtuRows);
      const adminMap      = build(adminStatusRows);
      const operMap       = build(operStatusRows);
      const inOctMap      = build(inOctetsRows);
      const outOctMap     = build(outOctetsRows);
      const inPktMap      = build(inPktRows);
      const outPktMap     = build(outPktRows);
      const hcInMap       = build(hcInRows);
      const hcOutMap      = build(hcOutRows);
      const aliasMap      = build(aliasRows);

      const indices = Object.keys(descrMap);
      if (indices.length === 0) return [];

      return indices.map(idx => {
        const name = descrMap[idx]?.toString() || `if-${idx}`;
        const alias = aliasMap[idx]?.toString() || '';
        const operStatus = Number(operMap[idx] || 2);
        const adminStatus = Number(adminMap[idx] || 2);
        const mtu = Number(mtuMap[idx] || 1500);
        const ifTypeVal = Number(typeMap[idx] || 6);
        const type = this.ifTypeToString(ifTypeVal);

        // Prefer 64-bit HC counters if available (more accurate for busy links)
        const rxBytes = Number(hcInMap[idx] ?? inOctMap[idx] ?? 0);
        const txBytes = Number(hcOutMap[idx] ?? outOctMap[idx] ?? 0);
        const rxPackets = Number(inPktMap[idx] || 0);
        const txPackets = Number(outPktMap[idx] || 0);

        // ── FIX #1: Calculate rate from byte delta ──
        const { rxRate, txRate } = calculateRate(device.host, idx, rxBytes, txBytes);

        const running  = operStatus === 1;
        const disabled = adminStatus !== 1;

        return {
          // ── Normalized adapter fields ──
          name,
          type,
          running,
          disabled,
          rxRate,
          txRate,
          rxBytes,
          txBytes,
          mtu,
          parent: null, // SNMP does not expose parent/child interface relationships
          // ── Frontend-compatible raw field names ──
          'rx-byte':   rxBytes,
          'tx-byte':   txBytes,
          'rx-rate':   rxRate,
          'tx-rate':   txRate,
          'rx-packet': rxPackets,
          'tx-packet': txPackets,
          'actual-mtu': mtu,
          // SNMP-specific extra info shown as tooltip in UI
          _snmp: true,
          _alias: alias,
          _ifIndex: idx,
          _operStatus: operStatus,
          _adminStatus: adminStatus,
          // fp-* not available via SNMP
          'fp-rx-byte': 0,
          'fp-tx-byte': 0,
        } as NormalizedInterfaceStat;
      });
    } catch (err) {
      session.close();
      throw err;
    }
  }

  async getSystemStats(device: any): Promise<NormalizedSystemStat> {
    const session = this.createSession(device);
    try {
      const result = await this.snmpGet(session, [
        this.OIDs.sysDescr,
        this.OIDs.sysUpTime,
        this.OIDs.sysName,
      ]);
      session.close();

      if (!result[this.OIDs.sysUpTime]) {
        return { online: false, error: 'SNMP tidak merespons (uptime OID tidak tersedia)' };
      }

      const upTimeTicks = Number(result[this.OIDs.sysUpTime] || 0);
      const upTimeSec   = Math.floor(upTimeTicks / 100);
      const h = Math.floor(upTimeSec / 3600);
      const m = Math.floor((upTimeSec % 3600) / 60);
      const s = upTimeSec % 60;
      const upTimeStr = `${h}h ${m}m ${s}s`;

      return {
        online: true,
        identity: result[this.OIDs.sysName]?.toString() || device.name,
        uptime: upTimeStr,
        version: (result[this.OIDs.sysDescr]?.toString() || '').substring(0, 120),
        cpuLoad: 0, // Butuh vendor-specific OID
        freeMemory: 0,
      };
    } catch (err: any) {
      session.close();
      return { online: false, error: err.message || String(err) };
    }
  }

  async getClientCount(device: any): Promise<NormalizedClientCount> {
    const session = this.createSession(device);
    try {
      const arpRows = await this.snmpSubtree(session, this.OIDs.atPhysAddress);
      session.close();

      if (!arpRows || arpRows.length === 0) {
        return { count: 0, clients: [] };
      }

      const clients = arpRows.map(({ oid, value }) => ({
        mac: Buffer.isBuffer(value)
          ? (value as Buffer).toString('hex').match(/.{2}/g)?.join(':') || ''
          : String(value),
        ip: oid.split('.').slice(-4).join('.'),
      }));
      return { count: clients.length, clients };
    } catch {
      session.close();
      return { count: 0, clients: [] };
    }
  }
}
