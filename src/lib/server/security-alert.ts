
import { env } from '$env/dynamic/private';


const SENSITIVE_SUFFIXES = [
	'/.env',
	'/.env.local',
	'/.env.production',
	'/.env.development',
	'/.git/head',
	'/.git/config',
	'/.aws/credentials',
	'/config.json',
	'/config.js',
	'/credentials.json',
	'/secrets.json',
	'/id_rsa',
	'/.npmrc',
	'/wp-config.php',
	'/.htpasswd'
];


export function isSensitivePath(pathname: string): boolean {
	const p = pathname.toLowerCase();
	return SENSITIVE_SUFFIXES.some((s) => p === s || p.endsWith(s));
}


const PROBE_PATTERNS: RegExp[] = [
	/\.php$/i, // this is a SvelteKit app — no PHP exists, so any .php is a probe
	/\.env(\.|$)/i,
	/\/\.git(\/|$)/i,
	/\/\.aws(\/|$)/i,
	/\/\.ssh(\/|$)/i,
	/\/wp-(admin|login|content|includes)/i, // WordPress attack surface
	/\/phpmyadmin/i,
	/\/\.well-known\/(?!acme-challenge)/i, // acme is legit (Let's Encrypt); rest often probed
	/\/(vendor|node_modules)\//i,
	/\/(shell|cmd|backdoor|webshell)/i,
	/\/(config|credentials|secrets?)\.(json|js|php|ya?ml|bak|old|txt)$/i,
	/\/\.(htpasswd|htaccess|npmrc|dockercfg)$/i,
	/\/(id_rsa|id_dsa|\.pem)$/i,
	/\/xmlrpc\.php$/i,
	/\/(actuator|console|manager\/html)/i 
];


export function isProbePath(pathname: string): boolean {
	return PROBE_PATTERNS.some((re) => re.test(pathname));
}


const PHP_PROBE = /\.php($|[?/])/i;




const ALERT_COOLDOWN_MS = 60 * 60 * 1000; 
const MAX_ALERTS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;
const lastAlertByPath = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function nowMs(): number {
	return Date.now();
}

function shouldSend(path: string, now: number): boolean {
	
	const last = lastAlertByPath.get(path);
	if (last && now - last < ALERT_COOLDOWN_MS) return false;

	
	if (now - windowStart > WINDOW_MS) {
		windowStart = now;
		windowCount = 0;
	}
	if (windowCount >= MAX_ALERTS_PER_WINDOW) return false;

	lastAlertByPath.set(path, now);
	windowCount++;
	return true;
}


function sendTelegram(text: string): void {
	const token = env.TELEGRAM_BOT_TOKEN;
	const chatId = env.TELEGRAM_CHAT_ID;
	if (!token || !chatId) return; 

	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), 5000);
	fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			parse_mode: 'Markdown',
			disable_web_page_preview: true
		}),
		signal: controller.signal
	})
		.catch((err) => console.error('[SECURITY] Telegram alert failed:', err?.message || err))
		.finally(() => clearTimeout(t));
}


export function alertSensitiveHit(opts: {
	path: string;
	status: number;
	ip: string;
	method: string;
	userAgent: string;
}): void {
	const { path, status, ip, method, userAgent } = opts;
	const now = nowMs();

	
	console.error(
		`[SECURITY] Sensitive path served non-404: ${method} ${path} -> ${status} ` +
			`(ip=${ip}, ua="${userAgent}")`
	);

	if (!shouldSend(path, now)) return;

	sendTelegram(
		`🚨 *SECRET LEAKED*\n` +
			`A secret path was served *${status}* (should be 404!)\n\n` +
			`*Path:* \`${path}\`\n` +
			`*Method:* ${method}\n` +
			`*Status:* ${status}\n` +
			`*IP:* ${ip}\n` +
			`*UA:* ${userAgent.slice(0, 120)}`
	);
}






const SCAN_THRESHOLD = 6; 
const SCAN_WINDOW_MS = 10 * 60 * 1000; 
const SCAN_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; 
const BAN_DURATION_MS = 6 * 60 * 60 * 1000; 
const MAX_TRACKED_IPS = 2000; 

type ProbeRecord = {
	count: number;
	first: number; 
	paths: string[]; 
	alertedUntil: number; 
	bannedUntil: number; 
};
const probesByIp = new Map<string, ProbeRecord>();


export function isBanned(ip: string): boolean {
	const rec = probesByIp.get(ip);
	return !!rec && nowMs() < rec.bannedUntil;
}


export function recordProbe(opts: {
	path: string;
	status?: number;
	ip: string;
	method: string;
	userAgent: string;
}): void {
	const { path, ip, method, userAgent } = opts;
	const now = nowMs();

	
	if (probesByIp.size > MAX_TRACKED_IPS) {
		for (const [k, v] of probesByIp) {
			if (now - v.first > SCAN_WINDOW_MS && now > v.alertedUntil) probesByIp.delete(k);
		}
	}

	let rec = probesByIp.get(ip);
	if (!rec || now - rec.first > SCAN_WINDOW_MS) {
		rec = {
			count: 0,
			first: now,
			paths: [],
			alertedUntil: rec?.alertedUntil ?? 0,
			bannedUntil: rec?.bannedUntil ?? 0
		};
		probesByIp.set(ip, rec);
	}
	rec.count++;
	if (rec.paths.length < 8 && !rec.paths.includes(path)) rec.paths.push(path);

	console.warn(`[SECURITY] Probe: ${method} ${path} (ip=${ip}, count=${rec.count})`);

	
	
	
	
	
	if (PHP_PROBE.test(path) && shouldSend(`php:${ip}`, now)) {
		sendTelegram(
			`🐘 *.php probe detected*\n` +
				`Someone requested a *.php* file — this app has no PHP, so it's a scan/attack.\n\n` +
				`*Path:* \`${path}\`\n` +
				`*Method:* ${method}\n` +
				`*IP:* ${ip}\n` +
				`*UA:* ${userAgent.slice(0, 120)}\n\n` +
				`_(HTTP ${opts.status ?? 'unknown'}. IP auto-blocks after ${SCAN_THRESHOLD} probes. This alert does not establish whether data was exposed.)_`
		);
	}

	if (rec.count < SCAN_THRESHOLD) return;

	
	
	rec.bannedUntil = now + BAN_DURATION_MS;

	if (now < rec.alertedUntil) return; 
	rec.alertedUntil = now + SCAN_ALERT_COOLDOWN_MS;

	const pathList = rec.paths.map((p) => `• \`${p}\``).join('\n');
	sendTelegram(
		`⛔ *Scan detected — IP blocked*\n` +
			`One IP is probing secret / attack paths — looks like a hack attempt.\n` +
			`It has been auto-blocked (403) for 6h.\n\n` +
			`*IP:* ${ip}\n` +
			`*Hits:* ${rec.count} in <10 min\n` +
			`*UA:* ${userAgent.slice(0, 120)}\n\n` +
			`*Tried:*\n${pathList}\n\n` +
			`_(Latest HTTP ${opts.status ?? 'unknown'}. IP now blocked & silenced for 6h. This alert does not establish whether data was exposed.)_`
	);
}

// API abuse tracking: when an IP trips a rate limit (429) on an API endpoint
// repeatedly, ban it the same way path-scanners are banned. This is the
// IP-level backstop that recordProbe alone doesn't cover — flooding
// /api/guest/ping, /api/health, etc. never matches a probe pattern, so without
// this an attacker can hammer endpoints indefinitely from one IP.
const ABUSE_THRESHOLD = 20; // 20 rate-limited requests in the scan window → ban
const ABUSE_WINDOW_MS = 10 * 60 * 1000;

export function recordApiAbuse(ip: string): void {
	const now = nowMs();

	if (probesByIp.size > MAX_TRACKED_IPS) {
		for (const [k, v] of probesByIp) {
			if (now - v.first > SCAN_WINDOW_MS && now > v.alertedUntil) probesByIp.delete(k);
		}
	}

	let rec = probesByIp.get(ip);
	if (!rec || now - rec.first > ABUSE_WINDOW_MS) {
		rec = {
			count: 0,
			first: now,
			paths: [],
			alertedUntil: rec?.alertedUntil ?? 0,
			bannedUntil: rec?.bannedUntil ?? 0
		};
		probesByIp.set(ip, rec);
	}
	rec.count++;

	// Once over threshold, ban for the same duration as a scan.
	if (rec.count >= ABUSE_THRESHOLD && now >= rec.bannedUntil) {
		rec.bannedUntil = now + BAN_DURATION_MS;
		console.warn(`[SECURITY] API abuse — IP banned for 6h: ${ip} (${rec.count} rate-limited hits)`);
	}
}
