import { describe, expect, it } from 'vitest';
import { donationItems, matchesPaidDonation } from './easydonate-validation';
const order = { id: 'FB-AAAAAAAAAAAAAAAAAAAAAAAA', amount_satang: 24900, created_at: '2026-10-12T10:00:00Z', expires_at: '2026-10-13T10:00:00Z' };
const payment = { referenceNo: 'EZDN-real-1', channelName: 'PROMPTPAY', donateMessage: order.id, amount: 249, createdAt: '2026-10-12T10:05:00Z' };
describe('EasyDonate payment verification', () => {
	it('accepts an exact, timely payment linked to the order', () => {
		expect(matchesPaidDonation(payment, order)).toBe(true);
	});
	it.each([
		{ amount: 248 }, { amount: '249' }, { amount: 249.00001 },
		{ channelName: 'EXTERNAL' }, { channelName: 'API' }, { channelName: '' },
		{ referenceNo: '' }, { donateMessage: 'another-account' },
		{ createdAt: 'invalid' }, { createdAt: '2026-10-12T09:59:59Z' },
		{ createdAt: '2026-10-13T10:00:01Z' }
	])('rejects an invalid payment: %j', override => {
		expect(matchesPaidDonation({ ...payment, ...override }, order)).toBe(false);
	});
	it('reads the confirmed histories envelope, including an empty history', () => {
		expect(donationItems({ data: { size: 10, total: 1, histories: [payment] } })).toEqual([payment]);
		expect(donationItems({ data: { histories: [] } })).toEqual([]);
	});
	it('rejects unexpected API envelopes instead of guessing payment fields', () => {
		expect(() => donationItems({ data: { unknown: [payment] } })).toThrow();
		expect(donationItems({ data: [payment] })).toEqual([payment]);
	});
});
