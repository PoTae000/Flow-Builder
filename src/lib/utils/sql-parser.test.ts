import { describe, it, expect } from 'vitest';
import { parseSqlDdl } from './sql-parser';

describe('parseSqlDdl', () => {
	it('parses a simple CREATE TABLE', () => {
		const sql = `
			CREATE TABLE Users (
				id INT PRIMARY KEY,
				name VARCHAR(100),
				email VARCHAR(255)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		expect(result.tables[0].name).toBe('Users');
		expect(result.tables[0].columns).toHaveLength(3);
		expect(result.tables[0].columns[0].isPrimaryKey).toBe(true);
	});

	it('detects foreign key via FOREIGN KEY constraint', () => {
		const sql = `
			CREATE TABLE Orders (
				id INT PRIMARY KEY,
				user_id INT,
				FOREIGN KEY (user_id) REFERENCES Users(id)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		const userIdCol = result.tables[0].columns.find(c => c.name === 'user_id');
		expect(userIdCol?.isForeignKey).toBe(true);
		expect(userIdCol?.references?.table).toBe('Users');
		expect(userIdCol?.references?.column).toBe('id');
	});

	it('handles composite primary keys', () => {
		const sql = `
			CREATE TABLE enrollment (
				student_id INT,
				course_id INT,
				grade VARCHAR(2),
				PRIMARY KEY (student_id, course_id)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		const studentId = result.tables[0].columns.find(c => c.name === 'student_id');
		const courseId = result.tables[0].columns.find(c => c.name === 'course_id');
		expect(studentId?.isPrimaryKey).toBe(true);
		expect(courseId?.isPrimaryKey).toBe(true);
	});

	it('parses junction tables (M:N)', () => {
		const sql = `
			CREATE TABLE Students (id INT PRIMARY KEY, name VARCHAR(100));
			CREATE TABLE Courses (id INT PRIMARY KEY, title VARCHAR(200));
			CREATE TABLE StudentCourses (
				student_id INT REFERENCES Students(id),
				course_id INT REFERENCES Courses(id),
				PRIMARY KEY (student_id, course_id)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(3);
		const junctionRels = result.relationships.filter(r => r.isJunction);
		expect(junctionRels.length).toBeGreaterThanOrEqual(1);
	});

	it('removes SQL comments', () => {
		const sql = `
			-- This is a comment
			CREATE TABLE Test (
				id INT PRIMARY KEY, /* inline comment */
				name VARCHAR(100)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		expect(result.tables[0].name).toBe('Test');
	});

	it('handles ALTER TABLE with FOREIGN KEY', () => {
		const sql = `
			CREATE TABLE Departments (id INT PRIMARY KEY, name VARCHAR(100));
			CREATE TABLE Employees (id INT PRIMARY KEY, dept_id INT);
			ALTER TABLE Employees ADD FOREIGN KEY (dept_id) REFERENCES Departments(id);
		`;
		const result = parseSqlDdl(sql);
		expect(result.relationships).toHaveLength(1);
		expect(result.relationships[0].fromTable).toBe('Employees');
		expect(result.relationships[0].toTable).toBe('Departments');
	});

	it('handles quoted identifiers', () => {
		const sql = `
			CREATE TABLE \`my_table\` (
				\`id\` INT PRIMARY KEY,
				\`name\` VARCHAR(100)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		expect(result.tables[0].name).toBe('my_table');
	});

	it('handles PostgreSQL SERIAL type', () => {
		const sql = `
			CREATE TABLE posts (
				id SERIAL PRIMARY KEY,
				title VARCHAR(200)
			);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(1);
		const idCol = result.tables[0].columns.find(c => c.name === 'id');
		expect(idCol?.isPrimaryKey).toBe(true);
	});

	it('warns when no CREATE TABLE found', () => {
		const result = parseSqlDdl('SELECT * FROM users;');
		expect(result.tables).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('No CREATE TABLE');
	});

	it('handles multiple tables', () => {
		const sql = `
			CREATE TABLE A (id INT PRIMARY KEY);
			CREATE TABLE B (id INT PRIMARY KEY);
			CREATE TABLE C (id INT PRIMARY KEY);
		`;
		const result = parseSqlDdl(sql);
		expect(result.tables).toHaveLength(3);
	});
});
