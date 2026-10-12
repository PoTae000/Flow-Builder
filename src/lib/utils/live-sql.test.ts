import { describe, it, expect } from 'vitest';
import { parseLiveSql, reconcileLiveSql } from './live-sql';
import { generateErSql } from './er-to-sql';
describe('live SQL sync', () => {
 it('rejects unfinished documents and unresolved references', () => {
  expect(() => parseLiveSql('CREATE TABLE users (id INTEGER); CREATE TABLE posts (')).toThrow();
  expect(() => parseLiveSql('CREATE TABLE users (id INTEGER)')).toThrow();
  expect(() => parseLiveSql('CREATE TABLE users (id INTEGER, unfinished);')).toThrow();
  expect(() => parseLiveSql('CREATE TABLE posts (id INTEGER, user_id INTEGER REFERENCES users(id));')).toThrow();
 });
 it('retains entity and attribute identities, positions and SQL types', () => {
  const first = reconcileLiveSql('CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(64));', [], []);
  first.entities[0].position = { x: 512, y: 302 };
  const next = reconcileLiveSql('CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(128), age INTEGER);', first.entities, []);
  expect(next.entities[0].id).toBe(first.entities[0].id);
  expect(next.entities[0].attributes[1].id).toBe(first.entities[0].attributes[1].id);
  expect(next.entities[0].position).toEqual({ x: 512, y: 302 });
  expect(generateErSql(next.entities, next.relationships).sql).toContain('BIGINT PRIMARY KEY');
  expect(generateErSql(next.entities, next.relationships).sql).toContain('VARCHAR(128)');
 });
 it('keeps junction tables as entities without generating duplicate tables', () => {
  const data = reconcileLiveSql('CREATE TABLE a (id INTEGER PRIMARY KEY); CREATE TABLE b (id INTEGER PRIMARY KEY); CREATE TABLE ab (a_id INTEGER REFERENCES a(id), b_id INTEGER REFERENCES b(id), PRIMARY KEY(a_id,b_id));', [], []);
  expect(data.entities).toHaveLength(3);
  expect(data.relationships).toHaveLength(2);
  expect((generateErSql(data.entities, data.relationships).sql.match(/CREATE TABLE/g) ?? [])).toHaveLength(3);
 });
});

describe('foreign key deletion feedback', () => {
 const customer = 'CREATE TABLE Customer (id INTEGER PRIMARY KEY);';
 const orders = 'CREATE TABLE Orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES Customer(id));';
 it('explains which reference blocks removing a parent and leaves existing data intact', () => {
  const existing = reconcileLiveSql(customer + orders, [], []);
  const before = JSON.stringify(existing);
  expect(() => reconcileLiveSql(orders, existing.entities, existing.relationships)).toThrow(/Orders.*customer_id.*REFERENCES/);
  expect(JSON.stringify(existing)).toBe(before);
 });
 it('allows deleting a parent after its reference is removed', () => {
  const existing = reconcileLiveSql(customer + orders, [], []);
  const next = reconcileLiveSql('CREATE TABLE Orders (id INTEGER PRIMARY KEY, customer_id INTEGER);', existing.entities, existing.relationships);
  expect(next.entities.map(e => e.name)).toEqual(['Orders']);
  expect(next.relationships).toHaveLength(0);
  expect(next.entities[0].id).toBe(existing.entities[1].id);
 });
 it('explains a missing referenced column', () => {
  expect(() => parseLiveSql('CREATE TABLE Customer (other INTEGER PRIMARY KEY);' + orders)).toThrow(/Customer.*id.*Orders.*customer_id/);
 });
});
