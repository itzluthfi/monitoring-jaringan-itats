import { Request, Response, NextFunction } from 'express';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory Rate Limiter untuk endpoint publik (/api/public/*)
//
// Melindungi dari:
//  - Scraping / enumeration
//  - Flooding request (DoS ringan)
//  - Abuse API oleh pihak yang tidak bertanggung jawab
// ──────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Map: IP address -> { count, windowStart }
const requestCounts = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000;   // 1 menit
const MAX_REQUESTS = 20;        // Max 20 request per menit per IP

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      requestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ── In-memory Response Cache ─────────────────────────────────────────────────
// Cache hasil campus-map per 30 detik agar MikroTik tidak dibombardir
// saat banyak pengguna membuka halaman secara bersamaan.

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();

export const getCachedResponse = (key: string): any | null => {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
};

export const setCachedResponse = (key: string, data: any, ttlMs = 30_000): void => {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
};

// ── Middleware ────────────────────────────────────────────────────────────────

export const publicSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 1. Security Headers (lightweight Helmet)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Cache public responses for 30s on CDN/browser
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=10');

  // 2. Rate Limiting
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const existing = requestCounts.get(ip);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    // New window
    requestCounts.set(ip, { count: 1, windowStart: now });
  } else {
    existing.count += 1;

    if (existing.count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((WINDOW_MS - (now - existing.windowStart)) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
        retryAfterSeconds: retryAfterSec,
      });
    }
  }

  next();
};
