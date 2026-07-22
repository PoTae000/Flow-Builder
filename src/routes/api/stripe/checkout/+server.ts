import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { STRIPE_PRICE_ID } from '$env/static/private';
import { authenticateRequest } from '$lib/server/google-verify';
import { stripe, isStripeConfigured } from '$lib/server/stripe';
import { ensureUser, getStripeCustomerId, setStripeCustomerId } from '$lib/server/db';

export async function POST({ request, url }: { request: Request; url: URL }) {
	// Check if Stripe is configured
	if (!isStripeConfigured || !stripe) {
		throw error(503, 'Stripe is not configured. Please contact administrator.');
	}

	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	await ensureUser(payload.sub, payload.email, payload.name);

	// Get or create Stripe customer
	let customerId = await getStripeCustomerId(payload.sub);

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: payload.email,
			metadata: { user_sub: payload.sub }
		});
		customerId = customer.id;
		await setStripeCustomerId(payload.sub, customerId);
	}

	// Create Checkout Session
	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		mode: 'subscription',
		line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
		success_url: `${url.origin}?checkout=success`,
		cancel_url: `${url.origin}?checkout=cancel`,
		metadata: { user_sub: payload.sub }
	});

	return json({ url: session.url });
}
