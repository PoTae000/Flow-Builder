import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const { Pool } = pg;

export const pool = new Pool({
	connectionString: DATABASE_URL
});

export type PlanType = 'basic' | 'advanced';

/** Ensure user exists (upsert) — call before any user-scoped operation */
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

/** Get user's current plan, checking expiry */
export async function getUserPlan(sub: string): Promise<PlanInfo> {
	const result = await pool.query(
		'SELECT plan, plan_expires_at FROM users WHERE sub = $1',
		[sub]
	);
	if (result.rows.length === 0) return { plan: 'basic', planExpiresAt: null };
	const row = result.rows[0];
	if (row.plan === 'advanced') {
		// Check expiry
		if (row.plan_expires_at && new Date(row.plan_expires_at) < new Date()) {
			// Expired — downgrade
			await pool.query('UPDATE users SET plan = $1 WHERE sub = $2', ['basic', sub]);
			return { plan: 'basic', planExpiresAt: null };
		}
		return { plan: 'advanced', planExpiresAt: row.plan_expires_at?.toISOString?.() ?? row.plan_expires_at ?? null };
	}
	return { plan: 'basic', planExpiresAt: null };
}

/** Update user plan */
export async function updateUserPlan(sub: string, plan: PlanType, expiresAt?: Date): Promise<void> {
	await pool.query(
		'UPDATE users SET plan = $1, plan_expires_at = $2 WHERE sub = $3',
		[plan, expiresAt || null, sub]
	);
}

/** Get or set stripe_customer_id for a user */
export async function getStripeCustomerId(sub: string): Promise<string | null> {
	const result = await pool.query('SELECT stripe_customer_id FROM users WHERE sub = $1', [sub]);
	return result.rows[0]?.stripe_customer_id || null;
}

export async function setStripeCustomerId(sub: string, customerId: string): Promise<void> {
	await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE sub = $2', [customerId, sub]);
}

/** Close the pool gracefully on process exit */
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

/** Create tables if they don't exist — runs once on startup */
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
			PRIMARY KEY (user_sub, id)
		);

		CREATE TABLE IF NOT EXISTS user_state (
			user_sub TEXT PRIMARY KEY REFERENCES users(sub),
			active_diagram_id TEXT,
			version BIGINT DEFAULT 0
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
	`);

	// Add columns to existing users table (safe if already exist)
	await pool.query(`
		ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
	`);
}
