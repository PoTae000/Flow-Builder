import { json } from '@sveltejs/kit';
import { promptPayConfig } from '$lib/server/promptpay-payments';
import { easySlipAvailable } from '$lib/server/easyslip-status';

export async function GET() {
    const config = promptPayConfig();
    if (config.available) config.available = await easySlipAvailable();
    return json(config, { headers: { 'Cache-Control': 'no-store' } });
}
