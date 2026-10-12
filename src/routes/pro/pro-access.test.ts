import { beforeEach, expect, it, vi } from 'vitest';
const verify = vi.hoisted(() => vi.fn());
vi.mock('$env/static/public', () => ({ PUBLIC_GOOGLE_CLIENT_ID: 'client' }));
vi.mock('$lib/server/google-verify', () => ({ verifyGoogleToken: verify }));
import { load } from './+page.server';
const makeEvent = (token?: string) => ({ cookies: { get: () => token, delete: vi.fn() }, setHeaders: vi.fn() });
beforeEach(() => vi.resetAllMocks());
it.each([undefined, 'forged', 'expired'])('rejects missing, forged or expired session %s', async token => {
	verify.mockRejectedValue(new Error('invalid'));
	const event = makeEvent(token);
	await expect(load(event as unknown as Parameters<typeof load>[0])).rejects.toMatchObject({ status: 303, location: '/' });
	expect(event.cookies.delete).toHaveBeenCalledWith('pro-access', { path: '/pro' });
});
it('allows only a server-verified Google session and prevents caching', async () => {
	verify.mockResolvedValue({ sub: 'user' });
	const event = makeEvent('signed-token');
	await expect(load(event as unknown as Parameters<typeof load>[0])).resolves.toEqual({});
	expect(verify).toHaveBeenCalledWith('signed-token', 'client');
	expect(event.setHeaders).toHaveBeenCalledWith({ 'Cache-Control': 'private, no-store' });
});
