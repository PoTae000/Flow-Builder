import { json, error } from '@sveltejs/kit';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { authenticateRequest } from '$lib/server/google-verify';
import { stripe } from '$lib/server/stripe';
import { getStripeCustomerId } from '$lib/server/db';

export async function POST({ request, url }: { request: Request; url: URL }) {
	let payload;
	try {
		payload = await authenticateRequest(request, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		throw error(401, 'Unauthorized');
	}

	const customerId = await getStripeCustomerId(payload.sub);
	if (!customerId) {
		throw error(400, 'No subscription found');
	}

	const session = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: url.origin
	});

	return json({ url: session.url });
}
