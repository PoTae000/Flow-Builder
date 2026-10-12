import { createHash } from 'node:crypto';
import { pool } from './db';

export const LOCK_LEASE_MS = 30_000;
let schemaReady: Promise<unknown> | undefined;

export async function updateEditLocks(room: string, token: string, owner: string, name: string, ids: string[], release = false) {
	// Hash the room capability so it is never stored as plain text.
	const key = createHash('sha256').update(`${room}:${token}`).digest('hex');
	schemaReady ??= pool.query(`CREATE TABLE IF NOT EXISTS diagram_edit_locks (
		room_key TEXT NOT NULL, item_id TEXT NOT NULL, owner_id TEXT NOT NULL,
		owner_name TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
		PRIMARY KEY (room_key, item_id)
	)`).catch(err => { schemaReady = undefined; throw err; });
	await schemaReady;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Serialize each room across every server instance, including batch acquisitions.
		await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
		await client.query('DELETE FROM diagram_edit_locks WHERE room_key = $1 AND expires_at <= NOW()', [key]);
		if (release) {
			await client.query('DELETE FROM diagram_edit_locks WHERE room_key = $1 AND owner_id = $2 AND item_id = ANY($3::text[])', [key, owner, ids]);
		} else if (ids.length) {
			const conflict = await client.query('SELECT item_id FROM diagram_edit_locks WHERE room_key = $1 AND item_id = ANY($2::text[]) AND owner_id <> $3', [key, ids, owner]);
			if (!conflict.rowCount) {
				await client.query(`INSERT INTO diagram_edit_locks (room_key, item_id, owner_id, owner_name, expires_at)
					SELECT $1, unnest($2::text[]), $3, $4, NOW() + INTERVAL '30 seconds'
					ON CONFLICT (room_key, item_id) DO UPDATE SET owner_name = EXCLUDED.owner_name, expires_at = EXCLUDED.expires_at`, [key, ids, owner, name]);
			}
		}
		const result = await client.query('SELECT item_id AS id, owner_id AS owner, owner_name AS name, expires_at AS "expiresAt" FROM diagram_edit_locks WHERE room_key = $1', [key]);
		await client.query('COMMIT');
		return result.rows as { id: string; owner: string; name: string; expiresAt: Date }[];
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally { client.release(); }
}
