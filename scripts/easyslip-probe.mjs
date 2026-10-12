import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  try { loadEnvFile(fileURLToPath(new URL(`../${name}`, import.meta.url))); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
}
const key = process.env.EASYSLIP_API_KEY;
const account = process.env.EASYSLIP_RECEIVER_ACCOUNT;
const bank = process.env.EASYSLIP_RECEIVER_BANK_CODE;
console.log('Configuration (no secrets):', JSON.stringify({ apiKey: !!key, accountFormat: /^\d{6,20}$/.test(account ?? ''), bankFormat: /^\d{3}$/.test(bank ?? '') }));
if (!key || !account || !bank) {
  console.error('Missing EasySlip configuration.');
  process.exitCode = 1;
} else {
  try {
    let page = 1, checked = 0, accountMatch = false, bankMatch = false, exactMatch = false;
    while (true) {
      const response = await fetch(`https://api.easyslip.com/v2/bank-accounts?limit=100&page=${page}`, {
        headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('http');
      const body = await response.json();
      if (body.success !== true || !Array.isArray(body.data?.items) || !Number.isSafeInteger(body.data.total)) throw new Error('schema');
      for (const item of body.data.items) {
        const sameAccount = typeof item.bankNumber === 'string' && item.bankNumber.replace(/[\s-]/g, '') === account;
        const sameBank = item.bankCode === bank;
        accountMatch ||= sameAccount;
        bankMatch ||= sameBank;
        exactMatch ||= sameAccount && sameBank;
      }
      checked += body.data.items.length;
      if (checked >= body.data.total) break;
      if (!body.data.items.length || page >= 100) throw new Error('pagination');
      page++;
    }
    console.log('Branch account checks:', JSON.stringify({ checked, accountMatch, bankMatch, exactMatch }));
    console.log('No keys, names or account numbers printed. No slip verified or payment changed.');
  } catch {
    console.error('Account lookup failed. Check API access and network; no private response was printed.');
    process.exitCode = 1;
  }
}
