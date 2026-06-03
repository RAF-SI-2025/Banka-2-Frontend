import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiUrl, getOurBankCode, getOurAccountPrefix, getEnv } from './runtime';

describe('runtime config', () => {
  let originalEnv: Window['_env_'];

  beforeEach(() => {
    originalEnv = window._env_;
  });

  afterEach(() => {
    window._env_ = originalEnv;
  });

  describe('getApiUrl', () => {
    it('returns window._env_.API_URL when set', () => {
      window._env_ = { API_URL: 'https://prod.example.com/api', OUR_BANK_CODE: 'RN-222', ENV: 'production' };
      expect(getApiUrl()).toBe('https://prod.example.com/api');
    });

    it('falls back to import.meta.env.VITE_API_URL when window._env_ missing', () => {
      window._env_ = undefined;
      expect(getApiUrl()).toBe('http://localhost:8080');
    });

    it('falls back to /api when both missing', () => {
      window._env_ = { API_URL: '', OUR_BANK_CODE: '', ENV: '' };
      // import.meta.env.VITE_API_URL is set in test setup to 'http://localhost:8080'
      expect(getApiUrl()).toBe('http://localhost:8080');
    });
  });

  describe('getOurBankCode', () => {
    it('returns window._env_.OUR_BANK_CODE when set', () => {
      window._env_ = { API_URL: '/api', OUR_BANK_CODE: 'RN-333', ENV: 'test' };
      expect(getOurBankCode()).toBe('RN-333');
    });

    it('falls back to RN-222 when missing', () => {
      window._env_ = undefined;
      expect(getOurBankCode()).toBe('RN-222');
    });
  });

  describe('getOurAccountPrefix', () => {
    it('derives 3-digit account prefix from bank code (RN-222 -> 222)', () => {
      window._env_ = { API_URL: '/api', OUR_BANK_CODE: 'RN-222', ENV: 'test' };
      expect(getOurAccountPrefix()).toBe('222');
    });

    it('tracks a different bank code (RN-333 -> 333)', () => {
      window._env_ = { API_URL: '/api', OUR_BANK_CODE: 'RN-333', ENV: 'test' };
      expect(getOurAccountPrefix()).toBe('333');
    });

    it('falls back to default (RN-222 -> 222) when missing', () => {
      window._env_ = undefined;
      expect(getOurAccountPrefix()).toBe('222');
    });
  });

  describe('getEnv', () => {
    it('returns ENV value or unknown', () => {
      window._env_ = { API_URL: '/api', OUR_BANK_CODE: 'RN-222', ENV: 'production' };
      expect(getEnv()).toBe('production');
      window._env_ = undefined;
      expect(getEnv()).toBe('unknown');
    });
  });
});
