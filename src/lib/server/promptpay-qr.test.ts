import { describe, expect, it } from 'vitest';
import { normalizePromptPayPhone, proPromptPayPayload, proPromptPayImage } from './promptpay-qr';

function fields(payload: string) {
	const result: Record<string, string> = {};
	for (let i = 0; i < payload.length;) {
		const tag = payload.slice(i, i + 2);
		const length = Number(payload.slice(i + 2, i + 4));
		result[tag] = payload.slice(i + 4, i + 4 + length);
		i += 4 + length;
	}
	return result;
}

describe('Fixed Pro PromptPay QR', () => {
	it('encodes exactly 249 THB with the normalized receiver phone', () => {
		const payload = proPromptPayPayload('081-234-5678');
		const tags = fields(payload);
		expect(tags['54']).toBe('249.00');
		expect(tags['53']).toBe('764');
		expect(tags['58']).toBe('TH');
		expect(fields(tags['29'])['01']).toBe('0066812345678');
		expect(tags['63']).toMatch(/^[0-9A-F]{4}$/);
	});
	it('encodes the configured ten-baht test price', () => {
        expect(fields(proPromptPayPayload('0812345678', 1000))['54']).toBe('10.00');
    });
	it.each(['', 'abc0812345678', '1234567890123', '081234567', '08123456789'])('rejects invalid receiver %s', phone => {
		expect(() => normalizePromptPayPhone(phone)).toThrow();
	});
	it('renders a PNG for displaying and saving on the checkout page', async () => {
		expect(await proPromptPayImage('0812345678')).toMatch(/^data:image\/png;base64,/);
	});
});
