import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

// Only initialize Stripe if API key is provided
export const stripe = STRIPE_SECRET_KEY
	? new Stripe(STRIPE_SECRET_KEY)
	: null;

export const isStripeConfigured = !!STRIPE_SECRET_KEY;
