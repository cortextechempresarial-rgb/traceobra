import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSelectedCompanyId, getStoredUser, getToken, logout } from './auth';
import { apiFetch, readApiResponse } from './api';

vi.mock('./auth', () => ({
  getSelectedCompanyId: vi.fn(),
  getStoredUser: vi.fn(),
  getToken: vi.fn(),
  logout: vi.fn(),
}));

describe('apiFetch', () => {
  beforeEach(() => {
    vi.mocked(getToken).mockReturnValue('test-session-token');
    vi.mocked(getStoredUser).mockReturnValue({ role: 'admin' });
    vi.mocked(getSelectedCompanyId).mockReturnValue('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  describe('readApiResponse', () => {
    it('returns the JSON payload when the API responds successfully', async () => {
      const result = await readApiResponse(new Response('{"ok":true,"data":[]}'));
      expect(result).toEqual({ ok: true, data: [] });
    });

    it('uses the API error message for unsuccessful JSON responses', async () => {
      await expect(readApiResponse(
        new Response('{"ok":false,"message":"Migration pendente."}', { status: 500 }),
      )).rejects.toThrow('Migration pendente.');
    });

    it('explains when a route responds with HTML instead of JSON', async () => {
      await expect(readApiResponse(
        new Response('<!DOCTYPE html><html></html>', { status: 404 }),
      )).rejects.toThrow('backend está atualizado');
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends the stored JWT with authenticated API requests', async () => {
    await apiFetch('/projects', { method: 'GET' });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/projects');
    expect(options.headers.get('Authorization')).toBe('Bearer test-session-token');
  });

  it('preserves caller headers while adding the JWT', async () => {
    await apiFetch('/maps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('Authorization')).toBe('Bearer test-session-token');
  });

  it('only sends the selected company for a super admin session', async () => {
    vi.mocked(getStoredUser).mockReturnValue({ role: 'super_admin' });
    vi.mocked(getSelectedCompanyId).mockReturnValue('company-123');

    await apiFetch('/projects');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.get('X-Company-ID')).toBe('company-123');
  });

  it('clears the local session when the API rejects the token', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 });

    await apiFetch('/projects');

    expect(logout).toHaveBeenCalledOnce();
  });
});