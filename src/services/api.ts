import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import { AUTH_UNAUTHORIZED_EVENT } from './authEvents';
import { getApiUrl } from '../config/runtime';

// Lazy-eval: getApiUrl() se poziva pri svakom request-u kroz interceptor,
// NE pri import-u modula. To dozvoljava window._env_ injection iz /config.js
// pre prvog API poziva (k8s ConfigMap deploy pattern). Bez ovog, FE bi se
// build-ovao sa hardcoded baseURL i isto image ne bi moglo da se reuse-uje
// kroz dev/staging/prod environment-e.
function getBaseUrl(): string {
  return getApiUrl();
}

// Re-export za backwards-compat (FE-SHR-01). AuthContext sada importuje
// direktno iz `./authEvents` da se izbegnu test brittleness-i sa api mockom.
export { AUTH_UNAUTHORIZED_EVENT };

function emitUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

const api = axios.create({
  // baseURL se postavlja u request interceptor preko getBaseUrl() —
  // ne hardcode-ujemo ga ovde da bi runtime config bio uziman pri svakom pozivu.
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: dodaj JWT token + svezi baseURL u svaki zahtev.
// baseURL injection ovde (a ne u axios.create) je kljucan za k8s deploy —
// dozvoljava promenu API endpoint-a preko window._env_ bez restart-a.
api.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseUrl();
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// FE-SHR-02: deduplikuj paralelne refresh pozive. Bez ovoga, 5 paralelnih 401
// pucanja pokrene 5 zahteva ka /auth/refresh; samo prvi uspeva (refresh tokens
// su one-shot), ostalih 4 dobijaju 401 → user izbacen iz aplikacije iako je
// jedan refresh prosao.
let refreshPromise: Promise<string> | null = null;

async function doActualRefresh(): Promise<string> {
  const refreshToken = sessionStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post(`${getBaseUrl()}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data;
  sessionStorage.setItem('accessToken', accessToken);
  if (newRefreshToken) {
    sessionStorage.setItem('refreshToken', newRefreshToken);
  }
  return accessToken;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doActualRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// R3-1625: razlikuj GENUINSKI nevalidan token (refresh endpoint vratio 4xx —
// token istekao/opozvan → korisnik MORA na login) od TRANSIENT greske (timeout,
// network down, 5xx na refresh endpoint-u, ili lokalni "No refresh token" pre
// nego sto sesija uopste postoji). Na transient gresku NE brisemo sesiju i NE
// izbacujemo korisnika — originalni 401 se vraca caller-u koji moze da retry-uje
// ili prikaze gresku, a token ostaje za sledeci pokusaj. Ranije je bilo kakav
// refresh-fail (uklj. timeout/500) gasio sesiju → korisnik izbacen na tranzientu.
function isInvalidTokenError(error: unknown): boolean {
  // Lokalni "nema refresh token-a" => sesija ne postoji => tretiraj kao
  // unauthorized (ne mozemo da osvezimo).
  if (error instanceof Error && error.message === 'No refresh token available') {
    return true;
  }
  const status =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as AxiosError).response?.status
      : undefined;
  if (status === undefined) {
    // Nema HTTP odgovora (timeout/network/abort) => transient, ne gasi sesiju.
    return false;
  }
  // 4xx na refresh endpoint-u => token nevalidan; 5xx => server-side transient.
  return status >= 400 && status < 500;
}

/** Centralizuje "izbaci korisnika" odluku: gasi sesiju + emit SAMO ako je token
 *  zaista nevalidan (4xx / nepostojeci). Na transient gresku ne radi nista. */
function handleRefreshFailure(error: unknown): void {
  if (isInvalidTokenError(error)) {
    sessionStorage.clear();
    emitUnauthorized();
  }
}

// Internal flag tip — `_retry` se setuje na originalRequest da spreci infinitu
// petlju ako refresh prodje ali zahtev jos uvek vraca 401.
type RetryableRequest = AxiosRequestConfig & { _retry?: boolean };

// Response interceptor: auto-refresh token na 401 + emit unauthorized event ako refresh padne
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const isAuthEndpoint =
      typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/');

    // Ne diraj 401 sa /auth/* endpoint-a (login/refresh) — prosledi dalje da UI obradi gresku
    if (error.response?.status !== 401 || isAuthEndpoint || !originalRequest) {
      return Promise.reject(error);
    }

    // P0-F1/N3 fix (defense-in-depth): NE auto-retry-uj mutacione metode
    // (POST/PATCH/PUT/DELETE) na 401. Money-POST (payments/transfers/orders) NE sme
    // da se nekontrolisano re-posalje ako token istekne usred zahteva — to bi pri
    // odredjenom (sad zatvorenom) BE timing-u moglo da napravi duplu transakciju.
    // Samo idempotentne metode (GET/HEAD) se refresh-uju i retry-uju; za mutacije
    // refresh-ujemo token (da sledeci poziv prodje) ali zahtev NE re-saljemo —
    // korisnik svesno ponavlja akciju. OTP single-use (B7) je primarna zastita;
    // ovo je dodatni sloj.
    const method = (originalRequest.method ?? 'get').toUpperCase();
    const isIdempotent = method === 'GET' || method === 'HEAD';
    if (!isIdempotent) {
      try {
        // Osvezi token tako da sledeci (rucni) pokusaj korisnika prodje, ali NE
        // re-saljemo ovaj mutacioni zahtev automatski.
        await refreshAccessToken();
      } catch (refreshError) {
        handleRefreshFailure(refreshError);
      }
      return Promise.reject(error);
    }

    // Ako smo vec pokusali retry, refresh je propao — emit unauthorized event
    if (originalRequest._retry) {
      sessionStorage.clear();
      emitUnauthorized();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      handleRefreshFailure(refreshError);
      return Promise.reject(refreshError);
    }
  }
);

export default api;
