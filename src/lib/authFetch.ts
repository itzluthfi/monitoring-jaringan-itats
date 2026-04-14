/**
 * authFetch — wrapper fetch terpusat dengan penanganan autentikasi ketat.
 *
 * Handles:
 *  - Inject token Authorization header otomatis
 *  - 401 Unauthorized → paksa logout + redirect login dengan reason
 *  - 403 Forbidden    → redirect ke halaman /403
 *  - Timeout 15s      → lempar AbortError jika server tidak merespons
 *  - Network error    → lempar error yang informatif
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export class AuthFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthFetchError';
    this.status = status;
  }
}

function clearAuthAndRedirect(reason = 'session_expired') {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.removeItem('last_seen_notification_id');
  const loginUrl = `/login?reason=${reason}`;
  // Hanya redirect jika belum di halaman login/public agar tidak ada infinite loop
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/public') && window.location.pathname !== '/') {
    window.location.href = loginUrl;
  }
}

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Timeout guard — batalkan fetch jika melebihi 15 detik
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new AuthFetchError(`Request timeout: ${url} tidak merespons setelah ${DEFAULT_TIMEOUT_MS / 1000}s.`, 408);
    }
    throw new AuthFetchError(`Network error: Tidak dapat terhubung ke server. (${err?.message || 'unknown'})`, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  // ── HTTP Error Handling ────────────────────────────────────────────────────

  // 401 → Token tidak valid / expired → logout paksa
  if (response.status === 401) {
    clearAuthAndRedirect('unauthorized');
    throw new AuthFetchError('Session tidak valid. Silakan login kembali.', 401);
  }

  // 403 → Tidak punya izin ke resource ini
  if (response.status === 403) {
    // Lempar error supaya komponen bisa handle sendiri jika diperlukan
    throw new AuthFetchError('Akses ditolak. Anda tidak memiliki izin untuk sumber daya ini.', 403);
  }

  // 500-599 → Server error, jangan crash halaman — cukup lempar supaya bisa di-catch di komponen
  if (response.status >= 500) {
    throw new AuthFetchError(`Server error (${response.status}): Terjadi kesalahan internal pada server.`, response.status);
  }

  return response;
};

