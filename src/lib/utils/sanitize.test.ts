import { describe, it, expect } from 'vitest';
import { sanitizeName } from './sanitize';

describe('sanitizeName', () => {
	it('trims whitespace', () => {
		expect(sanitizeName('  hello  ')).toBe('hello');
	});

	it('collapses internal whitespace', () => {
		expect(sanitizeName('hello   world')).toBe('hello world');
	});

	it('removes single quotes', () => {
		expect(sanitizeName("it's a test")).toBe('its a test');
	});

	it('removes double quotes', () => {
		expect(sanitizeName('"quoted"')).toBe('quoted');
	});

	it('removes backticks', () => {
		expect(sanitizeName('`backtick`')).toBe('backtick');
	});

	it('removes semicolons', () => {
		expect(sanitizeName('name; DROP TABLE')).toBe('name DROP TABLE');
	});

	it('removes backslashes', () => {
		expect(sanitizeName('path\\to\\name')).toBe('pathtoname');
	});

	it('removes SQL comment sequences', () => {
		expect(sanitizeName('name--comment')).toBe('namecomment');
		expect(sanitizeName('name/*comment*/')).toBe('namecomment');
	});

	it('removes square brackets', () => {
		expect(sanitizeName('[dbo].[Users]')).toBe('dbo.Users');
	});

	it('preserves Thai characters', () => {
		expect(sanitizeName('ชื่อนักเรียน')).toBe('ชื่อนักเรียน');
	});

	it('preserves hyphens and underscores', () => {
		expect(sanitizeName('my-entity_name')).toBe('my-entity_name');
	});

	it('preserves dots', () => {
		expect(sanitizeName('schema.table')).toBe('schema.table');
	});

	it('preserves numbers', () => {
		expect(sanitizeName('table123')).toBe('table123');
	});

	it('removes control characters', () => {
		expect(sanitizeName('hello\x00world\x1f')).toBe('helloworld');
	});

	it('enforces max length', () => {
		const long = 'a'.repeat(200);
		expect(sanitizeName(long).length).toBe(100);
	});

	it('enforces custom max length', () => {
		expect(sanitizeName('abcdef', 3)).toBe('abc');
	});

	it('handles empty string', () => {
		expect(sanitizeName('')).toBe('');
	});

	it('handles string of only dangerous chars', () => {
		expect(sanitizeName("';--/**/")).toBe('');
	});

	it('handles SQL injection attempt', () => {
		const input = "'; DROP TABLE users--";
		const result = sanitizeName(input);
		expect(result).not.toContain(';');
		expect(result).not.toContain("'");
		expect(result).not.toContain('--');
	});

	it('handles complex injection with Thai', () => {
		const input = "นักเรียน'; DELETE FROM--";
		const result = sanitizeName(input);
		expect(result).toContain('นักเรียน');
		expect(result).not.toContain(';');
		expect(result).not.toContain("'");
	});
});
