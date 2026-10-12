export interface EasyDonatePayment {
	referenceNo: string;
	channelName: string;
	donateMessage: string;
	amount: number;
	createdAt?: string;
	time?: string;
}
export interface EasyDonateOrder {
	id: string;
	amount_satang: number;
	created_at: Date | string;
	expires_at: Date | string;
}

// Deny external/widget events and unknown channels. Never trust webhook amounts.
export function matchesPaidDonation(value: unknown, order: EasyDonateOrder): value is EasyDonatePayment {
	if (!value || typeof value !== 'object') return false;
	const p = value as Partial<EasyDonatePayment>;
	const time = Date.parse(p.createdAt ?? p.time ?? '');
	return typeof p.referenceNo === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(p.referenceNo)
		&& ['PROMPTPAY', 'SLIP_VERIFY', 'FEELFREEPAY'].includes(p.channelName ?? '')
		&& p.donateMessage?.trim() === order.id
		&& typeof p.amount === 'number' && Number.isFinite(p.amount)
		&& Math.abs(p.amount * 100 - order.amount_satang) < 0.000001
		&& Number.isFinite(time) && time >= new Date(order.created_at).getTime()
		&& time <= new Date(order.expires_at).getTime();
}

// The public reference omits response schemas. Unknown envelopes fail closed.
export function donationItems(envelope: unknown): unknown[] {
	if (!envelope || typeof envelope !== 'object') throw new Error('Invalid EasyDonate response');
	const data = (envelope as { data?: unknown }).data;
	if (Array.isArray(data)) return data;
	if (data && typeof data === 'object') {
		const { items, donations, histories } = data as { items?: unknown; donations?: unknown; histories?: unknown };
		if (Array.isArray(histories)) return histories;
		if (Array.isArray(items)) return items;
		if (Array.isArray(donations)) return donations;
	}
	throw new Error('Unverified EasyDonate response schema');
}
