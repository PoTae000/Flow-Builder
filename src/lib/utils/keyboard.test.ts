import { describe, it, expect } from 'vitest';
import { shortcutCode } from './keyboard';
describe('keyboard layout independent shortcuts', () => {
 it.each([['z','ผ','KeyZ'], ['y','ั','KeyY'], ['c','แ','KeyC'], ['v','อ','KeyV'], ['a','ฟ','KeyA'], ['s','ห','KeyS'], ['d','ก','KeyD'], ['f','ด','KeyF'], ['l','ส','KeyL'], ['g','เ','KeyG'], ['k','า','KeyK']])('matches %s and %s', (english, thai, code) => {
  expect(shortcutCode({code, key:thai})).toBe(code);
  expect(shortcutCode({code:'', key:thai})).toBe(code);
  expect(shortcutCode({code:'', key:english})).toBe(code);
 });
 it('prefers physical keys for shifted characters', () => {
  expect(shortcutCode({code:'KeyZ', key:'('})).toBe('KeyZ');
 });
});
