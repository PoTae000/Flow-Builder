

import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { isAdminEmail } from '$lib/server/admin';
import { checkRateLimit } from '$lib/server/rate-limit';
import { pool, updateUserPlan, getGuestStats, hasActiveSubscription, deleteUser } from '$lib/server/db';
import type { PlanType } from '$lib/server/db';

const VALID_PLANS: PlanType[] = ['basic', 'advanced'];

export async function POST({ request }: { request: Request }) {


	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}


	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}


	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!(await checkRateLimit(`admin:plan:${payload.sub}`, 30)).allowed) throw error(429, 'Too many requests');
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Invalid request');
	const { target_sub, plan, expires_days } = body;
	if (expires_days !== undefined && expires_days !== null && (!Number.isSafeInteger(expires_days) || expires_days < 1 || expires_days > 36500)) throw error(400, 'Invalid expiry days');

	if (!target_sub || typeof target_sub !== 'string') {
		throw error(400, 'Missing target_sub');
	}

	if (!plan || !VALID_PLANS.includes(plan)) {
		throw error(400, 'Invalid plan. Must be "basic" or "advanced"');
	}


	const userResult = await pool.query('SELECT sub FROM users WHERE sub = $1', [target_sub]);
	if (userResult.rows.length === 0) {
		throw error(404, 'User not found');
	}


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


export async function GET({ request }: { request: Request }) {

	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}


	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}



	const result = await pool.query(
		`SELECT sub, email, name, plan, plan_expires_at, stripe_customer_id, created_at,
		        last_seen,
		        (last_seen > NOW() - INTERVAL '45 seconds') AS online
		 FROM users ORDER BY created_at DESC LIMIT 100`
	);
	const guests = await getGuestStats();

	return json({ users: result.rows, guests });
}


export async function DELETE({ request }: { request: Request }) {

	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}


	if (!isAdminEmail(payload.email)) {
		throw error(403, 'Forbidden');
	}


	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!(await checkRateLimit(`admin:delete-user:${payload.sub}`, 10)).allowed) throw error(429, 'Too many requests');
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Invalid request');
	const { target_sub } = body;
	if (!target_sub || typeof target_sub !== 'string') {
		throw error(400, 'Missing target_sub');
	}


	if (target_sub === payload.sub) {
		throw error(400, 'ไม่สามารถลบบัญชีตัวเองได้');
	}


	const userResult = await pool.query('SELECT sub FROM users WHERE sub = $1', [target_sub]);
	if (userResult.rows.length === 0) {
		throw error(404, 'User not found');
	}


	if (await hasActiveSubscription(target_sub)) {
		return json(
			{
				error: 'active_subscription',
				message: 'ผู้ใช้ยังมี subscription ที่จ่ายเงินอยู่ ยกเลิกก่อนจึงจะลบได้'
			},
			{ status: 409 }
		);
	}


	await deleteUser(target_sub);

	return json({ success: true, target_sub });
}
