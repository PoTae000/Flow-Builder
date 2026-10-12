
export function sanitizeName(raw: string, maxLength = 100): string {
	let s = raw;

	
	s = s.replace(/--/g, '');
	s = s.replace(/\/\*/g, '');
	s = s.replace(/\*\//g, '');

	
	s = s.replace(/[;'"\\`[\]<>(){}|&=#]/g, '');

	
	s = s.replace(/[\x00-\x1f\x7f]/g, '');

	
	s = s.replace(/\s+/g, ' ').trim();

	
	if (s.length > maxLength) {
		s = s.slice(0, maxLength).trim();
	}

	return s;
}
