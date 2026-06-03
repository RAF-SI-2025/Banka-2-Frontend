import { authService } from './authService';
import api from './api';

vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('sends POST to /auth/login and returns data', async () => {
      const mockResponse = {
        data: { accessToken: 'abc', refreshToken: 'def', tokenType: 'Bearer' },
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await authService.login({ email: 'test@banka.rs', password: 'pass' });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'test@banka.rs', password: 'pass' });
      expect(result).toEqual(mockResponse.data);
    });

    it('throws on API error', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));
      await expect(authService.login({ email: 'test@banka.rs', password: 'pass' })).rejects.toThrow('Network error');
    });
  });

  describe('refreshToken', () => {
    it('sends POST to /auth/refresh', async () => {
      mockApi.post.mockResolvedValue({ data: { accessToken: 'new', refreshToken: 'new-r' } });

      const result = await authService.refreshToken('old-refresh');

      expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'old-refresh' });
      expect(result.accessToken).toBe('new');
    });
  });

  describe('forgotPassword', () => {
    it('sends POST to /auth/password_reset/request', async () => {
      mockApi.post.mockResolvedValue({ data: undefined });

      await authService.forgotPassword({ email: 'test@banka.rs' });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/password_reset/request', { email: 'test@banka.rs' });
    });
  });

  describe('resetPassword', () => {
    it('sends POST to /auth/password_reset/confirm', async () => {
      mockApi.post.mockResolvedValue({ data: undefined });

      await authService.resetPassword({ token: 'tok', newPassword: 'New12345' });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/password_reset/confirm', { token: 'tok', newPassword: 'New12345' });
    });
  });

  describe('activateAccount', () => {
    it('sends POST to /auth-employee/activate', async () => {
      mockApi.post.mockResolvedValue({ data: undefined });

      await authService.activateAccount({ token: 'tok', password: 'Pass12345' });

      expect(mockApi.post).toHaveBeenCalledWith('/auth-employee/activate', { token: 'tok', password: 'Pass12345' });
    });
  });

  describe('resendActivation', () => {
    it('sends POST to /auth-employee/resend-activation with the old token', async () => {
      mockApi.post.mockResolvedValue({ data: undefined });

      await authService.resendActivation('expired-tok');

      expect(mockApi.post).toHaveBeenCalledWith('/auth-employee/resend-activation', { token: 'expired-tok' });
    });

    it('propagates API errors', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));

      await expect(authService.resendActivation('expired-tok')).rejects.toThrow('Network error');
    });
  });
});
