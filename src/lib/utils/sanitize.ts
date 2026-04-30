/**
 * Sanitize a user-provided name (entity, attribute, relationship).
 * Strips SQL injection characters and control characters while preserving
 * Unicode letters (Thai, etc.), numbers, spaces, hyphens, underscores, and dots.
 */
export function sanitizeName(raw: string, maxLength = 100): string {
	let s = raw;

	// Remove SQL comment sequences
	s = s.replace(/--/g, '');
	s = s.replace(/\/\*/g, '');
	s = s.replace(/\*\//g, '');

	// Remove dangerous characters: ; ' " ` \ [ ] < > ( ) { } | & = #
	s = s.replace(/[;'"\\`[\]<>(){}|&=#]/g, '');

	// Remove control characters (U+0000–U+001F, U+007F)
	s = s.replace(/[\x00-\x1f\x7f]/g, '');

	// Collapse whitespace and trim
	s = s.replace(/\s+/g, ' ').trim();

	// Enforce max length
	if (s.length > maxLength) {
		s = s.slice(0, maxLength).trim();
	}

	return s;
}
