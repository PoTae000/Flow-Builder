import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), touch: vi.fn(), remove: vi.fn(), limit: vi.fn(), guest: vi.fn(), query: vi.fn() }));
vi.mock('$env/static/public', () => ({ PUBLIC_GOOGLE_CLIENT_ID: 'test' }));
vi.mock('$lib/server/google-verify', () => ({ authenticateRequest: m.auth }));
vi.mock('$lib/server/db', () => ({ touchUserSeen: m.touch, removeGuest: m.remove, pool: { query: m.query } }));
vi.mock('$lib/server/rate-limit', () => ({ checkRateLimit: m.limit }));
vi.mock('$lib/server/guest-session', () => ({ GUEST_COOKIE: 'guest', readGuestSession: m.guest }));
import { POST, DELETE } from './+server';
const event = () => ({ request: new Request('https://example.test/api/user/presence', { method: 'POST' }), cookies: { get: () => 'signed-cookie' } }) as unknown as Parameters<typeof POST>[0];
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ sub: 'verified-user' }); m.limit.mockResolvedValue({ allowed: true }); m.guest.mockReturnValue('verified-guest'); });
it('uses verified user identity and clears only the signed guest identity', async () => {
	expect((await POST(event())).status).toBe(200);
	expect(m.touch).toHaveBeenCalledWith('verified-user');
	expect(m.remove).toHaveBeenCalledWith('verified-guest');
});
it('rejects unauthenticated heartbeat without database writes', async () => {
	m.auth.mockRejectedValue(new Error('invalid'));
	await expect(POST(event())).rejects.toMatchObject({ status: 401 });
	expect(m.touch).not.toHaveBeenCalled();
	expect(m.remove).not.toHaveBeenCalled();
});
it('limits heartbeat writes per verified user', async () => {
	m.limit.mockResolvedValue({ allowed: false });
	await expect(POST(event())).rejects.toMatchObject({ status: 429 });
	expect(m.touch).not.toHaveBeenCalled();
});
it('marks only the verified user offline on logout and removes Pro access', async () => {
	const e = { ...event(), cookies: { get: () => undefined, delete: vi.fn() } };
	expect((await DELETE(e as unknown as Parameters<typeof DELETE>[0])).status).toBe(200);
	expect(m.query).toHaveBeenCalledWith('UPDATE users SET last_seen = NULL WHERE sub = $1', ['verified-user']);
	expect(e.cookies.delete).toHaveBeenCalledWith('pro-access', { path: '/pro' });
});
it('does not let unauthenticated callers mark users offline', async () => {
	m.auth.mockRejectedValue(new Error('invalid'));
	await expect(DELETE(event())).rejects.toMatchObject({ status: 401 });
	expect(m.query).not.toHaveBeenCalled();
});
