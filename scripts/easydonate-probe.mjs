import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    try { loadEnvFile(fileURLToPath(new URL(`../${name}`, import.meta.url))); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
}
const configured = {
    apiKey: Boolean(process.env.EASYDONATE_API_KEY),
    webhookSecret: Boolean(process.env.EASYDONATE_WEBHOOK_SECRET),
    schemaVerified: process.env.EASYDONATE_VERIFIED_SCHEMA === 'true'
};
console.log('Configuration (no secrets):', JSON.stringify(configured));
if (!configured.apiKey) {
    console.error('Missing EASYDONATE_API_KEY in the loaded environment.');
    process.exitCode = 1;
} else {
    try {
        const url = new URL('https://api.easydonate.app/api/v1/donations/search');
        url.searchParams.set('size', '10');
        url.searchParams.set('channelName', 'PROMPTPAY');
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${process.env.EASYDONATE_API_KEY}` },
            redirect: 'error', signal: AbortSignal.timeout(10000)
        });
        console.log('API HTTP status:', response.status);
        if (!response.ok) {
            console.error('Check API key permissions (read:donations) and network access.');
            process.exitCode = 1;
        } else {
            const body = await response.json();
            const data = body?.data;
            const records = Array.isArray(data) ? data : Array.isArray(data?.histories) ? data.histories : Array.isArray(data?.items) ? data.items : Array.isArray(data?.donations) ? data.donations : null;
            console.log('Envelope field names:', JSON.stringify(Object.keys(body ?? {})));
            console.log('Data shape:', Array.isArray(data) ? 'array' : typeof data);
            if (data && !Array.isArray(data)) console.log('Data field names:', JSON.stringify(Object.keys(data)));
            console.log('Record count:', records?.length ?? 'unknown');
            if (records?.length) {
                const record = records[0];
                console.log('Record field names:', JSON.stringify(Object.keys(record)));
                console.log('Required field types:', JSON.stringify(Object.fromEntries(
                    ['referenceNo', 'channelName', 'donateMessage', 'amount', 'createdAt', 'time'].map(key => [key, typeof record[key]])
                )));
                console.log('Provider channel:', record.channelName === 'PROMPTPAY' ? 'PROMPTPAY' : 'unexpected');
            }
            console.log('No keys, names, amounts, messages or payment references were printed.');
            console.log('This diagnostic does not enable payments or change entitlements.');
        }
    } catch {
        console.error('Unable to read EasyDonate API. Check connectivity or response format.');
        process.exitCode = 1;
    }
}
