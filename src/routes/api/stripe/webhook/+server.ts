import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { stripe, isStripeConfigured } from '$lib/server/stripe';
import { syncStripeSubscription } from '$lib/server/stripe-subscription';
import type Stripe from 'stripe';

export async function POST({ request }: { request: Request }) {

	if (!isStripeConfigured || !stripe || !env.STRIPE_WEBHOOK_SECRET) {
		return json({ error: 'Stripe not configured' }, { status: 503 });
	}

	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return json({ error: 'Missing signature' }, { status: 400 });
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('[stripe] Webhook signature verification failed:', err);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	try {
		let subscriptionId: string | undefined;
		switch (event.type) {
			case 'checkout.session.completed':
			case 'checkout.session.async_payment_succeeded': {
				const session = event.data.object as Stripe.Checkout.Session;
				const subscription = session.subscription;
				subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
				break;
			}
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted':
				subscriptionId = (event.data.object as Stripe.Subscription).id;
				break;
			case 'invoice.paid':
			case 'invoice.payment_failed':
			case 'invoice.payment_action_required': {
				const invoice = event.data.object as Stripe.Invoice;
				const subscription = invoice.parent?.subscription_details?.subscription;
				subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
				break;
			}
		}
		if (subscriptionId) await syncStripeSubscription(subscriptionId);
	} catch (err) {
		console.error('[stripe] Failed to synchronise subscription:', err);
		return json({ error: 'Subscription sync failed' }, { status: 500 });
	}
	return json({ received: true });
}
