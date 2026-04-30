/**
 * Entity/relationship count limits for AI endpoints.
 * Prevents abuse by limiting input diagram size.
 */

export const MAX_ENTITIES = 100;
export const MAX_ATTRIBUTES_PER_ENTITY = 200;
export const MAX_RELATIONSHIPS = 200;
export const MAX_ISSUES = 50;

/**
 * Validate that entity/relationship counts are within allowed limits.
 * Returns false if any limit is exceeded.
 */
export function validateEntityLimits(body: any): boolean {
	if (Array.isArray(body.entities)) {
		if (body.entities.length > MAX_ENTITIES) return false;
		for (const entity of body.entities) {
			if (Array.isArray(entity.attributes) && entity.attributes.length > MAX_ATTRIBUTES_PER_ENTITY) {
				return false;
			}
		}
	}
	if (Array.isArray(body.relationships) && body.relationships.length > MAX_RELATIONSHIPS) {
		return false;
	}
	return true;
}
