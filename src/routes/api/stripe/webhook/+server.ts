import { json } from '@sveltejs/kit';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { stripe } from '$lib/server/stripe';
import { pool, updateUserPlan } from '$lib/server/db';
import type Stripe from 'stripe';

export async function POST({ request }: { request: Request }) {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return json({ error: 'Missing signature' }, { status: 400 });
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('[stripe] Webhook signature verification failed:', err);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			const userSub = session.metadata?.user_sub;
			if (userSub && session.subscription) {
				// Fetch subscription to get period end
				const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
				const periodEnd = new Date(subscription.current_period_end * 1000);
				await updateUserPlan(userSub, 'advanced', periodEnd);

				// Upsert subscription record
				await pool.query(`
					INSERT INTO subscriptions (id, user_sub, stripe_customer_id, status, current_period_end)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (id) DO UPDATE SET
						status = EXCLUDED.status,
						current_period_end = EXCLUDED.current_period_end,
						updated_at = NOW()
				`, [
					subscription.id,
					userSub,
					session.customer as string,
					subscription.status,
					periodEnd
				]);
			}
			break;
		}

		case 'customer.subscription.updated': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			// Find user by stripe_customer_id
			const result = await pool.query(
				'SELECT sub FROM users WHERE stripe_customer_id = $1',
				[customerId]
			);
			if (result.rows.length > 0) {
				const userSub = result.rows[0].sub;
				const periodEnd = new Date(subscription.current_period_end * 1000);

				if (subscription.status === 'active' || subscription.status === 'trialing') {
					await updateUserPlan(userSub, 'advanced', periodEnd);
				} else {
					await updateUserPlan(userSub, 'basic');
				}

				// Update subscription record
				await pool.query(`
					INSERT INTO subscriptions (id, user_sub, stripe_customer_id, status, current_period_end, cancel_at_period_end)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (id) DO UPDATE SET
						status = EXCLUDED.status,
						current_period_end = EXCLUDED.current_period_end,
						cancel_at_period_end = EXCLUDED.cancel_at_period_end,
						updated_at = NOW()
				`, [
					subscription.id,
					userSub,
					customerId,
					subscription.status,
					periodEnd,
					subscription.cancel_at_period_end
				]);
			}
			break;
		}

		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = subscription.customer as string;

			const result = await pool.query(
				'SELECT sub FROM users WHERE stripe_customer_id = $1',
				[customerId]
			);
			if (result.rows.length > 0) {
				const userSub = result.rows[0].sub;
				await updateUserPlan(userSub, 'basic');

				// Update subscription status
				await pool.query(
					'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
					['canceled', subscription.id]
				);
			}
			break;
		}
	}

	return json({ received: true });
}
