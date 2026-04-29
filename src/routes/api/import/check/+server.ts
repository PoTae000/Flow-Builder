import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const apiKey = platform?.env?.GROQ_API_KEY || env.GROQ_API_KEY;
	return json({ available: !!apiKey });
};
