/**
 * Server-side Google ID token verification using Web Crypto API.
 * Zero npm dependencies — works on Cloudflare Workers.
 */

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

interface JWK {
	kid: string;
	kty: string;
	alg: string;
	n: string;
	e: string;
	use: string;
}

interface JWKSResponse {
	keys: JWK[];
}

interface GoogleTokenPayload {
	sub: string;
	email: string;
	name: string;
	picture: string;
	email_verified: boolean;
	iss: string;
	aud: string;
	exp: number;
	iat: number;
}

// In-memory JWKS cache (1 hour)
let cachedKeys: JWK[] | null = null;
let cacheExpiry = 0;

function base64UrlDecode(str: string): Uint8Array {
	// Pad the base64url string
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	while (str.length % 4) str += '=';
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function decodeJwtPart(part: string): Record<string, unknown> {
	const bytes = base64UrlDecode(part);
	const text = new TextDecoder().decode(bytes);
	return JSON.parse(text);
}

async function fetchJWKS(): Promise<JWK[]> {
	const now = Date.now();
	if (cachedKeys && now < cacheExpiry) {
		return cachedKeys;
	}

	const res = await fetch(GOOGLE_JWKS_URI);
	if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
	const data: JWKSResponse = await res.json();
	cachedKeys = data.keys;
	cacheExpiry = now + 3600_000; // 1 hour
	return data.keys;
}

async function importRsaKey(jwk: JWK): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'jwk',
		{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg, ext: true },
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	);
}

/**
 * Verify a Google ID token and return the payload.
 * Throws on invalid/expired token.
 */
export async function verifyGoogleToken(
	idToken: string,
	clientId: string
): Promise<GoogleTokenPayload> {
	const parts = idToken.split('.');
	if (parts.length !== 3) throw new Error('Invalid JWT format');

	const [headerB64, payloadB64, signatureB64] = parts;
	const header = decodeJwtPart(headerB64) as unknown as { kid: string; alg: string };
	const payload = decodeJwtPart(payloadB64) as unknown as GoogleTokenPayload;

	// Check expiration
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp < now) throw new Error('Token expired');

	// Check issuer
	if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error('Invalid issuer');

	// Check audience
	if (payload.aud !== clientId) throw new Error('Invalid audience');

	// Check email is verified — email claim is untrusted without this.
	// An attacker controlling a Google Workspace domain can set an unverified
	// alias matching an admin's email; email_verified guards admin checks.
	if (payload.email_verified !== true) throw new Error('Email not verified');

	// Verify signature
	const keys = await fetchJWKS();
	const jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) throw new Error('Key not found in JWKS');

	const key = await importRsaKey(jwk);
	const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const signature = base64UrlDecode(signatureB64);

	const sigBuffer = new Uint8Array(signature).buffer as ArrayBuffer;
	const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBuffer, data);
	if (!valid) throw new Error('Invalid signature');

	return payload;
}

/**
 * Extract and verify Bearer token from Authorization header.
 * Returns the user's Google `sub` (unique ID).
 */
export async function authenticateRequest(
	request: Request,
	clientId: string
): Promise<GoogleTokenPayload> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		throw new Error('Missing or invalid Authorization header');
	}

	const token = authHeader.slice(7);
	return verifyGoogleToken(token, clientId);
}
