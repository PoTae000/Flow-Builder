import { describe, expect, it } from 'vitest';
import { guestRequestAllowed, issueGuestSession, readGuestSession } from './guest-session';

describe('guest session protection', () => {
	it('accepts only server signed identities', () => {
		const signed = issueGuestSession();
		expect(readGuestSession(signed)).toMatch(/^guest_/);
		expect(readGuestSession(signed.replace('guest_', 'guest_a'))).toBeNull();
		expect(readGuestSession(signed + '.extra')).toBeNull();
		expect(readGuestSession('guest_12345678')).toBeNull();
		expect(readGuestSession()).toBeNull();
	});
	it('rejects forged signatures', () => {
		const id = readGuestSession(issueGuestSession());
		expect(readGuestSession(`${id}.${'0'.repeat(64)}`)).toBeNull();
	});
	it('blocks floods before database access and recovers after the window', () => {
		for (let i = 0; i < 60; i++) expect(guestRequestAllowed('test-client', 1000)).toBe(true);
		expect(guestRequestAllowed('test-client', 1000)).toBe(false);
		expect(guestRequestAllowed('another-client', 1000)).toBe(true);
		expect(guestRequestAllowed('test-client', 61000)).toBe(true);
	});
});
