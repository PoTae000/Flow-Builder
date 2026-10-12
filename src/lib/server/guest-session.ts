import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
const key = env.GUEST_SESSION_SECRET || randomBytes(32).toString('hex');
export const GUEST_COOKIE = 'flow_guest_session';
export function issueGuestSession() {
 const id = `guest_${randomUUID()}`;
 return `${id}.${createHmac('sha256', key).update(id).digest('hex')}`;
}
export function readGuestSession(value?: string): string | null {
 if (!value) return null;
 const [id, signature, extra] = value.split('.');
 if (extra || !/^guest_[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{64}$/.test(signature || '')) return null;
 const expected = createHmac('sha256', key).update(id).digest();
 return timingSafeEqual(expected, Buffer.from(signature, 'hex')) ? id : null;
}
// Bounded local gate rejects floods before any database work.
const requests = new Map<string, { count: number; until: number }>();
export function guestRequestAllowed(ip: string, now = Date.now()): boolean {
 for (const [key, item] of requests) if (item.until <= now) requests.delete(key);
 let entry = requests.get(ip);
 if (!entry) {
  if (requests.size >= 10000) return false;
  entry = { count: 0, until: now + 60000 }; requests.set(ip, entry);
 }
 return ++entry.count <= 60;
}
