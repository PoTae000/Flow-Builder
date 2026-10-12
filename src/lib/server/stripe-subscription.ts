import type Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { pool } from './db';
import { stripe } from './stripe';

// Only a paid, active subscription for our configured product grants AI access.
export function subscriptionAccess(subscription: Stripe.Subscription, priceId: string, now = Date.now()) {
	const items = subscription.items.data.filter(item => item.price.id === priceId);
	const end = Math.max(0, ...items.map(item => item.current_period_end));
	const invoice = subscription.latest_invoice;
	const paid = typeof invoice === 'object' && invoice !== null && invoice.status === 'paid';
	return { entitled: subscription.status === 'active' && paid && end * 1000 > now, end };
}

export async function syncStripeSubscription(id: string): Promise<void> {
	if (!stripe || !env.STRIPE_PRICE_ID) throw new Error('Stripe subscription configuration is missing');
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Serialise events for the same subscription and read the current Stripe state.
		// Repeated or delayed webhooks cannot restore an old entitlement.
		await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
		const subscription = await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] });
		const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
		const user = await client.query('SELECT sub FROM users WHERE stripe_customer_id = $1 FOR UPDATE', [customerId]);
		if (!user.rows.length || !subscription.items.data.some(item => item.price.id === env.STRIPE_PRICE_ID)) {
			await client.query('COMMIT');
			return;
		}
		const userSub = user.rows[0].sub;
		const access = subscriptionAccess(subscription, env.STRIPE_PRICE_ID);
		const status = subscription.status === 'active' && !access.entitled ? 'unpaid' : subscription.status;
		await client.query(`INSERT INTO subscriptions (id, user_sub, stripe_customer_id, status, current_period_end, cancel_at_period_end)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end,
			cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()`,
			[id, userSub, customerId, status, new Date(access.end * 1000), subscription.cancel_at_period_end]);
		const active = await client.query(`SELECT MAX(expires_at) AS expires_at FROM (
			SELECT current_period_end AS expires_at FROM subscriptions
			WHERE user_sub = $1 AND status = 'active' AND current_period_end > NOW()
			UNION ALL SELECT pro_expires_at AS expires_at FROM payment_orders
			WHERE user_sub = $1 AND status = 'paid' AND pro_expires_at > NOW()
		) entitlements`, [userSub]);
		const expiry = active.rows[0]?.expires_at ?? null;
		await client.query('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE sub = $3', [expiry ? 'advanced' : 'basic', expiry, userSub]);
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
