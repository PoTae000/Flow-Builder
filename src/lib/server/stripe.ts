import Stripe from 'stripe';
import { env } from '$env/dynamic/private';


export const stripe = env.STRIPE_SECRET_KEY
	? new Stripe(env.STRIPE_SECRET_KEY)
	: null;

export const isStripeConfigured = !!env.STRIPE_SECRET_KEY;
export const isCheckoutConfigured = isStripeConfigured && !!env.STRIPE_PRICE_ID && !!env.STRIPE_WEBHOOK_SECRET;
