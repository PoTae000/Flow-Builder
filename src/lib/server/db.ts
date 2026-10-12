import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const { Pool } = pg;

export const pool = new Pool({
	connectionString: DATABASE_URL
});

export type PlanType = 'basic' | 'advanced';


export async function ensureUser(sub: string, email?: string, name?: string): Promise<PlanInfo> {
	if (email || name) {
		await pool.query(
			`INSERT INTO users (sub, email, name) VALUES ($1, $2, $3)
			 ON CONFLICT (sub) DO UPDATE SET email = COALESCE($2, users.email), name = COALESCE($3, users.name)`,
			[sub, email || null, name || null]
		);
	} else {
		await pool.query(
			'INSERT INTO users (sub) VALUES ($1) ON CONFLICT (sub) DO NOTHING',
			[sub]
		);
	}
	return await getUserPlan(sub);
}

export interface PlanInfo {
	plan: PlanType;
	planExpiresAt: string | null;
}


export async function getUserPlan(sub: string): Promise<PlanInfo> {
	const result = await pool.query(
		'SELECT plan, plan_expires_at FROM users WHERE sub = $1',
		[sub]
	);
	if (result.rows.length === 0) return { plan: 'basic', planExpiresAt: null };
	const row = result.rows[0];
	if (row.plan === 'advanced') {

		if (row.plan_expires_at && new Date(row.plan_expires_at) < new Date()) {

			await pool.query('UPDATE users SET plan = $1 WHERE sub = $2', ['basic', sub]);
			return { plan: 'basic', planExpiresAt: null };
		}
		return { plan: 'advanced', planExpiresAt: row.plan_expires_at?.toISOString?.() ?? row.plan_expires_at ?? null };
	}
	return { plan: 'basic', planExpiresAt: null };
}


export async function updateUserPlan(sub: string, plan: PlanType, expiresAt?: Date): Promise<void> {
	await pool.query(
		'UPDATE users SET plan = $1, plan_expires_at = $2 WHERE sub = $3',
		[plan, expiresAt || null, sub]
	);
}


export async function getStripeCustomerId(sub: string): Promise<string | null> {
	const result = await pool.query('SELECT stripe_customer_id FROM users WHERE sub = $1', [sub]);
	return result.rows[0]?.stripe_customer_id || null;
}

export async function setStripeCustomerId(sub: string, customerId: string): Promise<void> {
	await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE sub = $2', [customerId, sub]);
}


export async function hasActiveSubscription(sub: string): Promise<boolean> {
	const r = await pool.query(
		`SELECT 1 FROM subscriptions
		 WHERE user_sub = $1 AND status IN ('active', 'trialing') LIMIT 1`,
		[sub]
	);
	return r.rows.length > 0;
}


export async function deleteUser(sub: string): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('DELETE FROM diagram_versions WHERE user_sub = $1', [sub]);
		await client.query('DELETE FROM subscriptions   WHERE user_sub = $1', [sub]);
		await client.query('DELETE FROM deleted_diagrams WHERE user_sub = $1', [sub]);
		await client.query('DELETE FROM diagrams         WHERE user_sub = $1', [sub]);
		await client.query('DELETE FROM user_state       WHERE user_sub = $1', [sub]);
		await client.query('DELETE FROM users            WHERE sub = $1', [sub]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}


export async function recordGuestPing(guestId: string): Promise<void> {
	await pool.query(
		`INSERT INTO guest_sessions (guest_id) VALUES ($1)
		 ON CONFLICT (guest_id) DO UPDATE SET last_seen = NOW()`,
		[guestId]
	);
}


export async function removeGuest(guestId: string): Promise<void> {
	await pool.query('DELETE FROM guest_sessions WHERE guest_id = $1', [guestId]);
}


export async function touchUserSeen(sub: string): Promise<void> {
	await pool.query(
		`UPDATE users SET last_seen = NOW()
		 WHERE sub = $1 AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '10 seconds')`,
		[sub]
	);
}


export async function getOnlineUserCount(): Promise<number> {
	const r = await pool.query(
		`SELECT COUNT(*)::int AS n FROM users WHERE last_seen > NOW() - INTERVAL '45 seconds'`
	);
	return r.rows[0]?.n ?? 0;
}


export async function getGuestStats(): Promise<{ total: number; active: number; onlineUsers: number }> {
	const r = await pool.query(
		`SELECT
		   COUNT(*)::int AS total,
		   COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '90 seconds')::int AS active
		 FROM guest_sessions`
	);
	const onlineUsers = await getOnlineUserCount();
	return { total: r.rows[0]?.total ?? 0, active: r.rows[0]?.active ?? 0, onlineUsers };
}

export interface GuestRow {
	guest_id: string;
	first_seen: string;
	last_seen: string;
	online: boolean;
}


export async function cleanupOldGuests(): Promise<void> {
	try {
		await pool.query(
			`DELETE FROM guest_sessions WHERE last_seen < NOW() - INTERVAL '90 days'`
		);
	} catch {
		// DB may be unavailable — cleanup is best-effort.
	}
}


export async function getGuestList(limit = 500): Promise<GuestRow[]> {
	const r = await pool.query(
		`SELECT guest_id, first_seen, last_seen,
		        (last_seen > NOW() - INTERVAL '90 seconds') AS online
		 FROM guest_sessions
		 ORDER BY last_seen DESC
		 LIMIT $1`,
		[limit]
	);
	return r.rows as GuestRow[];
}







export async function createShare(
	id: string,
	data: unknown,
	ownerSub: string | null,
	expiresAt: number
): Promise<void> {
	await pool.query(
		`INSERT INTO shared_diagrams (id, data, owner_sub, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		[id, JSON.stringify(data), ownerSub, Date.now(), expiresAt]
	);
}


export async function getShare(id: string): Promise<unknown | null> {
	const r = await pool.query(
		'SELECT data, expires_at FROM shared_diagrams WHERE id = $1',
		[id]
	);
	if (r.rows.length === 0) return null;
	const row = r.rows[0];
	if (row.expires_at && Number(row.expires_at) < Date.now()) return null;
	return row.data;
}


export async function cleanupExpiredShares(): Promise<void> {
	try {
		await pool.query('DELETE FROM shared_diagrams WHERE expires_at < $1', [Date.now()]);
	} catch {
		// DB may be unavailable — cleanup is best-effort.
	}
}


function setupGracefulShutdown() {
	const shutdown = () => {
		pool.end().then(() => {
			console.log('[db] Pool closed');
			process.exit(0);
		});
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}
setupGracefulShutdown();


export async function initSchema(): Promise<void> {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
			sub TEXT PRIMARY KEY,
			email TEXT,
			name TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			plan TEXT DEFAULT 'basic',
			stripe_customer_id TEXT,
			plan_expires_at TIMESTAMPTZ
		);

		CREATE TABLE IF NOT EXISTS diagrams (
			id TEXT NOT NULL,
			user_sub TEXT NOT NULL REFERENCES users(sub),
			name TEXT NOT NULL DEFAULT '',
			diagram_type TEXT DEFAULT 'er',
			data JSONB,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			pinned BOOLEAN DEFAULT FALSE,
			tags JSONB DEFAULT '[]'::jsonb,
			PRIMARY KEY (user_sub, id)
		);

		CREATE TABLE IF NOT EXISTS user_state (
			user_sub TEXT PRIMARY KEY REFERENCES users(sub),
			active_diagram_id TEXT,
			version BIGINT DEFAULT 0,
			-- Single-device lock (DB source of truth). The id of the device that
			-- currently "owns" this account; any other device seeing a mismatch on
			-- its next poll/push signs itself out. Survives SSE dropping entirely.
			active_device TEXT,
			active_device_label TEXT,
			active_device_at BIGINT DEFAULT 0
		);

		-- Tombstones: records that a diagram was deleted, so other devices
		-- delete it too instead of resurrecting it. No FK to diagrams (must
		-- outlive the deleted row) — only scoped to the user.
		CREATE TABLE IF NOT EXISTS deleted_diagrams (
			user_sub TEXT NOT NULL REFERENCES users(sub),
			diagram_id TEXT NOT NULL,
			deleted_at BIGINT NOT NULL,
			PRIMARY KEY (user_sub, diagram_id)
		);

		CREATE TABLE IF NOT EXISTS rate_limits (
			key TEXT PRIMARY KEY,
			count INT DEFAULT 0,
			expires_at TIMESTAMPTZ NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

		-- Anonymous guest sessions: an opaque per-browser id, no identity, no IP
		-- (PDPA — we deliberately store no personal data). Lets the admin
		-- dashboard show how many guests exist / are online.
		CREATE TABLE IF NOT EXISTS guest_sessions (
			guest_id   TEXT PRIMARY KEY,
			first_seen TIMESTAMPTZ DEFAULT NOW(),
			last_seen  TIMESTAMPTZ DEFAULT NOW()
		);
		-- Drop the ip column if an earlier deploy added it — we no longer store IPs.
		ALTER TABLE guest_sessions DROP COLUMN IF EXISTS ip;
		CREATE INDEX IF NOT EXISTS idx_guest_last_seen ON guest_sessions(last_seen);

		CREATE TABLE IF NOT EXISTS diagram_versions (
			id SERIAL PRIMARY KEY,
			user_sub TEXT NOT NULL REFERENCES users(sub),
			diagram_id TEXT NOT NULL,
			data JSONB NOT NULL,
			name TEXT NOT NULL DEFAULT '',
			diagram_type TEXT DEFAULT 'er',
			created_at BIGINT NOT NULL,
			FOREIGN KEY (user_sub, diagram_id) REFERENCES diagrams(user_sub, id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_versions_lookup
			ON diagram_versions(user_sub, diagram_id, created_at DESC);

		CREATE TABLE IF NOT EXISTS subscriptions (
			id TEXT PRIMARY KEY,
			user_sub TEXT NOT NULL REFERENCES users(sub),
			stripe_customer_id TEXT NOT NULL,
			status TEXT NOT NULL,
			current_period_end TIMESTAMPTZ NOT NULL,
			cancel_at_period_end BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_sub);
		CREATE TABLE IF NOT EXISTS payment_orders (
			id TEXT PRIMARY KEY,
			user_sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
			provider TEXT NOT NULL DEFAULT 'easydonate',
			amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			expires_at TIMESTAMPTZ NOT NULL,
			provider_reference TEXT UNIQUE,
			paid_at TIMESTAMPTZ,
			pro_expires_at TIMESTAMPTZ
		);
		CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_sub, created_at);

		-- Shared diagrams: server-stored payload behind a short opaque id, so the
		-- share URL stays tiny regardless of diagram size. owner_sub is nullable
		-- (kept only for abuse tracing); no IP stored (PDPA). Pruned by expires_at.
		CREATE TABLE IF NOT EXISTS shared_diagrams (
			id TEXT PRIMARY KEY,
			data JSONB NOT NULL,
			owner_sub TEXT,
			created_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_shared_expires ON shared_diagrams(expires_at);
	`);


	await pool.query(`
		ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
	`);


	await pool.query(`
		ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
		ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
	`);


	await pool.query(`
		ALTER TABLE user_state ADD COLUMN IF NOT EXISTS active_device TEXT;
		ALTER TABLE user_state ADD COLUMN IF NOT EXISTS active_device_label TEXT;
		ALTER TABLE user_state ADD COLUMN IF NOT EXISTS active_device_at BIGINT DEFAULT 0;
	`);


	await pool.query(`
		ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
		CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
	`);
}
