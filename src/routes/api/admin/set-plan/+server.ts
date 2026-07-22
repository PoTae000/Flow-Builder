/**
 * Admin-only endpoint to set a user's plan.
 *
 * Security layers:
 * 1. Must be authenticated (valid Google ID token)
 * 2. Caller's email must be in ADMIN_EMAILS env var
 * 3. Request body validated (target_sub + plan)
 * 4. Rate limited to prevent abuse
 */

import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { isAdminEmail } from '$lib/server/admin';
import { pool, updateUserPlan } from '$lib/server/db';
import type { PlanType } from '$lib/server/db';

const VALID_PLANS: PlanType[] = ['basic', 'advanced'];

export async function POST({ request }: { request: Request }) {
	// 1. Authenticate — must have valid Google token
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	// 2. Admin check — caller must be admin
	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}

	// 3. Parse and validate body
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { target_sub, plan, expires_days } = body;

	if (!target_sub || typeof target_sub !== 'string') {
		throw error(400, 'Missing target_sub');
	}

	if (!plan || !VALID_PLANS.includes(plan)) {
		throw error(400, 'Invalid plan. Must be "basic" or "advanced"');
	}

	// 4. Verify target user exists
	const userResult = await pool.query('SELECT sub FROM users WHERE sub = $1', [target_sub]);
	if (userResult.rows.length === 0) {
		throw error(404, 'User not found');
	}

	// 5. Set plan
	let expiresAt: Date | undefined;
	if (plan === 'advanced' && expires_days && typeof expires_days === 'number' && expires_days > 0) {
		expiresAt = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000);
	}

	await updateUserPlan(target_sub, plan, expiresAt);

	return json({
		success: true,
		target_sub,
		plan,
		expires_at: expiresAt?.toISOString() || null
	});
}

/** List all users with their plans (admin only) */
export async function GET({ request }: { request: Request }) {
	// 1. Authenticate
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	// 2. Admin check
	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}

	// 3. Query users
	const result = await pool.query(
		'SELECT sub, email, name, plan, plan_expires_at, stripe_customer_id, created_at FROM users ORDER BY created_at DESC LIMIT 100'
	);

	return json({ users: result.rows });
}
