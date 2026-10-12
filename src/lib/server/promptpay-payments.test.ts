import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), fetch: vi.fn(), available: vi.fn() }));
vi.mock('./easyslip-status', () => ({ easySlipAvailable: mocks.available }));
vi.mock('$env/dynamic/private', () => ({ env: { PROMPTPAY_PHONE: '0812345678', PROMPTPAY_RECEIVER_NAME: 'Test Merchant', EASYSLIP_API_KEY: 'test-only', EASYSLIP_RECEIVER_ACCOUNT: '1234567890', EASYSLIP_RECEIVER_BANK_CODE: '004' } }));
vi.mock('./db', () => ({ pool: { query: mocks.query, connect: async () => ({ query: mocks.query, release: mocks.release }) } }));
vi.mock('./rate-limit', () => ({ checkRateLimit: async () => ({ allowed: true }) }));
import { env } from '$env/dynamic/private';
import { createPromptPayOrder, promptPayConfig, slipMismatchMessage, validProSlip, verifyPromptPaySlip } from './promptpay-payments';
const order = { id: 'FB-AAAAAAAAAAAAAAAAAAAAAAAA', user_sub: 'user_1', status: 'pending', amount_satang: 24900, created_at: '2026-10-12T10:00:00Z', expires_at: '2026-10-12T10:30:00Z' };
const raw = { transRef: 'real-bank-transaction', date: '2026-10-12T10:05:00Z', countryCode: 'TH', amount: { amount: 249, local: { currency: 'THB' } } };
const slip = { isDuplicate: false, matchedAccount: { bankNumber: '123-456-7890', bank: { code: '004' } }, amountInSlip: 249, isAmountMatched: true, rawSlip: raw };
const expected = { bank: '004', account: '1234567890' };
describe('PromptPay payment validation', () => {
	it('accepts a registered PromptPay phone and empty optional local currency, but rejects other phones and currencies', () => {
		const promptSlip = { ...slip, matchedAccount: { bank: { code: 'PROMPTPAY' }, bankNumber: '0812345678' }, rawSlip: { ...raw, amount: { amount: 249, local: { currency: '' } } } };
		const receiver = { ...expected, phone: '0812345678' };
		const now = Date.parse('2026-10-12T10:06:00Z');
		expect(validProSlip(promptSlip, order, receiver, now)).toBe(true);
		expect(validProSlip(promptSlip, order, expected, now)).toBe(false);
		expect(validProSlip(promptSlip, order, { ...receiver, phone: '0899999999' }, now)).toBe(false);
		expect(validProSlip({ ...promptSlip, rawSlip: { ...raw, amount: { amount: 249, local: { currency: 'USD' } } } }, order, receiver, now)).toBe(false);
	});
	it('distinguishes receiver registration, amount and old-order failures without exposing account numbers', () => {
		expect(slipMismatchMessage({ ...slip, matchedAccount: null }, order, expected)).toContain('ไม่พบบัญชีผู้รับ');
		expect(slipMismatchMessage(slip, { ...order, amount_satang: 1000 }, expected)).toContain('10.00');
		expect(slipMismatchMessage({ ...slip, rawSlip: { ...raw, date: '2026-10-12T09:59:00Z' } }, order, expected)).toContain('ก่อนสร้างคำสั่งซื้อ');
		const message = slipMismatchMessage(slip, order, { ...expected, account: '0000000000' });
		expect(message).toContain('บัญชีหรือธนาคาร');
		expect(message).not.toContain('1234567890');
	});
	it('requires verified amount, intended bank account and payment time', () => {
		expect(validProSlip(slip, order, expected, Date.parse('2026-10-12T10:06:00Z'))).toBe(true);
	});
	it('verifies the ten-baht test order against its actual stored amount', () => {
		const testOrder = { ...order, amount_satang: 1000 };
		const testSlip = { ...slip, amountInSlip: 10, rawSlip: { ...raw, amount: { amount: 10, local: { currency: 'THB' } } } };
		expect(validProSlip(testSlip, testOrder, expected, Date.parse('2026-10-12T10:06:00Z'))).toBe(true);
		expect(validProSlip(slip, testOrder, expected, Date.parse('2026-10-12T10:06:00Z'))).toBe(false);
	});
	it.each([
		{ matchedAccount: null }, { matchedAccount: { bankNumber: '0000000000', bank: { code: '004' } } },
		{ matchedAccount: { bankNumber: '1234567890', bank: { code: '014' } } },
		{ matchedAccount: {} }, { amountInSlip: 248 }, { amountInSlip: '249' }, { isAmountMatched: false },
		{ rawSlip: { ...raw, date: '2026-10-12T09:59:59Z' } },
		{ rawSlip: { ...raw, date: '2026-10-12T10:30:01Z' } },
		{ rawSlip: { ...raw, countryCode: 'US' } },
		{ rawSlip: { ...raw, amount: { amount: 249, local: { currency: 'USD' } } } },
		{ rawSlip: { ...raw, amount: { amount: 248 } } }, { rawSlip: { ...raw, transRef: '' } },
		{ rawSlip: {} }
	])('does not grant access to a mismatched or malformed slip: %j', override => {
		expect(validProSlip({ ...slip, ...override }, order, expected, Date.parse('2026-10-12T10:31:00Z'))).toBe(false);
	});
});
describe('Atomic PromptPay Pro activation', () => {
	beforeEach(() => {
		delete env.PRO_AMOUNT_SATANG;
		vi.clearAllMocks();
		mocks.available.mockResolvedValue(true);
		vi.stubGlobal('fetch', mocks.fetch);
		mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT * FROM payment_orders') ? [order] : sql.includes('RETURNING plan_expires_at') ? [{ plan_expires_at: '2026-11-12T10:05:00Z' }] : [] }));
		mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: slip }) });
	});
	it('does not create an order or return QR when EasySlip is unavailable', async () => {
		mocks.available.mockResolvedValue(false);
		await expect(createPromptPayOrder('user_1')).rejects.toMatchObject({ status: 503 });
		expect(mocks.available).toHaveBeenCalledWith(true);
		expect(mocks.query).not.toHaveBeenCalled();
	});
	it('creates a ten-baht order without reusing the original-price order', async () => {
        env.PRO_AMOUNT_SATANG = '1000';
        mocks.query.mockImplementation(async (sql: string, params: unknown[]) => ({ rows: sql.includes('INSERT INTO payment_orders') ? [{ ...order, amount_satang: params[2] }] : [] }));
        expect(promptPayConfig().amount).toBe(1000);
        const created = await createPromptPayOrder('user_1');
        expect(created.amount).toBe(1000);
        expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('amount_satang = $2'), ['user_1', 1000]);
    });
    it.each(['0', '-1', 'bad', '10.5'])('disables checkout for invalid price %s', value => {
        env.PRO_AMOUNT_SATANG = value;
        expect(promptPayConfig().available).toBe(false);
    });
	it('verifies server-side using the order amount and registered-account matching', async () => {
		const result = await verifyPromptPaySlip(order.id, order.user_sub, new File(['image'], 'slip.png', { type: 'image/png' }));
		expect(result.status).toBe('paid');
		const options = mocks.fetch.mock.calls[0][1];
		expect(options.body.get('matchAmount')).toBe('249');
		expect(options.body.get('matchAccount')).toBe('true');
		expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE payment_orders'), [order.id, `bank:${raw.transRef}`, new Date(raw.date), '2026-11-12T10:05:00Z']);
		expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
	});
	it('prevents a transaction reference being claimed by another order', async () => {
		mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT * FROM payment_orders') ? [order] : sql.includes('SELECT id FROM payment_orders') ? [{ id: 'other-order' }] : [] }));
		await expect(verifyPromptPaySlip(order.id, order.user_sub, new File(['image'], 'slip.png'))).rejects.toMatchObject({ status: 409 });
		expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
		expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
	});
	it('does not bill API quota or extend Pro for an already paid order', async () => {
		mocks.query.mockResolvedValue({ rows: [{ ...order, status: 'paid' }] });
		await verifyPromptPaySlip(order.id, order.user_sub, new File(['image'], 'slip.png'));
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
	it('never verifies another user\'s order', async () => {
		mocks.query.mockResolvedValue({ rows: [] });
		await expect(verifyPromptPaySlip(order.id, 'other-user', new File(['image'], 'slip.png'))).rejects.toMatchObject({ status: 404 });
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
});
