import api from './api';
import type {
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ActivateAccountRequest,
} from '../types';

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  /**
   * POST /auth/logout — server-side blacklist trenutnog JWT-a (Caffeine cache,
   * 20min TTL = max preostalo trajanje access tokena).
   *
   * Best-effort: ako BE nije reachable (network error / 5xx), klijentska
   * sesija se i dalje cisti. Server-side blacklist je defense-in-depth, ne
   * apsolutni autoritet — JWT i dalje istice za 15 minuta po default-u.
   */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<void> => {
    await api.post('/auth/password_reset/request', data);
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
    await api.post('/auth/password_reset/confirm', data);
  },

  activateAccount: async (data: ActivateAccountRequest): Promise<void> => {
    await api.post('/auth-employee/activate', data);
  },

  /**
   * Spec Sc 9 + ad-hoc bug 12.05.2026: pre nego sto FE renderuje formu za
   * aktivaciju, proveri stanje tokena. BE vraca VALID / USED / EXPIRED /
   * INVALID / ALREADY_ACTIVE i FE prikazuje odgovarajucu poruku.
   * Endpoint je javan (bez Authorization header-a).
   */
  getActivationTokenStatus: async (token: string): Promise<{
    status: 'VALID' | 'USED' | 'EXPIRED' | 'INVALID' | 'ALREADY_ACTIVE';
    expiresAt: string | null;
    email: string | null;
  }> => {
    const response = await api.get<{
      status: 'VALID' | 'USED' | 'EXPIRED' | 'INVALID' | 'ALREADY_ACTIVE';
      expiresAt: string | null;
      email: string | null;
    }>(`/auth-employee/activation-token/${encodeURIComponent(token)}/status`);
    return response.data;
  },

  /**
   * Spec Celina 1 Sc 9: kad je aktivacioni token istekao, posalji novi
   * aktivacioni link. Prosledjujemo stari (istekli) token koji BE koristi da
   * identifikuje zaposlenog. Endpoint je javan i anti-enumeration — BE uvek
   * vraca isti generic 200 odgovor (ne otkriva da li nalog postoji / je aktivan).
   */
  resendActivation: async (token: string): Promise<void> => {
    await api.post('/auth-employee/resend-activation', { token });
  },
};
