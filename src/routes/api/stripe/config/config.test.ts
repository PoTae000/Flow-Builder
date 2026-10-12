import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ env: {} as Record<string, string>, retrieve: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/stripe', () => ({ stripe: { prices: { retrieve: mocks.retrieve } }, isCheckoutConfigured: true }));
vi.mock('$lib/server/promptpay-payments', () => ({ promptPayConfig: () => ({ available: false, provider: 'promptpay' }) }));
import { GET } from './+server';
describe('Payment provider selection', () => {
	beforeEach(() => { delete mocks.env.PAYMENT_PROVIDER; vi.clearAllMocks(); });
	it.each([undefined, 'easydonate', 'stripe', 'invalid'])('does not fall back to Stripe for %s', async provider => {
		if (provider) mocks.env.PAYMENT_PROVIDER = provider;
		expect(await (await GET()).json()).toMatchObject({ available: false, provider: 'promptpay' });
		expect(mocks.retrieve).not.toHaveBeenCalled();
	});
});
