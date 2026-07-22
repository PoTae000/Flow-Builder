import { ADMIN_EMAILS } from '$env/static/private';

/** Parse comma-separated admin emails from env */
function getAdminEmails(): string[] {
	if (!ADMIN_EMAILS) return [];
	return ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/** Check if an email is in the admin list */
export function isAdminEmail(email: string | null | undefined): boolean {
	if (!email) return false;
	return getAdminEmails().includes(email.toLowerCase());
}
