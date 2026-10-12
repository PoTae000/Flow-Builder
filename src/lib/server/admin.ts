import { env } from '$env/dynamic/private';


function getAdminEmails(): string[] {
	if (!env.ADMIN_EMAILS) return [];
	return env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}


export function isAdminEmail(email: string | null | undefined): boolean {
	if (!email) return false;
	return getAdminEmails().includes(email.toLowerCase());
}
