import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

export const PRO_AMOUNT_SATANG = 24900;

export function normalizePromptPayPhone(value: string): string {
	const phone = value.replace(/[\s-]/g, '');
	if (!/^0[689]\d{8}$/.test(phone)) throw new Error('Invalid Thai PromptPay mobile number');
	return phone;
}

export function proPromptPayPayload(phone: string, amountSatang = PRO_AMOUNT_SATANG): string {
	if (!Number.isSafeInteger(amountSatang) || amountSatang <= 0) throw new Error('Invalid payment amount');
	return generatePayload(normalizePromptPayPhone(phone), { amount: amountSatang / 100 });
}

export async function proPromptPayImage(phone: string, amountSatang = PRO_AMOUNT_SATANG): Promise<string> {
	return QRCode.toDataURL(proPromptPayPayload(phone, amountSatang), {
		errorCorrectionLevel: 'M', margin: 4, width: 384,
		color: { dark: '#000000', light: '#ffffff' }
	});
}
